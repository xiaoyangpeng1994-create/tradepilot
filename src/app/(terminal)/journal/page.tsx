import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { JournalClient } from "./JournalClient";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/journal");
  }

  return (
    <>
      <PageHeader title="你的 AI 交易画像" />
      <div className="flex-1 overflow-y-auto">
        <JournalClient />
      </div>
    </>
  );
}
