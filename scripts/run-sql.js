// 사용법: node scripts/run-sql.js sql/001_init.sql
// DATABASE_URL은 .env.local에서 읽는다 (dotenv 없이 최소 구현 -- 그 파일을 직접 파싱).
const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("사용법: node scripts/run-sql.js <sql파일경로>");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL이 없습니다. .env.local을 먼저 채워주세요.");
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  const text = fs.readFileSync(path.join(__dirname, "..", filePath), "utf8");
  await sql.query(text);
  console.log(`완료: ${filePath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
