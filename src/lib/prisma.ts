import { PrismaClient } from "@prisma/client";

// ── Turso / libSQL 适配器（生产环境）────────────────────────────────────────
// 本地开发：DATABASE_URL=file:./dev.db，不需要适配器，走原生 SQLite
// Vercel 生产：DATABASE_URL=libsql://xxx.turso.io + TURSO_AUTH_TOKEN，走 libSQL 适配器
//
// 判断依据：TURSO_AUTH_TOKEN 存在 && DATABASE_URL 以 libsql:// 开头

function buildPrismaClient(): PrismaClient {
  const tursoUrl = process.env.DATABASE_URL ?? "";
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoToken && tursoUrl.startsWith("libsql://")) {
    // 生产环境：使用 Turso libSQL 适配器（同步 require 避免 top-level await 问题）
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require("@libsql/client") as typeof import("@libsql/client");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSql } = require("@prisma/adapter-libsql") as { PrismaLibSql: new (client: ReturnType<typeof createClient>) => object };

    const libsql = createClient({ url: tursoUrl, authToken: tursoToken });
    const adapter = new PrismaLibSql(libsql);
    return new PrismaClient({
      adapter,
      log: ["error"],
    } as ConstructorParameters<typeof PrismaClient>[0]);
  }

  // 本地开发：原生 SQLite
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? buildPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
