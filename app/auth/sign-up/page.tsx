import { redirect } from "next/navigation";

// Public sign-up is closed. Accounts are created by the church admin only.
export default function Page() {
  redirect("/auth/login");
}
