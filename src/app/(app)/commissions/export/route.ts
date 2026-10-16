import type { NextRequest } from "next/server";
import { getStaff } from "@/lib/auth";
import { commissionLines } from "@/lib/commissions";
import { isMonth } from "@/lib/format";
import { getLang, translator } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

// One CSV cell. Text that starts like a formula is kept as text in Excel.
function cell(v: string | number) {
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// The hotel bookings behind the commission report for a month, as a CSV file
// that opens in Excel. ?hotel=<id> for one hotel only.
export async function GET(request: NextRequest) {
  const staff = await getStaff();
  if (staff.role !== "admin" && staff.role !== "office") return new Response("Forbidden", { status: 403 });
  const lang = await getLang(staff.language);
  const t = translator(lang);

  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!isMonth(month)) return new Response("Choose a month", { status: 400 });
  const hotelId = Number(request.nextUrl.searchParams.get("hotel")) || undefined;
  const lines = await commissionLines(await createClient(), month, hotelId);

  const header = [
    t("hotel"), t("date"), t("trip"), t("bookingNumber"), t("hotelCode"), t("customer"),
    t("guests"), t("total"), t("commissionPct"), t("commission"), t("status"), t("paidOn"),
  ];
  const rows = lines.map((l) => [
    l.hotel_name,
    l.trip_day,
    lang === "es" ? l.product_name_es : l.product_name_en,
    l.booking_number,
    l.hotel_code,
    l.customer_name,
    l.guests,
    Number(l.total_price).toFixed(2),
    Number(l.commission_pct),
    Number(l.commission_amount).toFixed(2),
    t(`comm_${l.status}`),
    l.paid_at ?? "",
  ]);
  // The mark at the start tells Excel the file is UTF-8 (for accents).
  const csv = `\uFEFF${[header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;
  const name = `${slug(t("commissions"))}-${month}${hotelId && lines[0] ? `-${slug(lines[0].hotel_name)}` : ""}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
