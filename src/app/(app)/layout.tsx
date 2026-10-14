import Link from "next/link";
import { pageContext } from "@/lib/auth";
import { signOut } from "../login/actions";
import { LanguageSwitch } from "@/components/language-switch";
import type { Key } from "@/lib/i18n";
import type { Role } from "@/lib/auth";

const nav: { href: string; key: Key; roles: Role[] }[] = [
  { href: "/calendar", key: "calendar", roles: ["admin", "office", "dock", "crew"] },
  { href: "/bookings", key: "bookings", roles: ["admin", "office", "dock", "crew"] },
  { href: "/tours", key: "tours", roles: ["admin"] },
  { href: "/boats", key: "boats", roles: ["admin"] },
  { href: "/schedules", key: "schedules", roles: ["admin"] },
  { href: "/staff", key: "staff", roles: ["admin"] },
];

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { staff, lang, t } = await pageContext();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/calendar" className="font-semibold text-sky-800">
            ⛵ Cabo Sailing
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1">
            {nav
              .filter((n) => n.roles.includes(staff.role))
              .map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-sm hover:bg-slate-100">
                  {t(n.key)}
                </Link>
              ))}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-slate-500 sm:inline">
              {staff.full_name} · {t(`role_${staff.role}`)}
            </span>
            <LanguageSwitch lang={lang} />
            <form action={signOut}>
              <button type="submit" className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
