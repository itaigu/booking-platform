"use client";

import { useEffect } from "react";

// Every trip opens before printing, so the printout has all the bookings.
const openAll = () =>
  document.querySelectorAll<HTMLDetailsElement>("details[data-trip]").forEach((d) => (d.open = true));

// Opens the browser's print window for the manifest.
export function PrintButton({ label }: { label: string }) {
  // Also when printing with Ctrl+P / Cmd+P.
  useEffect(() => {
    window.addEventListener("beforeprint", openAll);
    return () => window.removeEventListener("beforeprint", openAll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        openAll();
        window.print();
      }}
      className="inline-flex h-11 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:h-9"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7 9V3h10v6M7 18H4v-7h16v7h-3M7 14h10v7H7z" />
      </svg>
      {label}
    </button>
  );
}
