import GoogleProvider from "next-auth/providers/google";
import { sql } from "@/lib/db";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();

async function refreshAccessToken(token) {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });
    const refreshed = await res.json();
    if (!res.ok) throw refreshed;
    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in,
      // 구글은 refresh_token을 재발급하지 않는 경우가 많으니 기존 값 유지
      refreshToken: refreshed.refresh_token || token.refreshToken,
      error: undefined,
    };
  } catch (err) {
    console.error("구글 토큰 갱신 실패:", err);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.events",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // 초대된 사람(이미 members row가 있음) 또는 지정 관리자 이메일만 로그인 허용.
    // 나머지는 구글 로그인 자체는 성공해도 우리 앱 세션은 발급하지 않는다.
    async signIn({ user }) {
      const email = (user.email || "").toLowerCase();
      if (!email) return false;

      const rows = await sql`SELECT email, status FROM members WHERE email = ${email}`;
      if (rows.length > 0) {
        return rows[0].status === "active";
      }

      if (email === ADMIN_EMAIL) {
        const name = user.name || email.split("@")[0];
        await sql`
          INSERT INTO members (email, name, is_admin, status)
          VALUES (${email}, ${name}, TRUE, 'active')
          ON CONFLICT (email) DO NOTHING
        `;
        return true;
      }

      // 초대받지 않은 이메일: 로그인 거부
      return false;
    },
    async jwt({ token, account, user }) {
      if (account && user) {
        token.email = user.email?.toLowerCase();
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }

      const rows = await sql`SELECT is_admin FROM members WHERE email = ${token.email}`;
      token.isAdmin = rows.length > 0 ? rows[0].is_admin : false;

      const isExpired = token.expiresAt && Date.now() / 1000 > token.expiresAt - 60;
      if (isExpired && token.refreshToken) {
        return refreshAccessToken(token);
      }
      return token;
    },
    async session({ session, token }) {
      session.user.email = token.email;
      session.user.isAdmin = !!token.isAdmin;
      session.accessToken = token.accessToken;
      session.googleAuthError = token.error || null;
      return session;
    },
  },
};
