"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n";
import { fmtClock } from "@/lib/format";

const ROWS = [
  ["morning", [5, 6, 7, 8, 9, 10, 11]],
  ["afternoon", [12, 13, 14, 15, 16, 17]],
  ["evening", [18, 19, 20, 21, 22]],
] as const;
const MINUTES = [0, 15, 30, 45];
const pad = (n: number) => String(n).padStart(2, "0");

type Labels = { morning: string; afternoon: string; evening: string; minutes: string };

// Pick a time by tapping an hour, then the minutes. Sends "HH:MM" (24h) as `name`.
export function TimePicker({
  name,
  defaultValue = "09:00",
  lang,
  labels,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  lang: Lang;
  labels: Labels;
  /** Called with minutes since midnight. */
  onChange?: (minutes: number) => void;
}) {
  const [h0, m0] = defaultValue.split(":").map(Number);
  const [hour, setHourState] = useState(h0 >= 5 && h0 <= 22 ? h0 : 9);
  const [minute, setMinuteState] = useState(MINUTES.includes(m0) ? m0 : 0);
  const setHour = (h: number) => {
    setHourState(h);
    onChange?.(h * 60 + minute);
  };
  const setMinute = (m: number) => {
    setMinuteState(m);
    onChange?.(hour * 60 + m);
  };
  const chip = (on: boolean) =>
    `h-11 rounded-md text-sm font-medium tabular-nums sm:h-9 ${
      on ? "bg-sky-700 text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
    }`;
  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={`${pad(hour)}:${pad(minute)}`} />
      <output aria-live="polite" className="text-2xl font-semibold text-slate-900 tabular-nums">
        {fmtClock(hour * 60 + minute, lang)}
      </output>
      {ROWS.map(([key, hours]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-medium text-slate-500">{labels[key]}</span>
          <div role="group" aria-label={labels[key]} className="grid flex-1 grid-cols-7 gap-1">
            {hours.map((h) => (
              <button
                key={h}
                type="button"
                aria-label={fmtClock(h * 60, lang, true)}
                aria-pressed={h === hour}
                className={chip(h === hour)}
                onClick={() => setHour(h)}
              >
                {h % 12 || 12}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-medium text-slate-500">{labels.minutes}</span>
        <div role="group" aria-label={labels.minutes} className="grid flex-1 grid-cols-4 gap-1 sm:max-w-[16rem]">
          {MINUTES.map((m) => (
            <button key={m} type="button" aria-pressed={m === minute} className={chip(m === minute)} onClick={() => setMinute(m)}>
              :{pad(m)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
