"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type NavItem = { href: string; label: string; group: "ops" | "setup" };

// Simple line icons, one per section.
const icons: Record<string, ReactNode> = {
  "/calendar": <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />,
  "/bookings": <path d="M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4" />,
  "/tours": <path d="M12 3v14M12 4l7 10h-7M5 14h7M3 18c2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 6 0" />,
  "/boats": <path d="M3 15h18l-3 5H6zM12 4v11M12 5l6 8h-6" />,
  "/schedules": <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" />,
  "/commissions": <path d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.4 4.5 3.2-2 3.3-4.5 3.3-4.5-1.3-4.5-3" />,
  "/hotels": <path d="M4 21V4h11v17M15 9h5v12M2 21h20M8 8h3M8 12h3M8 16h3" />,
  "/staff": <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M17 3a4 4 0 0 1 0 8M19 15c2 1 3 3 3 6" />,
};

// Pages that belong to a menu item without starting with its link.
const also: Record<string, string[]> = { "/calendar": ["/departures"] };

function Logo({ size }: { size: "sm" | "md" }) {
  return (
    <span className={`grid place-items-center rounded-lg bg-sky-700 text-white ${size === "md" ? "h-8 w-8" : "h-7 w-7"}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 15h18l-3 5H6zM12 4v11M12 5l6 8h-6" />
      </svg>
    </span>
  );
}

// Menu down the left side. On phones it hides behind a menu button.
export function Sidebar({
  items,
  groupLabels,
  labels,
  footer,
}: {
  items: NavItem[];
  groupLabels: Record<NavItem["group"], string>;
  labels: { open: string; close: string; nav: string };
  footer: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const openBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  // While the phone menu is open: no page scrolling behind it, Esc closes it,
  // and focus moves into the menu (and back to the menu button after).
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const opener = openBtn.current;
    return () => {
      html.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [open]);

  // If the screen gets wide enough for the fixed sidebar (rotating a tablet),
  // close the phone menu so the page can scroll again.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 64rem)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const grouped = new Set(items.map((i) => i.group)).size > 1;
  const groups = (["ops", "setup"] as const).map((g) => ({ g, list: items.filter((i) => i.group === g) })).filter((x) => x.list.length);

  return (
    <>
      {/* Phone top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-2 lg:hidden">
        <button
          ref={openBtn}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={labels.open}
          aria-expanded={open}
          aria-controls="app-sidebar"
          className="flex h-11 w-11 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/calendar" className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="text-[15px] font-semibold text-slate-900">Cabo Sailing</span>
        </Link>
      </div>

      {open && <div aria-hidden className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0 transition-transform" : "-translate-x-full transition-[translate,visibility] max-lg:invisible"
        }`}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 px-4">
          <Link href="/calendar" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
            <Logo size="md" />
            <span className="text-[15px] font-semibold text-slate-900">Cabo Sailing</span>
          </Link>
          <button
            ref={closeBtn}
            type="button"
            onClick={() => setOpen(false)}
            aria-label={labels.close}
            className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <nav aria-label={labels.nav} className="flex flex-1 flex-col overflow-y-auto px-3 py-3">
          {groups.map(({ g, list }) => (
            <div key={g} className="flex flex-col gap-0.5 not-first:mt-4">
              {grouped && (
                <div className="px-3 pt-1 pb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  {groupLabels[g]}
                </div>
              )}
              {list.map((it) => {
                const active = [it.href, ...(also[it.href] ?? [])].some(
                  (h) => pathname === h || pathname.startsWith(`${h}/`),
                );
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center gap-3 rounded-md px-3 py-3 text-sm lg:py-2 ${
                      active
                        ? "bg-sky-50 font-semibold text-sky-900 before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-r before:bg-sky-600"
                        : "font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-5 w-5 shrink-0 ${active ? "text-sky-600" : "text-slate-400 group-hover:text-slate-600"}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      {icons[it.href]}
                    </svg>
                    {it.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4 text-sm">{footer}</div>
      </aside>
    </>
  );
}
