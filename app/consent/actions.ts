"use server";

import { redirect } from "next/navigation";
import { CONSENT_VERSION, getPortalContext } from "@/lib/portal";

export async function acceptConsent(formData: FormData) {
  const { supabase, user } = await getPortalContext();
  if (formData.get("agree") !== "on") {
    redirect("/consent?error=" + encodeURIComponent("Kailangang lagyan ng tsek ang pagsang-ayon para magpatuloy."));
  }
  const { error } = await supabase
    .from("profiles")
    .update({ consent_at: new Date().toISOString(), consent_version: CONSENT_VERSION })
    .eq("id", user.id);
  if (error) {
    redirect("/consent?error=" + encodeURIComponent("May problema sa pag-save. Subukan ulit."));
  }
  redirect("/portal");
}
