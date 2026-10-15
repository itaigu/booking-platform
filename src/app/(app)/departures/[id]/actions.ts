"use server";

import { revalidatePath } from "next/cache";
import { actionContext, str } from "@/lib/actions";

export async function cancelTrip(form: FormData) {
  const id = str(form, "id");
  // Keep "came from the week view" so the back button returns there.
  const q = str(form, "view") === "week" ? "?view=week" : "";
  const { supabase, fail, go } = await actionContext(`/departures/${id}${q}`, ["admin", "office"]);
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("departure_id", id)
    .eq("status", "confirmed");
  if (count) fail("Move or cancel its bookings first");
  const { error } = await supabase.from("departures").update({ status: "cancelled" }).eq("id", id);
  if (error) fail(error.message);
  revalidatePath("/calendar");
  go(`/departures/${id}${q}`, {});
}
