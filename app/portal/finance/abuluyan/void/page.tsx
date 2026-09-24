import { redirect } from "next/navigation";
import { getAbuluyanContext, denyAbuluyan } from "@/lib/portal";
import { Notice, PageHeader, Panel } from "@/components/portal/ui";
import { AbuluyanVoidForm } from "@/components/portal/abuluyan-void-form";
import { ABULUYAN_BASE } from "@/lib/abuluyan";

// Pahina ng Admin: pag-void lamang. Hindi nakikita ng Admin ang mga halaga (kabuuan lang sa ulat, Plan B),
// kaya pumipili ng local at Linggo; ang database (void_abuluyan) ang nagsasabi kung may naipadalang record.
export default async function AbuluyanVoidPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const ctx = await getAbuluyanContext();
  if (!ctx.isAdmin) {
    if (ctx.isChurch) redirect(`${ABULUYAN_BASE}/lahat`);
    if (ctx.local) redirect(ABULUYAN_BASE);
    denyAbuluyan();
  }

  const { data } = await ctx.supabase.from("locals").select("id, name").order("name");
  const locals = (data ?? []) as { id: string; name: string }[];

  return (
    <>
      <PageHeader title="I-void ang Abuluyan" subtitle="Admin: pag-void ng maling naipadalang Abuluyan. Pinal ang void; church-wide Finance ang gagawa ng kapalit." />
      <Notice ok={ok} error={error} />
      <div className="mt-6">
        <Panel title="Pag-void">
          <AbuluyanVoidForm path={`${ABULUYAN_BASE}/void`} locals={locals} dateLabel="Linggo ng Abuluyan" />
        </Panel>
      </div>
    </>
  );
}
