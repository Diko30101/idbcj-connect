import Link from "next/link";
import type { ReactNode } from "react";
import { btnCls } from "./form-bits";
import { STATUS_LABEL, ROLE_LABEL, type MemberStatus, type Role } from "@/lib/portal";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {(title || subtitle) && (
        <div className="px-5 py-3 border-b border-gray-100">
          {title && <h2 className="font-semibold text-gray-800">{title}</h2>}
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Notice({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div
      role="status"
      className={`mb-5 rounded-lg border px-4 py-3 text-sm font-medium ${
        error
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {error || ok}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-gray-500 py-4 text-center">{children}</p>;
}

export function StatusBadge({ status }: { status: MemberStatus }) {
  const cls =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : status === "visitor"
        ? "bg-amber-50 text-amber-700 border-amber-100"
        : "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className="inline-block rounded-full border border-purple-100 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

// Ang mga class at Field ay nasa form-bits.tsx para magamit din sa client components
export { inputCls, btnCls, btnGhostCls, btnDangerCls, Field } from "./form-bits";
export function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={btnCls}>
      {children}
    </Link>
  );
}
