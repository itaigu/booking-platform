"use server";

import { revalidatePath } from "next/cache";
import { actionContext, num, str } from "@/lib/actions";
import { getStaff } from "@/lib/auth";
import { getLang, translateError } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

// Live price while staff fill in the booking form.
export async function getQuote(departureId: number, tickets: string | null, guests: number | null) {
  const staff = await getStaff();
  const lang = await getLang(staff.language);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quote_booking", {
    p_departure_id: departureId,
    p_tickets: tickets ? JSON.parse(tickets) : null,
    p_guests: guests,
  });
  if (error) return { error: translateError(error.message, lang) };
  return { total: Number(data.total) };
}

export async function createBooking(form: FormData) {
  const departureId = str(form, "departure_id");
  const { supabase, fail, go } = await actionContext(`/bookings/new?departure=${departureId}`, ["admin", "office"]);
  const tickets = str(form, "tickets");
  const { data, error } = await supabase.rpc("create_booking", {
    p_departure_id: Number(departureId),
    p_customer: {
      full_name: str(form, "full_name"),
      email: str(form, "email"),
      phone: str(form, "phone"),
      language: str(form, "language"),
      emergency_contact_name: str(form, "emergency_contact_name"),
      emergency_contact_phone: str(form, "emergency_contact_phone"),
    },
    p_channel: str(form, "channel"),
    p_tickets: tickets ? JSON.parse(tickets) : null,
    p_guests: num(form, "guests"),
    p_total_override: num(form, "total_override"),
    p_ota_name: str(form, "ota_name"),
    p_ota_reference: str(form, "ota_reference"),
    p_occasion: str(form, "occasion"),
    p_special_requests: str(form, "special_requests"),
    p_internal_notes: str(form, "internal_notes"),
  });
  if (error) fail(error.message);
  revalidatePath("/calendar");
  go(`/bookings/${data}`, {});
}

export async function updateBooking(form: FormData) {
  const id = str(form, "id");
  const back = `/bookings/${id}`;
  const { supabase, fail, go, lang } = await actionContext(back, ["admin", "office"]);

  const { error } = await supabase
    .from("bookings")
    .update({
      occasion: str(form, "occasion") || null,
      special_requests: str(form, "special_requests") || null,
      internal_notes: str(form, "internal_notes") || null,
      total_price: num(form, "total_price") ?? undefined,
      ota_name: str(form, "ota_name") || null,
      ota_reference: str(form, "ota_reference") || null,
    })
    .eq("id", id);
  if (error) fail(error.message);

  const { error: custError } = await supabase
    .from("customers")
    .update({
      full_name: str(form, "full_name"),
      email: str(form, "email") || null,
      phone: str(form, "phone") || null,
      language: str(form, "language") || "en",
      emergency_contact_name: str(form, "emergency_contact_name") || null,
      emergency_contact_phone: str(form, "emergency_contact_phone") || null,
    })
    .eq("id", str(form, "customer_id"));
  if (custError) fail(custError.message);

  revalidatePath(back);
  go(back, { ok: lang === "es" ? "Guardado" : "Saved" });
}

export async function setBookingStatus(form: FormData) {
  const id = str(form, "id");
  const back = `/bookings/${id}`;
  const { supabase, fail, go } = await actionContext(back, ["admin", "office"]);
  const { error } = await supabase.from("bookings").update({ status: str(form, "status") }).eq("id", id);
  if (error) fail(error.message);
  revalidatePath("/calendar");
  go(back, {});
}

export async function rescheduleBooking(form: FormData) {
  const id = str(form, "id");
  const back = `/bookings/${id}`;
  const { supabase, fail, go } = await actionContext(back, ["admin", "office"]);
  const { error } = await supabase.rpc("reschedule_booking", {
    p_booking_id: Number(id),
    p_departure_id: Number(str(form, "departure_id")),
  });
  if (error) fail(error.message);
  revalidatePath("/calendar");
  go(back, {});
}
