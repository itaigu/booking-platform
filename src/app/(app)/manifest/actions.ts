"use server";

import { revalidatePath } from "next/cache";
import { getStaff } from "@/lib/auth";
import { getLang, translateError } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

// Mark a group as arrived at the dock (or undo it). Every staff role can do this.
export async function setCheckIn(bookingId: number, checkedIn: boolean): Promise<{ error?: string }> {
  const staff = await getStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_check_in", { p_booking_id: bookingId, p_checked_in: checkedIn });
  if (error) return { error: translateError(error.message, await getLang(staff.language)) };
  revalidatePath("/manifest");
  return {};
}
