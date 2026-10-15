import Link from "next/link";
import { pageContext } from "@/lib/auth";
import { signOut } from "../login/actions";
import { LanguageSwitch } from "@/components/language-switch";
import { Sidebar } from "@/components/sidebar";
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

  const items = nav.filter((n) => n.roles.includes(staff.role)).map((n) => ({ href: n.href, label: t(n.key) }));

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar
        items={items}
        footer={
          <div className="flex flex-col gap-2">
            <Link href="/account" className="text-slate-700 hover:underline" title={t("changePassword")}>
              <span className="font-medium">{staff.full_name}</span>
              <span className="block text-xs text-slate-500">{t(`role_${staff.role}`)}</span>
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitch lang={lang} />
              <form action={signOut}>
                <button type="submit" className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
                  {t("signOut")}
                </button>
              </form>
            </div>
          </div>
        }
      />
      <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
