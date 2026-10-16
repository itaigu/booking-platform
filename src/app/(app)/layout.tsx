import Link from "next/link";
import { pageContext } from "@/lib/auth";
import { signOut } from "../login/actions";
import { LanguageSwitch } from "@/components/language-switch";
import { Sidebar } from "@/components/sidebar";
import type { Key } from "@/lib/i18n";
import type { Role } from "@/lib/auth";

const nav: { href: string; key: Key; roles: Role[]; group: "ops" | "setup" }[] = [
  { href: "/calendar", key: "calendar", roles: ["admin", "office", "dock", "crew"], group: "ops" },
  { href: "/bookings", key: "bookings", roles: ["admin", "office", "dock"], group: "ops" },
  { href: "/commissions", key: "commissions", roles: ["admin", "office"], group: "ops" },
  { href: "/tours", key: "tours", roles: ["admin"], group: "setup" },
  { href: "/boats", key: "boats", roles: ["admin"], group: "setup" },
  { href: "/schedules", key: "schedules", roles: ["admin"], group: "setup" },
  { href: "/hotels", key: "hotels", roles: ["admin"], group: "setup" },
  { href: "/staff", key: "staff", roles: ["admin"], group: "setup" },
];

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { staff, lang, t } = await pageContext();

  const items = nav
    .filter((n) => n.roles.includes(staff.role))
    .map((n) => ({ href: n.href, label: t(n.key), group: n.group }));
  const initials = staff.full_name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar
        items={items}
        groupLabels={{ ops: t("navOps"), setup: t("navSetup") }}
        labels={{ open: t("openMenu"), close: t("closeMenu"), nav: t("mainMenu") }}
        footer={
          <>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800">
                {initials}
              </span>
              <Link href="/account" title={t("changePassword")} className="min-w-0 flex-1 rounded-md hover:underline">
                <span className="block truncate text-sm font-medium text-slate-900">{staff.full_name}</span>
                <span className="block truncate text-xs text-slate-500">{t(`role_${staff.role}`)}</span>
              </Link>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <LanguageSwitch lang={lang} />
              <form action={signOut}>
                <button
                  type="submit"
                  className="min-h-11 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 lg:min-h-8"
                >
                  {t("signOut")}
                </button>
              </form>
            </div>
          </>
        }
      />
      <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
