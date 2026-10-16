"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";

// The date title in the calendar toolbar. Clicking or tapping it opens the
// phone's or browser's own date picker and jumps straight to the chosen day.
export function DateJump({
  date,
  week,
  label,
  shortLabel,
  ariaLabel,
  path = "/calendar",
}: {
  date: string;
  week: boolean;
  label: string;
  shortLabel: string;
  ariaLabel: string;
  // The page to open the chosen day on.
  path?: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const openPicker = (el: HTMLInputElement | null) => {
    try {
      el?.showPicker();
    } catch {
      // Older browsers open their picker on tap by themselves.
    }
  };
  return (
    <div className="relative inline-flex rounded-md hover:bg-slate-100">
      <button
        type="button"
        aria-label={`${ariaLabel}: ${label}`}
        onClick={() => openPicker(ref.current)}
        className="inline-flex h-11 items-center gap-1 rounded-md px-2 text-base font-semibold text-slate-900 sm:h-9 sm:text-lg"
      >
        <span className="sm:hidden">{shortLabel}</span>
        <span className="hidden sm:inline">{label}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {/* Invisible date field on top of the title, so a tap opens the picker
          on phones too. Keyboard users use the button underneath. */}
      <input
        ref={ref}
        type="date"
        tabIndex={-1}
        aria-hidden
        defaultValue={date}
        onClick={(e) => openPicker(e.currentTarget)}
        onChange={(e) => {
          const v = e.target.value;
          if (/^\d{4}-\d{2}-\d{2}$/.test(v)) router.push(`${path}?date=${v}${week ? "&view=week" : ""}`);
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
