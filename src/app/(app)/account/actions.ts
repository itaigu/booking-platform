"use server";

import { actionContext, str } from "@/lib/actions";

export async function changePassword(form: FormData) {
  const { supabase, fail, go, lang } = await actionContext("/account", ["admin", "office", "dock", "crew"]);
  const password = str(form, "password");
  if (password.length < 8) fail("Password must be at least 8 characters");
  if (password !== str(form, "repeat")) fail("The two passwords don't match");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) fail(error.message);
  go("/account", { ok: lang === "es" ? "Contraseña cambiada" : "Password changed" });
}
