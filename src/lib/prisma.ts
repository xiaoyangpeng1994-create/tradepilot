import { PrismaClient } from "@prisma/client";
import { createClient } from "@libsql/client/http";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

// ── Turso / libSQL 适配器（生产环境运行时）────────────────────────────────────
// 本地开发：DATABASE_URL=file:./dev.db，走原生 SQLite
// Vercel 生产运行时：DATABASE_URL=libsql://xxx + TURSO_AUTH_TOKEN，走 libSQL HTTP 适配器
//
// 关键：使用 @libsql/client/http 子路径（纯 HTTP，无 WASM/native 模块）
// 这样 webpack 可以正常打包，Vercel serverless 也能正常运行

function buildPrismaClient(): PrismaClient {
  const tursoUrl   = process.env.DATABASE_URL ?? "";
  const tursoToken = process.env.TURSO_AUTH_TOKEN ?? "";

  // 只有在运行时（非构建阶段）且两个变量都存在时才使用 libSQL adapter
  const isRuntime = process.env.NEXT_PHASE !== "phase-production-build";
  const useTurso  = isRuntime && tursoToken.length > 0 && tursoUrl.startsWith("libsql://");

  if (useTurso) {
    try {
      const libsql  = createClient({ url: tursoUrl, authToken: tursoToken });
      const adapter = new PrismaLibSQL(libsql);
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
