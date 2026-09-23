import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalAccess, isStaff, fmtDate } from "@/lib/portal";
import { replyToLetter } from "../../actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, btnGhostCls, inputCls } from "@/components/portal/ui";

export default async function LetterThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const { supabase, profile } = await requirePortalAccess();
  const staff = isStaff(profile.role);

  const { data: letter } = await supabase
    .from("letters")
    .select("id, subject, created_at, created_by, profiles!letters_created_by_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!letter) notFound();

  const [messages, myRecipient, recipients] = await Promise.all([
    supabase
      .from("letter_messages")
      .select("id, body, created_at, author_id, profiles!letter_messages_author_id_fkey(full_name)")
      .eq("letter_id", id)
      .order("created_at", { ascending: true })
      .limit(500),
    supabase.from("letter_recipients").select("id, read_at").eq("letter_id", id).eq("profile_id", profile.id).maybeSingle(),
    staff
      ? supabase.from("letter_recipients").select("profile_id, read_at, profiles!letter_recipients_profile_id_fkey(full_name)").eq("letter_id", id)
      : Promise.resolve({ data: null as any[] | null }),
  ]);

  // I-mark na nabasa kapag binuksan ng tatanggap
  if (myRecipient.data && !myRecipient.data.read_at) {
    await supabase.from("letter_recipients").update({ read_at: new Date().toISOString() }).eq("id", myRecipient.data.id);
  }

  const thread = (messages.data ?? []) as any[];

  return (
    <>
      <PageHeader
        title={(letter as any).subject}
        subtitle={`Mula kay ${(letter as any).profiles?.full_name ?? "Staff"} · ${fmtDate((letter as any).created_at)}`}
        action={
          <Link href="/portal/inbox" className={btnGhostCls}>
            ← Inbox
          </Link>
        }
      />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            {thread.length === 0 ? (
              <Empty>Walang mensahe.</Empty>
            ) : (
              <ul className="space-y-4">
                {thread.map((m) => (
                  <li key={m.id} className="rounded-lg border border-gray-100 bg-slate-50 p-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-800">{m.profiles?.full_name ?? "Miyembro"}</span>
                      <span className="text-gray-400">{fmtDate(m.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-line text-sm text-gray-700">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Sumagot">
            <form action={replyToLetter} className="grid gap-3">
              <input type="hidden" name="letter_id" value={id} />
              <Field label="Mensahe">
                <textarea name="body" required rows={4} className={inputCls} />
              </Field>
              <div>
                <button className={btnCls}>Ipadala</button>
              </div>
            </form>
          </Panel>
        </div>

        {staff && (
          <div>
            <Panel title="Mga tatanggap">
              {((recipients.data ?? []) as any[]).length === 0 ? (
                <Empty>Walang tatanggap.</Empty>
              ) : (
                <ul className="space-y-2 text-sm">
                  {((recipients.data ?? []) as any[]).map((r) => (
                    <li key={r.profile_id} className="flex items-center justify-between gap-2">
                      <span className="text-gray-800">{r.profiles?.full_name ?? "(walang pangalan)"}</span>
                      <span className={r.read_at ? "text-xs text-emerald-700" : "text-xs text-gray-400"}>
                        {r.read_at ? `Nabasa ${fmtDate(r.read_at)}` : "Hindi pa nabasa"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}