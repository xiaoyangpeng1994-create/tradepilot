import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { fenToYuan } from "@/lib/pricing";
import { AgentClient } from "./AgentClient";

export const dynamic = "force-dynamic";

async function countAllDescendants(rootId: string): Promise<number> {
  let total = 0;
  let frontier: string[] = [rootId];
  while (frontier.length) {
    const next = await prisma.user.findMany({
      where: { parentAgentId: { in: frontier } },
      select: { id: true },
    });
    total += next.length;
    frontier = next.map((u) => u.id);
  }
  return total;
}

export default async function AgentPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/agent");
  }
  const userId = session.user.id;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { nickname: true, walletBalance: true, agentLevel: true, parentAgentId: true },
  });
  if (!me) redirect("/login?callbackUrl=/agent");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [todaySumAgg, directCount, totalDescendants, recentLogs] = await Promise.all([
    prisma.commissionLog.aggregate({
      where: { recipientId: userId, createdAt: { gte: startOfToday } },
      _sum: { amountCny: true },
    }),
    prisma.user.count({ where: { parentAgentId: userId } }),
    countAllDescendants(userId),
    prisma.commissionLog.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        amountCny: true,
        level: true,
        rate: true,
        createdAt: true,
        payerNickname: true,
        payerId: true,
        note: true,
        order: { select: { itemCode: true, amountCny: true } },
      },
    }),
  ]);

  const todaySumFen = todaySumAgg._sum.amountCny ?? 0;

  return (
    <>
      <PageHeader title="代理商核心运营矩阵" badge="MASTER NODE ACTIVE" />
      <div className="flex-1 overflow-y-auto">
        <AgentClient
          me={{ nickname: me.nickname, walletBalanceCny: fenToYuan(me.walletBalance) }}
          stats={{
            walletBalanceCny: fenToYuan(me.walletBalance),
            todaySumCny: fenToYuan(todaySumFen),
            totalNodes: totalDescendants,
            directSubs: directCount,
          }}
          feed={recentLogs.map((l) => ({
            id: l.id,
            payerNickname: l.payerNickname,
            payerId: l.payerId,
            level: l.level,
            amountCny: fenToYuan(l.amountCny),
            orderAmountCny: fenToYuan(l.order.amountCny),
            itemCode: l.order.itemCode,
            note: l.note,
            createdAt: l.createdAt.toISOString(),
          }))}
        />
      </div>
    </>
  );
}
