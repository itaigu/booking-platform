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

// Small square "+" button for the page title. Opens the "add" form by adding
// ?add=1 to the page link; shows "×" to close it again.
export function AddToggle({ href, open, label }: { href: string; open: boolean; label: string }) {
  return (
    <Link
      href={open ? href : `${href}?add=1`}
      title={label}
      aria-label={label}
      className={`flex h-10 w-10 items-center justify-center rounded-md text-2xl leading-none ${
        open ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" : "bg-sky-700 text-white hover:bg-sky-800"
      }`}
    >
      {open ? "×" : "+"}
    </Link>
  );
}
