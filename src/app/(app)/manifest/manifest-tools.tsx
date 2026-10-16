"use client";

import { useRouter } from "next/navigation";

// The manifest view to show (each view is for a different job) and
// buttons to open or close every trip at once.
export function ManifestTools({
  view,
  views,
  hrefFor,
  labels,
}: {
  view: string;
  views: { id: string; label: string }[];
  // Link for each view, already built on the server.
  hrefFor: Record<string, string>;
  labels: { view: string; openAll: string; closeAll: string };
}) {
  const router = useRouter();
  const setAll = (open: boolean) =>
    document.querySelectorAll<HTMLDetailsElement>("details[data-trip]").forEach((d) => (d.open = open));
  const btn =
    "inline-flex h-11 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:h-9";

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        {labels.view}
        <select
          value={view}
          onChange={(e) => router.push(hrefFor[e.target.value])}
          className="h-11 rounded-md border border-slate-300 bg-white px-2 text-sm font-medium text-slate-900 sm:h-9"
        >
          {views.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
      </label>
      <div className="ml-auto flex gap-2">
        <button type="button" onClick={() => setAll(true)} className={btn}>{labels.openAll}</button>
        <button type="button" onClick={() => setAll(false)} className={btn}>{labels.closeAll}</button>
      </div>
    </div>
  );
}
