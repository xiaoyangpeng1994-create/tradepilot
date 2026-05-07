import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { PricingClient } from "./PricingClient";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const session = await auth();
  let initial = {
    isLoggedIn: false,
    nickname: null as string | null,
    computePts: 0,
    vipLevel: "FREE" as string,
    vipExpiresAt: null as string | null,
  };

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        nickname: true,
        computePts: true,
        vipLevel: true,
        vipExpiresAt: true,
      },
    });
    if (user) {
      initial = {
        isLoggedIn: true,
        nickname: user.nickname,
        computePts: user.computePts,
        vipLevel: user.vipLevel,
        vipExpiresAt: user.vipExpiresAt ? user.vipExpiresAt.toISOString() : null,
      };
    }
  }

  return (
    <>
      <PageHeader title="算力 & 订阅中心" badge="PREMIUM_ACCESS_GATEWAY" />
      <div className="flex-1 overflow-y-auto">
        <PricingClient initial={initial} />
      </div>
    </>
  );
}
