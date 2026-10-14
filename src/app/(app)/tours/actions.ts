"use server";

import { revalidatePath } from "next/cache";
import { actionContext, num, str, strOrNull } from "@/lib/actions";

export async function saveTour(form: FormData) {
  const id = str(form, "id");
  const back = id ? `/tours/${id}` : "/tours";
  const { supabase, fail, go, lang } = await actionContext(back, ["admin"]);
  const kind = str(form, "kind");
  const row = {
    name_en: str(form, "name_en"),
    name_es: str(form, "name_es"),
    kind,
    duration_minutes: num(form, "duration_minutes"),
    buffer_minutes: num(form, "buffer_minutes") ?? 0,
    min_guests: num(form, "min_guests") ?? 1,
    max_guests: num(form, "max_guests"),
    base_price: num(form, "base_price"),
    base_guests: kind === "private" ? num(form, "base_guests") : null,
    extra_guest_price: num(form, "extra_guest_price"),
    season_start: strOrNull(form, "season_start"),
    season_end: strOrNull(form, "season_end"),
    active: form.get("active") === "on",
  };
  if (id) {
    const { error } = await supabase.from("products").update(row).eq("id", id);
    if (error) fail(error.message);
    revalidatePath(back);
    go(back, { ok: lang === "es" ? "Guardado" : "Saved" });
  }
  const { data, error } = await supabase.from("products").insert(row).select("id").single();
  if (error) fail(error.message);
  revalidatePath("/tours");
  go(`/tours/${data!.id}`, {});
}

export async function saveBoatsForTour(form: FormData) {
  const productId = str(form, "product_id");
  const back = `/tours/${productId}`;
  const { supabase, fail, go, lang } = await actionContext(back, ["admin"]);
  const ids = form.getAll("boat_id").map((v) => Number(v));
  const { error } = await supabase.from("product_boats").delete().eq("product_id", productId);
  if (error) fail(error.message);
  if (ids.length) {
    const { error: e2 } = await supabase
      .from("product_boats")
      .insert(ids.map((boat_id) => ({ product_id: Number(productId), boat_id })));
    if (e2) fail(e2.message);
  }
  revalidatePath(back);
  go(back, { ok: lang === "es" ? "Guardado" : "Saved" });
}

export async function saveTicketType(form: FormData) {
  const productId = str(form, "product_id");
  const back = `/tours/${productId}`;
  const { supabase, fail, go } = await actionContext(back, ["admin"]);
  const row = {
    product_id: Number(productId),
    name_en: str(form, "name_en"),
    name_es: str(form, "name_es"),
    price: num(form, "price"),
    active: form.get("active") === "on",
  };
  const id = str(form, "id");
  const { error } = id
    ? await supabase.from("ticket_types").update(row).eq("id", id)
    : await supabase.from("ticket_types").insert(row);
  if (error) fail(error.message);
  revalidatePath(back);
  go(back, {});
}

export async function addPriceRule(form: FormData) {
  const productId = str(form, "product_id");
  const back = `/tours/${productId}`;
  const { supabase, fail, go } = await actionContext(back, ["admin"]);
  const { error } = await supabase.from("price_rules").insert({
    product_id: Number(productId),
    ticket_type_id: num(form, "ticket_type_id"),
    label: str(form, "label"),
    starts_on: str(form, "starts_on"),
    ends_on: str(form, "ends_on"),
    price: num(form, "price"),
    percent_off: num(form, "percent_off"),
  });
  if (error) fail(error.message);
  revalidatePath(back);
  go(back, {});
}

export async function deletePriceRule(form: FormData) {
  const productId = str(form, "product_id");
  const back = `/tours/${productId}`;
  const { supabase, fail, go } = await actionContext(back, ["admin"]);
  const { error } = await supabase.from("price_rules").delete().eq("id", str(form, "id"));
  if (error) fail(error.message);
  revalidatePath(back);
  go(back, {});
}
