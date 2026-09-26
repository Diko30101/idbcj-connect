"use client";

import { btnGhostCls } from "@/components/portal/form-bits";

// Print button para sa Attendance Report (window.print; ang print CSS ay nasa pahina)
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={btnGhostCls}>
      I-print
    </button>
  );
}
