"use server";

import { revalidatePath } from "next/cache";
import { actionContext, str } from "@/lib/actions";

export async function cancelTrip(form: FormData) {
  const id = str(form, "id");
  const { supabase, fail, go } = await actionContext(`/departures/${id}`, ["admin", "office"]);
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("departure_id", id)
    .eq("status", "confirmed");
  if (count) fail("Move or cancel its bookings first");
  const { error } = await supabase.from("departures").update({ status: "cancelled" }).eq("id", id);
  if (error) fail(error.message);
  revalidatePath("/calendar");
  go(`/departures/${id}`, {});
}
