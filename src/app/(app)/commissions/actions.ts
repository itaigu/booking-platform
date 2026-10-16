"use server";

import { revalidatePath } from "next/cache";
import { actionContext, num, str } from "@/lib/actions";
import { isDay, isMonth } from "@/lib/format";
import { translator } from "@/lib/i18n";

// Mark a hotel's owed commissions for a month (trips that already happened) as paid.
export async function markPaid(form: FormData) {
  const month = str(form, "month");
  const back = `/commissions?month=${isMonth(month) ? month : ""}`;
  const { supabase, fail, go, lang } = await actionContext(back, ["admin", "office"]);
  const paidAt = str(form, "paid_at");
  if (!isMonth(month) || !isDay(paidAt)) fail("Choose the payment date");
  const { data, error } = await supabase.rpc("pay_hotel_commissions", {
    p_hotel_id: num(form, "hotel_id"),
    p_month: `${month}-01`,
    p_paid_at: paidAt,
  });
  if (error) fail(error.message);
  revalidatePath("/commissions");
  go(back, { ok: translator(lang)("commissionsMarked").replace("{n}", String(data)) });
}

// Put a hotel's paid commissions for a month back to owed (a payment marked by mistake).
export async function undoPaid(form: FormData) {
  const month = str(form, "month");
  const back = `/commissions?month=${isMonth(month) ? month : ""}`;
  const { supabase, fail, go, lang } = await actionContext(back, ["admin"]);
  if (!isMonth(month)) fail("Some information is missing");
  const { data, error } = await supabase.rpc("undo_hotel_commission_payment", {
    p_hotel_id: num(form, "hotel_id"),
    p_month: `${month}-01`,
  });
  if (error) fail(error.message);
  revalidatePath("/commissions");
  go(back, { ok: translator(lang)("commissionsUndone").replace("{n}", String(data)) });
}
