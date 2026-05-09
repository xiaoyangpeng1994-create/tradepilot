import { PrismaClient } from "@prisma/client";

// ── Turso / libSQL 适配器（生产环境运行时）────────────────────────────────────
// 本地开发：DATABASE_URL=file:./dev.db，走原生 SQLite
// Vercel 生产运行时：DATABASE_URL=libsql://xxx + TURSO_AUTH_TOKEN，走 libSQL 适配器
// Vercel 构建阶段：跳过 adapter，避免 next build 静态分析时报错

function buildPrismaClient(): PrismaClient {
  const tursoUrl   = process.env.DATABASE_URL ?? "";
  const tursoToken = process.env.TURSO_AUTH_TOKEN ?? "";

  // 只有在运行时（非构建阶段）且两个变量都存在时才使用 libSQL adapter
  const isRuntime = process.env.NEXT_PHASE !== "phase-production-build";
  const useTurso  = isRuntime && tursoToken.length > 0 && tursoUrl.startsWith("libsql://");

  if (useTurso) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createClient } = require("@libsql/client") as typeof import("@libsql/client");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaLibSql } = require("@prisma/adapter-libsql") as {
        PrismaLibSql: new (client: ReturnType<typeof createClient>) => object;
      };
      const libsql  = createClient({ url: tursoUrl, authToken: tursoToken });
      const adapter = new PrismaLibSql(libsql);
      return new PrismaClient({
        adapter,
        log: ["error"],
      } as ConstructorParameters<typeof PrismaClient>[0]);
    } catch (e) {
      console.error("[prisma] Failed to init libSQL adapter, falling back:", e);
    }
  }

  // 本地开发 / 构建阶段 / fallback：原生 SQLite
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? buildPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
