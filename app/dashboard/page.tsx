import { redirect } from "next/navigation";

// Ang lumang dashboard ay pinalitan ng bagong Member Portal.
export default function DashboardPage() {
  redirect("/portal");
}
