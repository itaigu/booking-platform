"use server";

import { revalidatePath } from "next/cache";
import { actionContext, num, str } from "@/lib/actions";
import { isDay, TZ_OFFSET } from "@/lib/format";

// Only go back to a booking or trip page, never anywhere else.
const safeBack = (path: string, fallback: string) =>
  /^\/(bookings|departures)\/\d+(\?view=week)?$/.test(path) ? path : fallback;

// Change the trip's date, time, boat and duration. Its bookings move with it.
export async function updateTrip(form: FormData) {
  const id = str(form, "id");
  const back = safeBack(str(form, "back"), `/departures/${id}`);
  const { supabase, fail, go, lang } = await actionContext(back, ["admin", "office"]);
  const date = str(form, "date");
  const time = str(form, "time");
  const { error } = await supabase.rpc("update_departure", {
    p_departure_id: Number(id),
    p_boat_id: num(form, "boat_id"),
    p_starts_at: isDay(date) && /^\d{2}:\d{2}$/.test(time) ? `${date}T${time}:00${TZ_OFFSET}` : null,
    p_duration_minutes: num(form, "duration_minutes"),
    p_buffer_minutes: num(form, "buffer_minutes"),
    p_name: str(form, "name") || null,
  });
  if (error) fail(error.message);
  revalidatePath("/calendar");
  revalidatePath(back);
  go(back, { ok: lang === "es" ? "Guardado" : "Saved" });
}

// Cancel the trip and every confirmed booking on it (for example, bad weather).
export async function cancelTrip(form: FormData) {
  const id = str(form, "id");
  // Keep "came from the week view" so the back button returns there.
  const q = str(form, "view") === "week" ? "?view=week" : "";
  const { supabase, fail, go, lang } = await actionContext(`/departures/${id}${q}`, ["admin", "office"]);
  if (num(form, "bookings") && form.get("confirm") !== "on") fail("Tick the box to confirm its bookings will be cancelled");
  const { data, error } = await supabase.rpc("cancel_departure", {
    p_departure_id: Number(id),
    p_weather: str(form, "reason") === "weather",
  });
  if (error) fail(error.message);
  revalidatePath("/calendar");
  const ok = lang === "es" ? `Salida cancelada · ${data} reservas canceladas` : `Trip cancelled · ${data} bookings cancelled`;
  go(`/departures/${id}${q}`, { ok });
}
