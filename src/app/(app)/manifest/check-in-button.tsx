"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setCheckIn } from "./actions";

// Check-in switch for one booking. It changes right away when tapped and
// saves in the background; if saving fails it goes back and shows why.
export function CheckInButton({
  bookingId,
  checkedIn,
  time,
  labels,
}: {
  bookingId: number;
  checkedIn: boolean;
  // When the group arrived, already written as a clock time.
  time: string | null;
  labels: { arrived: string; mark: string; undo: string };
}) {
  const [on, setOn] = useOptimistic(checkedIn);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    const next = !on;
    setError(null);
    startTransition(async () => {
      setOn(next);
      const res = await setCheckIn(bookingId, next);
      if (res.error) setError(res.error);
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        title={on ? labels.undo : labels.mark}
        className={`inline-flex h-11 min-w-28 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium ring-1 transition-colors sm:h-9 print:h-auto print:px-0 print:ring-0 ${
          on
            ? "bg-green-600 text-white ring-green-600 hover:bg-green-700"
            : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
        } ${pending ? "opacity-70" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {on ? <path d="M5 12l5 5L19 7" /> : <circle cx="12" cy="12" r="8" />}
        </svg>
        {on ? `${labels.arrived}${time && checkedIn ? ` ${time}` : ""}` : labels.mark}
      </button>
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
