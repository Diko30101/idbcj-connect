"use server";

import { redirect } from "next/navigation";
import { getPortalContext } from "@/lib/portal";

// Tinatawag ito pagkatapos matagumpay na ma-update ang password sa client
// (via supabase.auth.updateUser). Dito i-cle-clear ang "must_change_password"
// flag (kung meron man) at i-redirect pabalik sa portal.
export async function completePasswordChange() {
  const { supabase, user } = await getPortalContext();
  await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);
  redirect("/portal");
}
