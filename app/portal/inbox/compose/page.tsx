import Link from "next/link";
import { requireRoles } from "@/lib/portal";
import { createLetter } from "../../actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, btnGhostCls, inputCls } from "@/components/portal/ui";

export default async function ComposeLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireRoles(["admin", "secretary"]);

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("status", "active")
    .order("full_name")
    .limit(1000);
  const list = (members ?? []) as { id: string; full_name: string | null }[];

  return (
    <>
      <PageHeader
        title="Sumulat ng liham"
        subtitle="Piliin ang mga tatanggap, tapos isulat ang mensahe."
        action={
          <Link href="/portal/inbox" className={btnGhostCls}>
            ← Inbox
          </Link>
        }
      />
      <Notice ok={ok} error={error} />

      <Panel>
        <form action={createLetter} className="grid gap-4">
          <Field label="Paksa">
            <input name="subject" required className={inputCls} />
          </Field>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-gray-700">Mga tatanggap</span>
            {list.length === 0 ? (
              <Empty>Walang aktibong member.</Empty>
            ) : (
              <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-md border border-gray-300 p-3 sm:grid-cols-2">
                {list.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" name="recipients" value={m.id} className="h-4 w-4 accent-emerald-700" />
                    {m.full_name || "(walang pangalan)"}
                  </label>
                ))}
              </div>
            )}
          </div>

          <Field label="Mensahe">
            <textarea name="body" required rows={6} className={inputCls} />
          </Field>

          <div>
            <button className={btnCls}>Ipadala</button>
          </div>
        </form>
      </Panel>
    </>
  );
}
