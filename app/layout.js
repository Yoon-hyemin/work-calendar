import "./globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "업무 캘린더",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-bg text-text-body font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
