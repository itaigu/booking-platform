import { addMonths } from "./format";
import type { createClient } from "./supabase/server";
import type { CommissionLine } from "./types";

// Hotel bookings whose trip falls in a month (YYYY-MM), by hotel and trip time.
export async function commissionLines(supabase: Awaited<ReturnType<typeof createClient>>, month: string, hotelId?: number) {
  let query = supabase
    .from("commission_lines")
    .select("*")
    .gte("trip_day", `${month}-01`)
    .lt("trip_day", `${addMonths(month, 1)}-01`)
    .order("hotel_name")
    .order("starts_at");
  if (hotelId) query = query.eq("hotel_id", hotelId);
  const { data } = await query;
  return (data ?? []) as CommissionLine[];
}

export type HotelTotals = {
  hotel_id: number;
  hotel_name: string;
  lines: CommissionLine[];
  bookings: number;
  sales: number;
  commission: number;
  owed: number;
  paid: number;
  payable: number; // owed commissions whose trip already happened
};

const round = (n: number) => Math.round(n * 100) / 100;

// Totals per hotel. Cancelled commissions are listed but don't count.
export function totalsByHotel(lines: CommissionLine[], now = new Date()): HotelTotals[] {
  const byHotel = new Map<number, HotelTotals>();
  for (const l of lines) {
    let h = byHotel.get(l.hotel_id);
    if (!h) {
      h = { hotel_id: l.hotel_id, hotel_name: l.hotel_name, lines: [], bookings: 0, sales: 0, commission: 0, owed: 0, paid: 0, payable: 0 };
      byHotel.set(l.hotel_id, h);
    }
    h.lines.push(l);
    if (l.status === "cancelled") continue;
    const amount = Number(l.commission_amount);
    h.bookings += 1;
    h.sales = round(h.sales + Number(l.total_price));
    h.commission = round(h.commission + amount);
    if (l.status === "paid") h.paid = round(h.paid + amount);
    if (l.status === "owed") {
      h.owed = round(h.owed + amount);
      if (new Date(l.starts_at) < now) h.payable += 1;
    }
  }
  return [...byHotel.values()];
}
