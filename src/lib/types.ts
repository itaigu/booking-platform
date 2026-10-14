// Shapes of rows read from the database.

export type Availability = {
  id: number;
  product_id: number;
  boat_id: number;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "cancelled" | "weather_cancelled";
  product_name_en: string;
  product_name_es: string;
  kind: "shared" | "private";
  min_guests: number;
  boat_name: string;
  capacity: number;
  guests_booked: number;
  bookings_count: number;
  seats_left: number;
};
