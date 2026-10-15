"use server";

import { revalidatePath } from "next/cache";
import { actionContext, str } from "@/lib/actions";
import { TZ_OFFSET } from "@/lib/format";

export async function createTrip(form: FormData) {
  const date = str(form, "date");
  // On an error, go back to the same view with the form still open.
  const view = str(form, "view") === "week" ? "&view=week" : "";
  const { supabase, fail, go } = await actionContext(`/calendar?date=${date}${view}&add=1`, ["admin", "office"]);
  const { data, error } = await supabase.rpc("create_departure", {
    p_product_id: Number(str(form, "product_id")),
    p_boat_id: Number(str(form, "boat_id")),
    p_starts_at: `${date}T${str(form, "time")}:00${TZ_OFFSET}`,
  });
  if (error) fail(error.message);
  revalidatePath("/calendar");
  go(`/departures/${data}${view ? "?view=week" : ""}`, {});
}
