import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { getLang, translator, type Lang, type T } from "./i18n";

export type Role = "admin" | "office" | "dock" | "crew";

export type Staff = {
  id: string;
  full_name: string;
  role: Role;
  language: Lang;
};

// The logged-in staff member, or a redirect to the login page.
export const getStaff = cache(async (): Promise<Staff> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const { data } = await supabase
    .from("staff")
    .select("id, full_name, role, language, active")
    .eq("id", userId)
    .maybeSingle();
  if (!data || !data.active) redirect("/login?error=notStaff");
  return data as Staff;
});

// Everything a page needs: database client, staff member, language and translator.
export async function pageContext(allowed?: Role[]) {
  const staff = await getStaff();
  if (allowed && !allowed.includes(staff.role)) redirect("/calendar?error=noAccess");
  const lang = await getLang(staff.language);
  const t: T = translator(lang);
  const supabase = await createClient();
  return { supabase, staff, lang, t };
}

export const canBook = (role: Role) => role === "admin" || role === "office";
export const isAdmin = (role: Role) => role === "admin";
