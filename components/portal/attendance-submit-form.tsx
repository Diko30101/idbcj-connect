"use client";

import { submitAttendanceRecord } from "@/app/portal/attendance-record/actions";
import { btnCls } from "./form-bits";

// I-submit ang draft na pagdalo sa Finance Ministry (may kumpirmasyon,
// dahil naka-lock na ito pagkatapos).
export function AttendanceSubmitForm({
  localId,
  serviceDate,
  serviceType,
  count,
}: {
  localId: string;
  serviceDate: string;
  serviceType: string;
  count: number;
}) {
  return (
    <form
      action={submitAttendanceRecord}
      onSubmit={(e) => {
        if (
          !confirm(`I-submit ang pagdalo (${count} ang naitala)? Hindi na ito pwedeng baguhin pagkatapos.`)
        ) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="local_id" value={localId} />
      <input type="hidden" name="service_date" value={serviceDate} />
      <input type="hidden" name="service_type" value={serviceType} />
      <button type="submit" className={btnCls}>
        I-submit sa Finance Ministry
      </button>
    </form>
  );
}
