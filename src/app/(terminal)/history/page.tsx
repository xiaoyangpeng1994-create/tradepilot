import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HistoryClient } from "./HistoryClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "历史会话",
};

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/history");
  }

  const sessions = await prisma.chatSession.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 1,
      },
      _count: { select: { messages: true } },
    },
  });

  const rows = sessions
    .filter((s) => s._count.messages > 0)
    .map((s) => ({
      id: s.id,
      channel: s.channel,
      firstMessage: s.messages[0]?.content?.slice(0, 100) ?? "(空对话)",
      messageCount: s._count.messages,
      updatedAt: s.updatedAt.toISOString(),
    }));

  return <HistoryClient rows={rows} />;
}
