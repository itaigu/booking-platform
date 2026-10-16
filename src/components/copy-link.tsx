"use client";

import { useState } from "react";

// A payment link with a button to copy it, and one to send it by WhatsApp.
export function CopyLink({
  url,
  phone,
  message,
  labels,
}: {
  url: string;
  phone: string | null;
  message: string;
  labels: { copy: string; copied: string; whatsApp: string };
}) {
  const [copied, setCopied] = useState(false);
  const digits = phone?.replace(/\D/g, "") ?? "";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full min-w-0 rounded-md border sm:w-auto sm:flex-1 border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-700"
      />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
      >
        {copied ? labels.copied : labels.copy}
      </button>
      {digits && (
        <a
          href={`https://wa.me/${digits}?text=${encodeURIComponent(`${message}: ${url}`)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-green-700 ring-1 ring-green-300 hover:bg-green-50"
        >
          {labels.whatsApp}
        </a>
      )}
    </div>
  );
}
