"use client";

import { useState } from "react";
import { btnCls, btnGhostCls } from "./form-bits";

type DecideFn = (fd: FormData) => void | Promise<void>;

// Aprubahan / Kailangan ng ayos: church-wide Finance lang, para sa naka-"submitted" na record.
// Ang "Kailangan ng ayos" ay nagbabalik ng record sa draft (maiedit ulit ng Local) kasama ang tala kung bakit —
// tinutularan nito ang cycle na umiiral na sa Attendance (submit -> desisyon -> bumalik sa local).
export function DecideButtons({ id, path, action }: { id: string; path: string; action: DecideFn }) {
  const [showNote, setShowNote] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        action={action}
        onSubmit={(e) => {
          if (!window.confirm("Aprubahan ang naisumiteng record na ito?")) e.preventDefault();
        }}
      >
        <input type="hidden" name="path" value={path} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="approved" />
        <button type="submit" className={btnCls}>
          Aprubahan
        </button>
      </form>
      {!showNote ? (
        <button type="button" className={btnGhostCls} onClick={() => setShowNote(true)}>
          Kailangan ng ayos
        </button>
      ) : (
        <form
          action={action}
          onSubmit={(e) => {
            if (!window.confirm("Ibabalik ito sa Local bilang draft para ayusin. Magpatuloy?")) e.preventDefault();
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="path" value={path} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="needs_fix" />
          <input
            type="text"
            name="notes"
            placeholder="Bakit kailangan ng ayos? (makikita ng Local)"
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
            maxLength={500}
            required
          />
          <button type="submit" className={btnCls}>
            Ipadala
          </button>
          <button type="button" className={btnGhostCls} onClick={() => setShowNote(false)}>
            Kanselahin
          </button>
        </form>
      )}
    </div>
  );
}

// Banner na nagpapakita ng dahilan kung bakit ibinalik ang record sa draft para ayusin.
export function NeedsFixBanner({ notes }: { notes: string }) {
  return (
    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5">
      Kailangan ng ayos: {notes}
    </p>
  );
}
