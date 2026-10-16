"use server";

import { revalidatePath } from "next/cache";
import { actionContext, num, str } from "@/lib/actions";

export async function saveTour(form: FormData) {
  const id = str(form, "id");
  // On an error a new tour goes back to the open "new tour" form.
  const back = id ? `/tours/${id}` : "/tours?add=1";
  const { supabase, fail, go, lang } = await actionContext(back, ["admin"]);
  const kind = str(form, "kind");
  const name = str(form, "name");
  const isPrivate = kind === "private";
  const baseGuests = num(form, "base_guests") ?? 4;
  const extraGuests = num(form, "extra_guests") ?? 0;
  const guestPrice = num(form, "guest_price");
  const row = {
    // One name for both languages.
    name_en: name,
    name_es: name,
    kind,
    duration_minutes: num(form, "duration_minutes"),
    buffer_minutes: num(form, "buffer_minutes") ?? 0,
    // Extra hours only apply to private charters.
    max_extra_hours: isPrivate ? (num(form, "max_extra_hours") ?? 0) : 0,
    extra_hour_price: isPrivate ? num(form, "extra_hour_price") : null,
    min_guests: isPrivate ? 1 : (num(form, "min_guests") ?? 1),
    // Private: guests included plus extra guests allowed. Shared: seats per trip.
    max_guests: isPrivate ? baseGuests + extraGuests : num(form, "shared_max_guests"),
    base_price: isPrivate ? num(form, "base_price") : null,
    base_guests: isPrivate ? baseGuests : null,
    extra_guest_price: isPrivate ? num(form, "extra_guest_price") : null,
    // Tours run all year.
    season_start: null,
    season_end: null,
    active: form.get("active") === "on",
  };
  if (!name) fail("Enter the tour name");
  if (isPrivate && row.base_price === null) fail("Enter the charter base price");
  if (isPrivate && extraGuests > 0 && row.extra_guest_price === null) {
    fail("Enter the price per extra guest, or set extra guests to 0");
  }
  if (row.max_extra_hours > 0 && row.extra_hour_price === null) {
    fail("Enter the price per extra hour, or set extra hours to 0");
  }
  if (!isPrivate && row.max_guests !== null && row.min_guests > row.max_guests) {
    fail("The minimum can't be more than the seats per trip");
  }
  if (!isPrivate && guestPrice === null) fail("Enter the price per person");

  let productId = Number(id);
  if (id) {
    const { error } = await supabase.from("products").update(row).eq("id", id);
    if (error) fail(error.message);
  } else {
    const { data, error } = await supabase.from("products").insert(row).select("id").single();
    if (error) fail(error.message);
    productId = data!.id;
  }

  // A shared tour has one price per person, kept as its single ticket type.
  if (!isPrivate) {
    const { data: tickets } = await supabase.from("ticket_types").select("id").eq("product_id", productId).order("id");
    const [first, ...others] = tickets ?? [];
    const ticket = { name_en: "Per person", name_es: "Por persona", price: guestPrice!, active: true };
    const { error } = first
      ? await supabase.from("ticket_types").update(ticket).eq("id", first.id)
      : await supabase.from("ticket_types").insert({ ...ticket, product_id: productId });
    if (error) fail(error.message);
    if (others.length) {
      await supabase.from("ticket_types").update({ active: false }).in("id", others.map((x) => x.id));
    }
  }

  revalidatePath("/tours");
  if (id) {
    revalidatePath(back);
    go(back, { ok: lang === "es" ? "Guardado" : "Saved" });
  }
  go(`/tours/${productId}`, {});
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
