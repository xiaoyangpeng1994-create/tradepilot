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

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  // 并行查询：上级昵称 + 邀请人数 + 累计邀请获得的算力点（通过 inviterBonusLog 或直接统计直推用户数）
  const [parentUser, invitedCount] = await Promise.all([
    user.parentAgentId
      ? prisma.user.findUnique({
          where: { id: user.parentAgentId },
          select: { nickname: true },
        })
      : Promise.resolve(null),
    // 直接统计以当前用户为 parentAgentId 的用户数量（即邀请成功人数）
    prisma.user.count({ where: { parentAgentId: userId } }),
  ]);

  const parentNickname = parentUser?.nickname ?? null;
  // 累计邀请奖励算力点 = 邀请人数 × 500（INVITER_BONUS_PTS）
  // 注意：这里只是展示估算值，实际以 computePts 余额为准
  const invitedEarnedPts = invitedCount * 500;

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
          inviteStats={{
            invitedCount,
            invitedEarnedPts,
          }}
        />
      </div>
    </>
  );
}
