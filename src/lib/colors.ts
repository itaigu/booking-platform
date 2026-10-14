// Calendar colors a boat can have. Class names are written out in full so
// Tailwind includes them in the build.
export const boatColors = {
  sky: { box: "bg-sky-100 border-sky-500 text-sky-950", dot: "bg-sky-500", head: "bg-sky-600 text-white" },
  emerald: { box: "bg-emerald-100 border-emerald-500 text-emerald-950", dot: "bg-emerald-500", head: "bg-emerald-600 text-white" },
  amber: { box: "bg-amber-100 border-amber-500 text-amber-950", dot: "bg-amber-500", head: "bg-amber-500 text-white" },
  rose: { box: "bg-rose-100 border-rose-500 text-rose-950", dot: "bg-rose-500", head: "bg-rose-600 text-white" },
  violet: { box: "bg-violet-100 border-violet-500 text-violet-950", dot: "bg-violet-500", head: "bg-violet-600 text-white" },
  orange: { box: "bg-orange-100 border-orange-500 text-orange-950", dot: "bg-orange-500", head: "bg-orange-600 text-white" },
  teal: { box: "bg-teal-100 border-teal-500 text-teal-950", dot: "bg-teal-500", head: "bg-teal-600 text-white" },
  slate: { box: "bg-slate-200 border-slate-500 text-slate-900", dot: "bg-slate-500", head: "bg-slate-600 text-white" },
} as const;

export type BoatColor = keyof typeof boatColors;

export function colorOf(c: string | null | undefined) {
  return boatColors[(c as BoatColor) in boatColors ? (c as BoatColor) : "sky"];
}
