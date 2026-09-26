import { TulongFinanceWorkspace } from "@/app/tulong-financial/finance/workspace";

export default async function TulongFinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; status?: string }>;
}) {
  const sp = await searchParams;
  return <TulongFinanceWorkspace returnTo="/portal/finance/tulong-financial" sp={sp} />;
}
