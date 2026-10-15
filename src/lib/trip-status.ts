import type { Key, T } from "./i18n";
import type { Availability } from "./types";

// The one status pill a trip card shows, if any.
export function tripPill(tr: Availability, short = false): { key: Key; cls: string } | null {
  if (tr.status !== "scheduled") {
    return {
      key: short || tr.status === "cancelled" ? "dep_cancelled" : "dep_weather_cancelled",
      cls: "bg-slate-200 text-slate-700",
    };
  }
  if (tr.kind === "private") {
    return tr.bookings_count > 0 ? { key: "reserved", cls: "bg-slate-800 text-white" } : null;
  }
  if (tr.seats_left === 0) return { key: "full", cls: "bg-slate-800 text-white" };
  if (tr.guests_booked > 0 && tr.guests_booked < tr.min_guests) {
    return { key: "belowMinShort", cls: "bg-amber-300 text-amber-950" };
  }
  return null;
}

// How full a trip is: "14/20 pax" for shared tours, "6 pax" or "Available" for charters.
export function tripLoad(tr: Availability, t: T) {
  if (tr.kind === "shared") return `${tr.guests_booked}/${tr.capacity} pax`;
  return tr.bookings_count > 0 ? `${tr.guests_booked} pax` : t("available");
}

// Share of seats sold, 0–100, for the thin bar at the bottom of a card.
export function tripFill(tr: Availability) {
  return Math.min(100, Math.round((tr.guests_booked / Math.max(tr.capacity, 1)) * 100));
}
