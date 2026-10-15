"use client";

import { useState } from "react";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 06 to 21
const MINUTES = [0, 15, 30, 45];
const pad = (n: number) => String(n).padStart(2, "0");

// Pick a time by tapping an hour, then the minutes. Sends "HH:MM" as `name`.
export function TimePicker({ name, defaultValue = "09:00" }: { name: string; defaultValue?: string }) {
  const [h0, m0] = defaultValue.split(":").map(Number);
  const [hour, setHour] = useState(h0);
  const [minute, setMinute] = useState(MINUTES.includes(m0) ? m0 : 0);
  const chip = (on: boolean) =>
    `h-9 rounded-md text-sm font-medium tabular-nums ${
      on ? "bg-sky-700 text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
    }`;
  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={`${pad(hour)}:${pad(minute)}`} />
      <div className="grid grid-cols-8 gap-1">
        {HOURS.map((h) => (
          <button key={h} type="button" className={chip(h === hour)} onClick={() => setHour(h)}>
            {pad(h)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        {MINUTES.map((m) => (
          <button key={m} type="button" className={`${chip(m === minute)} w-14`} onClick={() => setMinute(m)}>
            :{pad(m)}
          </button>
        ))}
        <span className="ml-auto text-lg font-semibold tabular-nums">{pad(hour)}:{pad(minute)}</span>
      </div>
    </div>
  );
}
