"use client";

import { useActionState, useState } from "react";
import { deleteMember, type DeleteMemberState } from "@/app/portal/members/member-actions";
import { btnDangerCls, btnGhostCls } from "@/components/portal/form-bits";

export function DeleteMemberButton({ id, name, disabled }: { id: string; name: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<DeleteMemberState, FormData>(deleteMember, null);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className={btnDangerCls} disabled={disabled} onClick={() => setConfirming(true)}>
        Burahin ang member
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="name" value={name} />
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <p className="text-sm text-gray-700">
        Sigurado ka bang burahin si <span className="font-semibold">{name}</span>? Pinal ito — mabubura ang kanyang
        login account at profile.
      </p>
      <div className="flex gap-2">
        <button type="submit" className={btnDangerCls} disabled={pending}>
          {pending ? "Binubura…" : "Oo, burahin"}
        </button>
        <button type="button" className={btnGhostCls} onClick={() => setConfirming(false)}>
          Kanselahin
        </button>
      </div>
    </form>
  );
}
