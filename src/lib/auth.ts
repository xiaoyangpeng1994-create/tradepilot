import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        nickname: { label: "昵称", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.nickname || !credentials?.password) return null;
        const nickname = credentials.nickname.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { nickname } });
        if (!user) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, name: user.nickname, email: user.email ?? undefined };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  jwt: { maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // 首次登录：写入 id
      if (user) token.id = user.id;

      // 每次 token 刷新时（首次登录 + session update 触发）从 DB 同步最新状态
      // trigger === "update" 时是客户端主动调用 update()，也需要刷新
      if (token.id && (user || trigger === "update")) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            vipLevel: true,
            vipExpiresAt: true,
            computePts: true,
          },
        });
        if (dbUser) {
          token.vipLevel = dbUser.vipLevel;
          token.vipExpiresAt = dbUser.vipExpiresAt?.toISOString() ?? null;
          token.computePts = dbUser.computePts;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as any).id = token.id;
        (session.user as any).vipLevel = token.vipLevel ?? "FREE";
        (session.user as any).vipExpiresAt = token.vipExpiresAt ?? null;
        (session.user as any).computePts = token.computePts ?? 0;
      }
      return session;
    },
  },
};

export const auth = () => getServerSession(authOptions);

declare module "next-auth" {
  interface User {
    id: string;
  }
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      vipLevel: string;
      vipExpiresAt: string | null;
      computePts: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    vipLevel?: string;
    vipExpiresAt?: string | null;
    computePts?: number;
  }
}
