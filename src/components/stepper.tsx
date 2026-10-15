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
}: {
  name: string;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  show?: "number" | "hours" | "minutes";
}) {
  const [value, setValue] = useState(Math.min(Math.max(defaultValue, min), max));
  const label =
    show === "hours"
      ? [Math.floor(value / 60) && `${Math.floor(value / 60)} h`, value % 60 && `${value % 60} min`].filter(Boolean).join(" ") || "0 h"
      : show === "minutes"
        ? `${value} min`
        : String(value);
  const btn =
    "flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-xl text-slate-800 hover:bg-slate-50 disabled:opacity-30";
  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value={value} />
      <button type="button" className={btn} disabled={value <= min} onClick={() => setValue(Math.max(value - step, min))} aria-label="−">
        −
      </button>
      <span className="min-w-20 text-center text-base font-semibold tabular-nums">{label}</span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => setValue(Math.min(value + step, max))} aria-label="+">
        +
      </button>
    </div>
  );
}
