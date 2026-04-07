import postgres from "postgres";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TEST_DB_URL = "postgresql://test:test@localhost:5433/its_karte_test";

const MIGRATIONS_DIR = join(__dirname, "../../core/drizzle");

const MIGRATION_FILES = [
  "0000_mushy_magma.sql",
  "0001_skinny_cannonball.sql",
  "0002_awesome_overlord.sql",
  "0003_secret_marvel_apes.sql",
  "0004_loose_wasp.sql",
];

const SEED_MEMBERS = [
  {
    id: "member-001",
    name: "テスト太郎",
    student_id: "12345678",
    email: "taro@shizuoka.ac.jp",
    status: "active",
    affiliation: JSON.stringify({
      type: "undergraduate",
      value: { faculty: "情報学部", department: "情報科学科", year: 3 },
    }),
  },
  {
    id: "member-002",
    name: "テスト花子",
    student_id: "87654321",
    email: "hanako@shizuoka.ac.jp",
    status: "active",
    affiliation: JSON.stringify({
      type: "undergraduate",
      value: { faculty: "工学部", department: "機械工学科", year: 2 },
    }),
  },
  {
    id: "member-003",
    name: "テスト次郎",
    student_id: "11112222",
    email: "jiro@shizuoka.ac.jp",
    status: "active",
    affiliation: JSON.stringify({
      type: "undergraduate",
      value: { faculty: "理学部", department: "数学科", year: 1 },
    }),
  },
];

/** テーブルが存在するか確認 */
async function tablesExist(sql: postgres.Sql): Promise<boolean> {
  const result = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'members'
    ) AS exists
  `;
  return result[0].exists;
}

/** 初回: スキーマ作成とマイグレーション実行 */
async function migrate(sql: postgres.Sql) {
  await sql.unsafe(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
  `);

  for (const file of MIGRATION_FILES) {
    const path = join(MIGRATIONS_DIR, file);
    const content = readFileSync(path, "utf-8");
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await sql.unsafe(stmt);
    }
  }
}

/** 全テーブルのデータを削除してシードを投入 */
async function seedData(sql: postgres.Sql) {
  // FK制約を考慮した順序で削除
  await sql`TRUNCATE karte_assignees, kartes, member_domain_events, discord_account_domain_events, member_exhibits, member_events, discord_accounts, members CASCADE`;

  const now = new Date();
  for (const member of SEED_MEMBERS) {
    await sql`
      INSERT INTO members (id, name, student_id, email, status, affiliation, "createdAt", "updatedAt")
      VALUES (
        ${member.id},
        ${member.name},
        ${member.student_id},
        ${member.email},
        ${member.status}::member_status,
        ${member.affiliation}::jsonb,
        ${now},
        ${now}
      )
    `;
  }
}

/** DBを初期化してシードデータを投入する */
export async function resetAndSeed() {
  const url = process.env.DATABASE_URL ?? TEST_DB_URL;
  const sql = postgres(url, { max: 1 });

  try {
    const exists = await tablesExist(sql);
    if (!exists) {
      await migrate(sql);
    }
    await seedData(sql);
  } finally {
    await sql.end();
  }
}

// CLI から直接実行された場合
const isDirectRun = process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js");

if (isDirectRun) {
  resetAndSeed()
    .then(() => console.log("seed complete"))
    .catch((err) => {
      console.error("seed failed:", err);
      process.exit(1);
    });
}
