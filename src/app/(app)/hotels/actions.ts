"use server";

import { revalidatePath } from "next/cache";
import { actionContext, num, str, strOrNull } from "@/lib/actions";

export async function saveHotel(form: FormData) {
  const { supabase, fail, go, lang } = await actionContext("/hotels", ["admin"]);
  const row = {
    name: str(form, "name"),
    contact_name: strOrNull(form, "contact_name"),
    phone: strOrNull(form, "phone"),
    email: strOrNull(form, "email"),
    default_commission_pct: num(form, "default_commission_pct") ?? 0,
    active: form.get("active") === "on",
  };
  const id = str(form, "id");
  const { error } = id
    ? await supabase.from("hotels").update(row).eq("id", id)
    : await supabase.from("hotels").insert(row);
  if (error) fail(error.message);
  revalidatePath("/hotels");
  go("/hotels", { ok: lang === "es" ? "Guardado" : "Saved" });
}
