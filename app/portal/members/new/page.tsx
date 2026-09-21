import Link from "next/link";
import { requireRoles } from "@/lib/portal";
import { PageHeader, Panel, btnGhostCls } from "@/components/portal/ui";
import { AddMemberForm } from "@/components/portal/add-member-form";

export default async function NewMemberPage() {
  await requireRoles(["admin", "secretary"]);

  return (
    <>
      <PageHeader
        title="Add Member"
        subtitle="Gagawa ng account na may username at temporary password. Papalitan ito ng member sa unang login."
        action={
          <Link href="/portal/members" className={btnGhostCls}>
            ← Members
          </Link>
        }
      />
      <Panel>
        <AddMemberForm />
      </Panel>
      <p className="mt-4 text-xs text-gray-500">
        Ang pangalan, category, at contact ng member ay personal na impormasyon. Kumuha muna ng pahintulot bago
        magtala, at para sa Young at Child, sa magulang o guardian.
      </p>
    </>
  );
}
