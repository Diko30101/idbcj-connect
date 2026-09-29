import Link from "next/link";
import { getAbuluyanContext, denyAbuluyan } from "@/lib/portal";
import { isValidMonth } from "@/lib/abuluyan";
import { currentMonthPH, todayInTimezone } from "@/lib/finance";
import { GIVING_BASE } from "@/lib/giving";

// Karaniwang paghahanda ng bawat pahina ng Pasalamat (Monthly -- kasama na ang dating Extra,
// Taunang, Anniversary -- hiwalay na pahina bawat isa, kagaya ng Abuluyan/Ambagan/Tulong). Iisa
// lang dito ang
// lohika ng pagpili ng local (church-wide vs sariling local), buwan, at "path" na ipinapasa sa
// bawat action form (target ng redirect pagkatapos mag-save -- tingnan ang safeGivingPath sa
// lib/giving.ts, na dapat ding may listahan ng bagong landas na ito).
export type PasalamatLocalRow = { id: string; name: string; timezone: string };

export async function loadPasalamatPage(searchParams: { local?: string; buwan?: string }, basePath: string) {
  const ctx = await getAbuluyanContext();
  if (!ctx.isChurch && !ctx.local) denyAbuluyan();
  const { supabase } = ctx;

  let locals: PasalamatLocalRow[];
  if (ctx.isChurch) {
    const { data } = await supabase.from("locals").select("id, name, timezone").order("name");
    locals = (data ?? []) as PasalamatLocalRow[];
  } else {
    locals = [{ id: ctx.local!.id, name: ctx.local!.name, timezone: ctx.local!.timezone }];
  }
  const selected = locals.find((l) => l.id === searchParams.local) ?? locals.find((l) => l.id === ctx.local?.id) ?? locals[0];
  const buwan = searchParams.buwan && isValidMonth(searchParams.buwan) ? searchParams.buwan : currentMonthPH();
  const pagePath = (b: string, localId?: string) => `${basePath}?buwan=${b}${ctx.isChurch && localId ? `&local=${localId}` : ""}`;
  const path = pagePath(buwan, ctx.isChurch ? selected?.id : undefined);
  const defaultDate = selected ? todayInTimezone(selected.timezone) : "";

  return { ctx, locals, selected, buwan, path, pagePath, defaultDate };
}

// Hanggahan ng petsa (min/max) sa loob ng napiling buwan -- ginagamit ng grid ng Monthly Pasalamat
// (bawat hanay ay may sariling Petsa pero dapat nasa loob ng buwang napili, gaya ng Taunang at
// Anniversary Pasalamat na naka-scope na rin sa buwan).
export function monthBounds(buwan: string): { min: string; max: string } {
  const y = Number(buwan.slice(0, 4));
  const m = Number(buwan.slice(5, 7));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // araw 0 ng susunod na buwan = huling araw ng buwang ito
  return { min: `${buwan}-01`, max: `${buwan}-${String(lastDay).padStart(2, "0")}` };
}

// Petsa na panimula sa grid: ngayon kung nasa loob ng buwang napili, kung hindi ay unang araw nito.
export function monthDefaultDate(buwan: string, todayIso: string): string {
  const { min, max } = monthBounds(buwan);
  return todayIso >= min && todayIso <= max ? todayIso : min;
}

// Mga pindutang pill sa itaas ng bawat pahina ng Pasalamat, papunta sa magkapatid na pahina
// (Taunang, Anniversary) -- karagdagan lang sa submenu ng sidebar, para mabilis ding makalipat
// habang naka-focus sa isang buwan/local. Ang Monthly (/pasalamat, kasama na ang dating Extra) ay
// hindi kasama rito dahil doon na nakatayo ang mismong pahina kung saan ipinapakita ang mga tab na
// ito -- gaya rin ng ibang "magkapatid na pahina" na tab sa app na hindi isinasama ang sarili nito.
const PASALAMAT_TABS: { href: string; label: string }[] = [
  { href: `${GIVING_BASE}/pasalamat/annual`, label: "Taunang" },
  { href: `${GIVING_BASE}/pasalamat/anniversary`, label: "Anniversary" },
];

export function PasalamatTabs({ active, buwan, localId }: { active: string; buwan: string; localId?: string }) {
  const q = `?buwan=${buwan}${localId ? `&local=${localId}` : ""}`;
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {PASALAMAT_TABS.map((t) => (
        <Link
          key={t.href}
          href={`${t.href}${q}`}
          className={`rounded-full border px-3 py-1 text-sm font-medium ${
            t.href === active
              ? "border-emerald-600 bg-emerald-50 text-emerald-800"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function PasalamatLocalSwitcher({
  locals,
  selected,
  pagePath,
  buwan,
  show,
}: {
  locals: PasalamatLocalRow[];
  selected?: PasalamatLocalRow;
  pagePath: (b: string, localId?: string) => string;
  buwan: string;
  show: boolean;
}) {
  if (!show || locals.length <= 1) return null;
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {locals.map((l) => (
        <Link
          key={l.id}
          href={pagePath(buwan, l.id)}
          className={`rounded-full border px-3 py-1 text-sm font-medium ${
            l.id === selected?.id
              ? "border-emerald-600 bg-emerald-50 text-emerald-800"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          {l.name}
        </Link>
      ))}
    </div>
  );
}
