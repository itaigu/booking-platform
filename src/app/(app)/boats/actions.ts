"use server";

import { revalidatePath } from "next/cache";
import { actionContext, num, str } from "@/lib/actions";
import { TZ_OFFSET } from "@/lib/format";

export async function saveBoat(form: FormData) {
  const { supabase, fail, go, lang } = await actionContext("/boats", ["admin"]);
  const row = {
    name: str(form, "name"),
    length_ft: num(form, "length_ft"),
    max_guests: num(form, "max_guests"),
    active: form.get("active") === "on",
  };
  const id = str(form, "id");
  const { error } = id
    ? await supabase.from("boats").update(row).eq("id", id)
    : await supabase.from("boats").insert(row);
  if (error) fail(error.message);
  revalidatePath("/boats");
  go("/boats", { ok: lang === "es" ? "Guardado" : "Saved" });
}

export async function addBlock(form: FormData) {
  const { supabase, fail, go } = await actionContext("/boats", ["admin"]);
  const { error } = await supabase.from("boat_blocks").insert({
    boat_id: num(form, "boat_id"),
    starts_at: `${str(form, "starts_at")}:00${TZ_OFFSET}`,
    ends_at: `${str(form, "ends_at")}:00${TZ_OFFSET}`,
    reason: str(form, "reason"),
  });
  if (error) fail(error.message);
  revalidatePath("/boats");
  go("/boats", {});
}

export async function deleteBlock(form: FormData) {
  const { supabase, fail, go } = await actionContext("/boats", ["admin"]);
  const { error } = await supabase.from("boat_blocks").delete().eq("id", str(form, "id"));
  if (error) fail(error.message);
  revalidatePath("/boats");
  go("/boats", {});
}
