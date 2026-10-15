"use client";

import { useState } from "react";

// A number picked with − and + buttons instead of typing.
// "hours" shows minutes as "3 h 30 min"; "minutes" shows "45 min".
export function Stepper({
  name,
  defaultValue,
  min = 0,
  max = 999,
  step = 1,
  show = "number",
  unit,
  label,
  less,
  more,
}: {
  name: string;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  show?: "number" | "hours" | "minutes";
  unit?: string;
  label: string;
  less: string;
  more: string;
}) {
  const [value, setValue] = useState(Math.min(Math.max(defaultValue, min), max));
  const display =
    show === "hours"
      ? [Math.floor(value / 60) && `${Math.floor(value / 60)} h`, value % 60 && `${value % 60} min`].filter(Boolean).join(" ") || "0 h"
      : show === "minutes"
        ? `${value} min`
        : String(value);
  const btn =
    "flex w-11 items-center justify-center text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300 focus-visible:-outline-offset-2";
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex h-[42px] w-fit items-stretch divide-x divide-slate-300 overflow-hidden rounded-md border border-slate-300 bg-white"
    >
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        className={btn}
        disabled={value <= min}
        onClick={() => setValue((v) => Math.max(v - step, min))}
        aria-label={`${less}: ${label}`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M5 12h14" />
        </svg>
      </button>
      <output aria-live="polite" className={`flex ${show === "hours" ? "min-w-32" : "min-w-24"} items-center justify-center gap-1 px-3 text-base font-semibold text-slate-900 tabular-nums`}>
        {display}
        {unit && <span className="text-sm font-normal text-slate-500">{unit}</span>}
      </output>
      <button
        type="button"
        className={btn}
        disabled={value >= max}
        onClick={() => setValue((v) => Math.min(v + step, max))}
        aria-label={`${more}: ${label}`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
