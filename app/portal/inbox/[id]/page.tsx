import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalAccess, isStaff, fmtDate } from "@/lib/portal";
import { fmtPeso } from "@/lib/finance";
import { Empty, Notice, PageHeader, Panel, btnGhostCls } from "@/components/portal/ui";
import { LetterBody } from "@/components/portal/letter-body";
import {
  decideLoanRequest,
  decideUsernameRequest,
} from "@/app/portal/finance/tulong-financial/actions";

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

  // Tulong Financial approval: kung ang letter na ito ay nakaugnay sa isang
  // kahilingan ng hiram o username, ipakita ang detalye at pindutan ng apruba.
  const { data: reqLink } = await supabase
    .from("tulong_request_letters")
    .select("request_kind, request_id")
    .eq("letter_id", id)
    .maybeSingle();

  let approval: {
    kind: string;
    requestId: string;
    memberName: string;
    detail: string;
    status: string;
    awaiting: boolean;
  } | null = null;

  if (reqLink) {
    const kind = (reqLink as any).request_kind as string;
    const requestId = (reqLink as any).request_id as string;
    if (kind === "loan") {
      const { data: r } = await supabase
        .from("tulong_loan_requests")
        .select("id, amount, target_return_date, notes, status, member_id")
        .eq("id", requestId)
        .maybeSingle();
      if (r) {
        const { data: m } = await supabase.from("members").select("full_name").eq("id", (r as any).member_id).maybeSingle();
        approval = {
          kind,
          requestId,
          memberName: (m as any)?.full_name ?? "—",
          detail: `${fmtPeso(Number((r as any).amount))}${(r as any).target_return_date ? ` · target balik ${(r as any).target_return_date}` : ""}${(r as any).notes ? ` · ${(r as any).notes}` : ""}`,
          status: (r as any).status,
          awaiting: (r as any).status === "sent",
        };
      }
    } else if (kind === "username") {
      const { data: r } = await supabase
        .from("tulong_username_requests")
        .select("id, username, status, member_id")
        .eq("id", requestId)
        .maybeSingle();
      if (r) {
        const { data: m } = await supabase.from("members").select("full_name").eq("id", (r as any).member_id).maybeSingle();
        approval = {
          kind,
          requestId,
          memberName: (m as any)?.full_name ?? "—",
          detail: `Iminungkahing username: @${(r as any).username}`,
          status: (r as any).status,
          awaiting: (r as any).status === "pending",
        };
      }
    }
  }

  const isAdmin = profile.role === "admin";
  const decideAction = approval?.kind === "loan" ? decideLoanRequest : decideUsernameRequest;

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

      {approval && (
        <Panel
          title={approval.kind === "loan" ? "Humihingi ng Tulong Financial — desisyon ng admin" : "Kahilingan ng username — desisyon ng admin"}
        >
          <div className="text-sm text-gray-700">
            <p>
              <strong>{approval.memberName}</strong> · {approval.detail}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Katayuan:{" "}
              {approval.status === "approved"
                ? "Aprubado na"
                : approval.status === "rejected"
                  ? "Tinanggihan na"
                  : approval.kind === "loan"
                    ? "Naghihintay ng apruba ng admin"
                    : "Naghihintay ng apruba ng admin"}
            </p>
          </div>
          {approval.awaiting && isAdmin && (
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={decideAction}>
                <input type="hidden" name="letter_id" value={id} />
                <input type="hidden" name="request_id" value={approval.requestId} />
                <input type="hidden" name="decision" value="approve" />
                <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                  Aprubahan
                </button>
              </form>
              <form action={decideAction}>
                <input type="hidden" name="letter_id" value={id} />
                <input type="hidden" name="request_id" value={approval.requestId} />
                <input type="hidden" name="decision" value="reject" />
                <button className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                  Tanggihan
                </button>
              </form>
            </div>
          )}
          {approval.awaiting && !isAdmin && (
            <p className="mt-2 text-xs text-gray-400">Ang admin lang ang maaaring mag-apruba o tumanggi.</p>
          )}
        </Panel>
      )}

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
                    <LetterBody body={m.body} />
                  </li>
                ))}
              </ul>
            )}
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
