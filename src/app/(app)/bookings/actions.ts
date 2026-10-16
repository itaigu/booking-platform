"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionContext, num, str } from "@/lib/actions";
import { canBook, getStaff } from "@/lib/auth";
import { isDay, TZ_OFFSET } from "@/lib/format";
import { getLang, translateError } from "@/lib/i18n";
import { closeOpenLinks } from "@/lib/payments";
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

// Customer and booking details, the same on both booking forms.
function bookingArgs(form: FormData) {
  return {
    p_customer: {
      full_name: str(form, "full_name"),
      email: str(form, "email"),
      phone: str(form, "phone"),
      language: str(form, "language"),
      emergency_contact_name: str(form, "emergency_contact_name"),
      emergency_contact_phone: str(form, "emergency_contact_phone"),
    },
    p_channel: str(form, "channel"),
    p_total_override: num(form, "total_override"),
    p_ota_name: str(form, "ota_name"),
    p_ota_reference: str(form, "ota_reference"),
    p_occasion: str(form, "occasion"),
    p_special_requests: str(form, "special_requests"),
    p_internal_notes: str(form, "internal_notes"),
  };
}

// A hotel booking: the hotel, its code and the commission % instead of the channel details.
function hotelArgs(form: FormData) {
  const { p_customer, p_total_override, p_occasion, p_special_requests, p_internal_notes } = bookingArgs(form);
  return {
    p_hotel: { hotel_id: num(form, "hotel_id"), code: str(form, "hotel_code"), commission_pct: str(form, "commission_pct") },
    p_customer,
    p_total_override,
    p_occasion,
    p_special_requests,
    p_internal_notes,
  };
}
const isHotel = (form: FormData) => str(form, "channel") === "hotel";

// New booking: creates the trip (with its own details) and the booking together.
// Returns the error so the form keeps everything that was typed.
export async function createTripBooking(form: FormData): Promise<{ error: string }> {
  const staff = await getStaff();
  const lang = await getLang(staff.language);
  if (!canBook(staff.role)) return { error: translateError("row-level security", lang) };
  const date = str(form, "date");
  const time = str(form, "time");
  const kind = str(form, "kind");
  const trip =
    kind === "private"
      ? {
          base_guests: num(form, "base_guests"),
          base_price: num(form, "base_price"),
          extra_guests: num(form, "extra_guests"),
          extra_guest_price: num(form, "extra_guest_price"),
          extra_hours: num(form, "extra_hours"),
          extra_hour_price: num(form, "extra_hour_price"),
        }
      : {
          guests: num(form, "guests"),
          guest_price: num(form, "guest_price"),
          max_guests: num(form, "max_guests"),
          min_guests: num(form, "min_guests"),
        };
  const p_trip = {
    name: str(form, "name"),
    kind,
    boat_id: num(form, "boat_id"),
    starts_at: isDay(date) && /^\d{2}:\d{2}$/.test(time) ? `${date}T${time}:00${TZ_OFFSET}` : null,
    duration_minutes: num(form, "duration_minutes"),
    buffer_minutes: num(form, "buffer_minutes"),
    ...trip,
  };
  const supabase = await createClient();
  const { data, error } = isHotel(form)
    ? await supabase.rpc("create_hotel_booking", { ...hotelArgs(form), p_trip })
    : await supabase.rpc("create_trip_booking", { p_trip, ...bookingArgs(form) });
  if (error) return { error: translateError(error.message, lang) };
  revalidatePath("/calendar");
  redirect(`/bookings/${data}`);
}

