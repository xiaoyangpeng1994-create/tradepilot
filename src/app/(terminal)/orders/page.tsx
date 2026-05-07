import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { fenToYuan, PRICING, isItemCode } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/orders");
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const totalPaid = orders
    .filter((o) => o.status === "PAID")
    .reduce((s, o) => s + o.amountCny, 0);

  return (
    <>
      <PageHeader title="账单中心" badge="ORDER_HISTORY" />
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <Summary count={orders.length} totalPaid={totalPaid} />
        {orders.length === 0 ? <EmptyOrders /> : <OrderList orders={orders} />}
      </div>
    </>
  );
}

function Summary({ count, totalPaid }: { count: number; totalPaid: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="terminal-card p-4">
        <div className="label-tag">订单总数 (TOTAL_ORDERS)</div>
        <div className="text-ink-bright text-2xl font-light mt-2">
          {count.toLocaleString()}
        </div>
      </div>
      <div className="terminal-card p-4">
        <div className="label-tag">累计已支付 (PAID_AMOUNT)</div>
        <div className="text-accent-neon text-2xl font-light mt-2">
          ¥{fenToYuan(totalPaid)}
        </div>
      </div>
    </div>
  );
}

function EmptyOrders() {
  return (
    <div className="terminal-card p-10 text-center space-y-3">
      <div className="text-ink-muted text-sm">暂无消费记录</div>
      <div className="text-[11px] text-ink-dim">
        前往{" "}
        <a href="/pricing" className="text-accent-info hover:text-accent-info/80">
          算力 & 订阅中心
        </a>{" "}
        充值或开通 VIP，订单将出现在这里
      </div>
    </div>
  );
}

type OrderRow = {
  id: string;
  type: string;
  itemCode: string;
  amountCny: number;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
};

function OrderList({ orders }: { orders: OrderRow[] }) {
  return (
    <div className="terminal-card overflow-hidden">
      <div className="grid grid-cols-[120px_1fr_120px_140px_180px] gap-4 px-5 py-3 border-b border-bg-edge text-[10px] tracking-widest uppercase text-ink-dim">
        <span>类型</span>
        <span>商品</span>
        <span className="text-right">金额</span>
        <span>状态</span>
        <span>时间</span>
      </div>
      <div className="divide-y divide-bg-edge">
        {orders.map((o) => (
          <OrderRow key={o.id} order={o} />
        ))}
      </div>
    </div>
  );
}

function OrderRow({ order }: { order: OrderRow }) {
  const productName = isItemCode(order.itemCode)
    ? PRICING[order.itemCode].name
    : order.itemCode;
  const isPaid = order.status === "PAID";
  const isPending = order.status === "PENDING";
  const stamp = order.paidAt ?? order.createdAt;

  return (
    <div className="grid grid-cols-[120px_1fr_120px_140px_180px] gap-4 px-5 py-3 items-center text-xs">
      <span className="text-ink-muted">
        {order.type === "RECHARGE" ? "算力充值" : "VIP 订阅"}
      </span>
      <span className="text-ink-bright">
        {productName}
        <span className="text-[10px] text-ink-dim ml-2 font-mono">
          {order.itemCode}
        </span>
      </span>
      <span className="text-right text-ink-bright">¥{fenToYuan(order.amountCny)}</span>
      <span>
        {isPaid && (
          <span className="text-[10px] tracking-widest text-accent-neon border border-accent-neon/40 bg-accent-neon/10 rounded-sm px-1.5 py-0.5">
            ✓ 已支付
          </span>
        )}
        {isPending && (
          <span className="text-[10px] tracking-widest text-accent-gold border border-accent-gold/40 bg-accent-gold/10 rounded-sm px-1.5 py-0.5">
            ⏳ 待支付
          </span>
        )}
        {!isPaid && !isPending && (
          <span className="text-[10px] tracking-widest text-ink-dim border border-bg-edge bg-bg-card rounded-sm px-1.5 py-0.5">
            {order.status}
          </span>
        )}
      </span>
      <span className="text-ink-muted text-[11px]">
        {new Date(stamp).toLocaleString("zh-CN", { hour12: false })}
      </span>
    </div>
  );
}
