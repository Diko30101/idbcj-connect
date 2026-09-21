"use server";

import { redirect } from "next/navigation";
import { getPortalContext } from "@/lib/portal";

export type ChangePasswordState = { error?: string } | null;

export async function changePassword(_prev: ChangePasswordState, fd: FormData): Promise<ChangePasswordState> {
  const { supabase, user } = await getPortalContext();
  const pw = String(fd.get("password") ?? "");
  const pw2 = String(fd.get("confirm") ?? "");

  if (pw.length < 8) return { error: "Kailangang hindi bababa sa 8 na karakter ang bagong password." };
  if (pw !== pw2) return { error: "Hindi magkapareho ang dalawang password." };

  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) {
    const msg = /different/i.test(error.message)
      ? "Dapat iba ang bagong password sa temporary password."
      : "Hindi na-save ang bagong password: " + error.message;
    return { error: msg };
  }

  await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);
  redirect("/portal");
}
