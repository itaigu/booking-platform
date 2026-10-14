"use server";

import { revalidatePath } from "next/cache";
import { actionContext, str } from "@/lib/actions";
import { createAdminClient } from "@/lib/supabase/server";

export async function addStaff(form: FormData) {
  const { supabase, fail, go, lang } = await actionContext("/staff", ["admin"]);
  const admin = createAdminClient();
  if (!admin) fail("SUPABASE_SECRET_KEY is not set");

  const { data, error } = await admin!.auth.admin.createUser({
    email: str(form, "email"),
    password: str(form, "password"),
    email_confirm: true,
  });
  if (error) fail(error.message);

  const { error: e2 } = await supabase.from("staff").insert({
    id: data!.user!.id,
    full_name: str(form, "full_name"),
    role: str(form, "role"),
    language: str(form, "language"),
  });
  if (e2) {
    await admin!.auth.admin.deleteUser(data!.user!.id);
    fail(e2.message);
  }
  revalidatePath("/staff");
  go("/staff", { ok: lang === "es" ? "Guardado" : "Saved" });
}

export async function updateStaff(form: FormData) {
  const { supabase, staff: me, fail, go, lang } = await actionContext("/staff", ["admin"]);
  const id = str(form, "id");
  const row: Record<string, unknown> = {
    full_name: str(form, "full_name"),
    language: str(form, "language"),
  };
  // Admins can't demote or deactivate themselves (so there is always an admin).
  if (id !== me.id) {
    row.role = str(form, "role");
    row.active = form.get("active") === "on";
  }
  const { error } = await supabase.from("staff").update(row).eq("id", id);
  if (error) fail(error.message);
  revalidatePath("/staff");
  go("/staff", { ok: lang === "es" ? "Guardado" : "Saved" });
}