export async function createBooking(form: FormData) {
  const departureId = str(form, "departure_id");
  const { supabase, fail, go } = await actionContext(`/bookings/new?departure=${departureId}`, ["admin", "office"]);
  const tickets = str(form, "tickets");
  const trip = {
    p_departure_id: Number(departureId),
    p_tickets: tickets ? JSON.parse(tickets) : null,
    p_guests: num(form, "guests"),
  };
  const { data, error } = isHotel(form)
    ? await supabase.rpc("create_hotel_booking", { ...hotelArgs(form), ...trip })
    : await supabase.rpc("create_booking", { ...trip, ...bookingArgs(form) });
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
  const status = str(form, "status");
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  if (error) fail(error.message);
  // A cancelled booking can't be paid any more.
  if (status === "cancelled") {
    try {
      await closeOpenLinks(supabase, Number(id));
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }
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

// Change the number of guests (and extra hours on a one-off private trip).
// The price is worked out again unless a special price is given.
export async function changeGuests(form: FormData) {
  const id = str(form, "id");
  const back = `/bookings/${id}`;
  const { supabase, fail, go, lang } = await actionContext(back, ["admin", "office"]);
  const { error } = await supabase.rpc("update_booking_guests", {
    p_booking_id: Number(id),
    p_guests: num(form, "guests"),
    p_extra_hours: num(form, "extra_hours"),
    p_extra_guest_price: num(form, "extra_guest_price"),
    p_extra_hour_price: num(form, "extra_hour_price"),
    p_total_override: num(form, "total_override"),
  });
  if (error) fail(error.message);
  revalidatePath("/calendar");
  revalidatePath(back);
  go(back, { ok: lang === "es" ? "Guardado" : "Saved" });
}

// A hotel booking: fix the hotel's code, or give this booking its own commission %.
export async function updateHotelDetails(form: FormData) {
  const id = str(form, "id");
  const back = `/bookings/${id}`;
  const { supabase, fail, go, lang } = await actionContext(back, ["admin", "office"]);
  const code = str(form, "hotel_code");
  if (!code) fail("Enter the hotel code");
  const { error } = await supabase.from("bookings").update({ hotel_code: code }).eq("id", id).eq("channel", "hotel");
  if (error) fail(error.message);

  const pct = num(form, "commission_pct");
  if (pct !== null) {
    if (!(pct >= 0 && pct <= 100)) fail("The commission must be between 0 and 100");
    const { error: commError } = await supabase
      .from("commissions")
      .update({ commission_pct: pct })
      .eq("booking_id", id)
      .neq("status", "paid");
    if (commError) fail(commError.message);
  }
  revalidatePath(back);
  revalidatePath("/commissions");
  go(back, { ok: lang === "es" ? "Guardado" : "Saved" });
}

// Turn a booking taken by phone, WhatsApp, etc. into a hotel booking, with its commission.
export async function makeHotelBooking(form: FormData) {
  const id = str(form, "id");
  const back = `/bookings/${id}`;
  const { supabase, fail, go, lang } = await actionContext(back, ["admin", "office"]);
  const hotelId = num(form, "hotel_id");
  const code = str(form, "hotel_code");
  const pct = num(form, "commission_pct");
  if (!hotelId) fail("Choose the hotel");
  if (!code) fail("Enter the hotel code");
  if (pct !== null && !(pct >= 0 && pct <= 100)) fail("The commission must be between 0 and 100");

  const { data: hotel } = await supabase
    .from("hotels")
    .select("id, default_commission_pct")
    .eq("id", hotelId!)
    .eq("active", true)
    .maybeSingle();
  if (!hotel) fail("Choose the hotel");
  const { data: used } = await supabase
    .from("bookings")
    .select("booking_number")
    .eq("hotel_id", hotelId!)
    .ilike("hotel_code", code.replace(/[%_\\]/g, "\\$&"))
    .neq("id", id)
    .limit(1)
    .maybeSingle();
  if (used) fail(`This hotel code was already used (booking ${used.booking_number})`);

  const { data: booking, error } = await supabase
    .from("bookings")
    .update({ channel: "hotel", hotel_id: hotelId, hotel_code: code, ota_name: null, ota_reference: null })
    .eq("id", id)
    .neq("channel", "hotel")
    .select("status")
    .maybeSingle();
  if (error) fail(error.message);
  if (!booking) fail("Some information is missing");

  // The database works out the amount from the booking total.
  const { error: commError } = await supabase.from("commissions").insert({
    booking_id: Number(id),
    hotel_id: hotelId,
    commission_pct: pct ?? hotel!.default_commission_pct,
    commission_amount: 0,
    status: booking!.status === "cancelled" ? "cancelled" : "owed",
  });
  if (commError) fail(commError.message);

  revalidatePath(back);
  revalidatePath("/bookings");
  revalidatePath("/commissions");
  go(back, { ok: lang === "es" ? "Guardado" : "Saved" });
}
