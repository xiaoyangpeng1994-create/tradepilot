import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileClient } from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/profile");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      nickname: true,
      email: true,
      phone: true,
      computePts: true,
      walletBalance: true,
      vipLevel: true,
      vipExpiresAt: true,
      agentLevel: true,
      parentAgentId: true,
      tradingStyle: true,
      createdAt: true,
    },
  });

  if (!user) redirect("/login?callbackUrl=/profile");

  let parentNickname: string | null = null;
  if (user.parentAgentId) {
    const p = await prisma.user.findUnique({
      where: { id: user.parentAgentId },
      select: { nickname: true },
    });
    parentNickname = p?.nickname ?? null;
  }

  return (
    <>
      <PageHeader title="个人中心" badge="ACCOUNT_PROFILE" />
      <div className="flex-1 overflow-y-auto">
        <ProfileClient
          user={{
            id: user.id,
            nickname: user.nickname,
            email: user.email,
            phone: user.phone,
            computePts: user.computePts,
            walletBalanceCny: (user.walletBalance / 100).toFixed(2),
            vipLevel: user.vipLevel,
            vipExpiresAt: user.vipExpiresAt ? user.vipExpiresAt.toISOString() : null,
            agentLevel: user.agentLevel,
            parentNickname,
            tradingStyle: (user.tradingStyle as "INTRADAY" | "SWING" | "POSITION" | "LEARNING") ?? "LEARNING",
            createdAt: user.createdAt.toISOString(),
          }}
        />
      </div>
    </>
  );
}
