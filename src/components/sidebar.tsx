"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

export type NavItem = { href: string; label: string };

// Simple line icons, one per section.
const icons: Record<string, ReactNode> = {
  "/calendar": <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />,
  "/bookings": <path d="M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4" />,
  "/tours": <path d="M12 3v14M12 4l7 10h-7M5 14h7M3 18c2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 6 0" />,
  "/boats": <path d="M3 15h18l-3 5H6zM12 4v11M12 5l6 8h-6" />,
  "/schedules": <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" />,
  "/staff": <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M17 3a4 4 0 0 1 0 8M19 15c2 1 3 3 3 6" />,
};

// Menu down the left side. On phones it hides behind a ☰ button.
export function Sidebar({ items, footer }: { items: NavItem[]; footer: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Phone top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menu"
          className="flex h-9 w-9 items-center justify-center rounded-md text-xl hover:bg-slate-100"
        >
          ☰
        </button>
        <Link href="/calendar" className="font-semibold text-sky-800">⛵ Cabo Sailing</Link>
      </div>

      {open && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/calendar" onClick={() => setOpen(false)} className="text-lg font-semibold text-sky-800">
            ⛵ Cabo Sailing
          </Link>
          <button type="button" onClick={() => setOpen(false)} aria-label="×" className="text-2xl text-slate-500 lg:hidden">
            ×
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {items.map((it) => {
            const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                  active ? "bg-sky-50 text-sky-800" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  {icons[it.href]}
                </svg>
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-4 text-sm">{footer}</div>
      </aside>
    </>
  );
}
