import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-2xl font-semibold">{children}</h1>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

// `group` renders a <div> instead of a <label>, for button controls like
// Stepper and TimePicker (a label would forward clicks to its first button).
export function Field({
  label,
  hint,
  children,
  group,
  className = "",
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  group?: boolean;
  className?: string;
}) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </Tag>
  );
}

// One part of a long form: title and help on the left, fields on the right.
export function FormSection({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-slate-200 pt-6 first:border-t-0 first:pt-0 lg:grid-cols-[13rem_1fr] lg:gap-8">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {desc && <p className="mt-1 text-xs leading-snug text-slate-500">{desc}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const inputCls =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={2} {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

const btn = {
  primary: "bg-sky-700 text-white hover:bg-sky-800",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: keyof typeof btn }) {
  return (
    <button
      {...props}
      className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${btn[variant]} ${className}`}
    />
  );
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: keyof typeof btn }) {
  return (
    <Link
      {...props}
      className={`inline-block rounded-md px-4 py-2 text-sm font-medium ${btn[variant]} ${className}`}
    />
  );
}

export function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <div
      className={`mb-4 rounded-md px-4 py-3 text-sm ${
        error ? "bg-red-50 text-red-800 ring-1 ring-red-200" : "bg-green-50 text-green-800 ring-1 ring-green-200"
      }`}
    >
      {error ?? ok}
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" | "sky" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    sky: "bg-sky-100 text-sky-800",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

// Blue "+ New …" button for the page title. Opens the "add" form by adding
// add=1 to the page link; shows "×" to close it again.
// `quiet` draws it white, for when the page has another main button.
export function AddToggle({
  href,
  open,
  label,
  closeLabel,
  quiet,
}: {
  href: string;
  open: boolean;
  label: string;
  closeLabel: string;
  quiet?: boolean;
}) {
  return (
    <Link
      href={open ? href : `${href}${href.includes("?") ? "&" : "?"}add=1`}
      title={open ? closeLabel : label}
      aria-label={open ? closeLabel : label}
      className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-md text-sm font-medium sm:h-9 ${
        open
          ? "w-11 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 sm:w-9"
          : quiet
            ? "min-w-11 border border-slate-300 bg-white px-3 text-slate-800 hover:bg-slate-50"
            : "min-w-11 bg-sky-700 px-3 text-white shadow-sm hover:bg-sky-800"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
        <path d={open ? "M6 6l12 12M18 6L6 18" : "M12 5v14M5 12h14"} />
      </svg>
      {!open && <span className="hidden sm:inline">{label}</span>}
    </Link>
  );
}

// A big tappable option (radio or checkbox inside a <label>).
export const choiceCard =
  "relative flex cursor-pointer flex-col gap-1 rounded-lg border border-slate-300 bg-white p-4 hover:border-slate-400 has-checked:border-sky-700 has-checked:bg-sky-50 has-checked:ring-1 has-checked:ring-sky-700 has-focus-visible:ring-2 has-focus-visible:ring-sky-500";

// Price box with "$" in front and "USD" after.
export function MoneyInput({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <div
      className={`flex h-[42px] w-full max-w-[14rem] items-stretch rounded-md border border-slate-300 bg-white focus-within:border-sky-600 focus-within:ring-1 focus-within:ring-sky-600 ${className}`}
    >
      <span className="flex items-center pl-3 text-slate-500">$</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min={0}
        placeholder="0.00"
        {...props}
        className="w-full min-w-0 [appearance:textfield] bg-transparent px-2 text-base text-slate-900 tabular-nums focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="flex items-center pr-3 text-xs font-medium text-slate-500">USD</span>
    </div>
  );
}
