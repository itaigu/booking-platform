"use server";

import { revalidatePath } from "next/cache";
import { actionContext, num, str, strOrNull } from "@/lib/actions";

export async function saveSchedule(form: FormData) {
  const { supabase, fail, go } = await actionContext("/schedules", ["admin"]);
  const weekdays = form.getAll("weekdays").map(Number);
  if (!weekdays.length) fail("Choose at least one day");
  const { error } = await supabase.from("schedules").insert({
    product_id: num(form, "product_id"),
    boat_id: num(form, "boat_id"),
    weekdays,
    start_time: str(form, "start_time"),
    valid_from: str(form, "valid_from"),
    valid_to: strOrNull(form, "valid_to"),
  });
  if (error) fail(error.message);
  revalidatePath("/schedules");
  go("/schedules", {});
}

export async function deleteSchedule(form: FormData) {
  const { supabase, fail, go } = await actionContext("/schedules", ["admin"]);
  // Trips already created stay on the calendar; they just lose the link to the schedule.
  const { error } = await supabase.from("schedules").delete().eq("id", str(form, "id"));
  if (error) fail(error.message);
  revalidatePath("/schedules");
  go("/schedules", {});
}

export async function generateTrips(form: FormData) {
  const { supabase, fail, go, lang } = await actionContext("/schedules", ["admin"]);
  const { data, error } = await supabase.rpc("generate_departures", {
    p_schedule_id: Number(str(form, "id")),
    p_from: str(form, "from"),
    p_to: str(form, "to"),
  });
  if (error) fail(error.message);
  revalidatePath("/calendar");
  go("/schedules", { ok: `${data} ${lang === "es" ? "salidas creadas" : "trips created"}` });
}
