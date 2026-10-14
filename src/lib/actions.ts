import { redirect } from "next/navigation";
import { getStaff, type Role } from "./auth";
import { getLang, translateError } from "./i18n";
import { createClient } from "./supabase/server";

// Shared setup for every form action: checks the role, returns the database
// client and a `fail` helper that goes back to the form with the error shown.
export async function actionContext(back: string, allowed: Role[]) {
  const staff = await getStaff();
  const lang = await getLang(staff.language);
  const go = (path: string, params: Record<string, string>) => {
    const sep = path.includes("?") ? "&" : "?";
    redirect(`${path}${sep}${new URLSearchParams(params)}`);
  };
  const fail = (message: string): never => go(back, { error: translateError(message, lang) }) as never;
  if (!allowed.includes(staff.role)) fail("row-level security");
  const supabase = await createClient();
  return { supabase, staff, lang, fail, go };
}

export function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function strOrNull(form: FormData, key: string) {
  return str(form, key) || null;
}

export function num(form: FormData, key: string) {
  const v = str(form, key);
  return v === "" ? null : Number(v);
}
