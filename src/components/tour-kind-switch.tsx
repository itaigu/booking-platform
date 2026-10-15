"use client";

import { useState, type ReactNode } from "react";
import { choiceCard } from "./ui";

type Kind = "private" | "shared";

// The "Private charter / Shared tour" choice. Only the fields for the chosen
// type are shown and sent; the others are switched off.
export function TourKindSwitch({
  defaultKind,
  legend,
  options,
  sections,
}: {
  defaultKind: Kind;
  legend: string;
  options: { value: Kind; title: string; desc: string }[];
  sections: Record<Kind, ReactNode>;
}) {
  const [kind, setKind] = useState(defaultKind);
  return (
    <div className="flex flex-col gap-5 sm:col-span-2">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">{legend}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((o) => (
            <label key={o.value} className={choiceCard}>
              <input
                type="radio"
                name="kind"
                value={o.value}
                checked={kind === o.value}
                onChange={() => setKind(o.value)}
                className="sr-only"
              />
              <span className="font-semibold text-slate-900">{o.title}</span>
              <span className="text-xs leading-snug text-slate-600">{o.desc}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {(["private", "shared"] as const).map((k) => (
        <fieldset key={k} disabled={kind !== k} hidden={kind !== k} className="min-w-0">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{sections[k]}</div>
        </fieldset>
      ))}
    </div>
  );
}
