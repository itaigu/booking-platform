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
  one_off: boolean;
  boat_max: number;
  extra_hours: number;
  boat_free_at: string;
};

export type Hotel = {
  id: number;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  default_commission_pct: number;
  active: boolean;
};

// Hotels to choose from on the booking forms.
export type HotelOption = Pick<Hotel, "id" | "name" | "default_commission_pct">;

// One hotel booking in the commission report (view commission_lines).
export type CommissionLine = {
  booking_id: number;
  hotel_id: number;
  hotel_name: string;
  commission_pct: number;
  commission_amount: number;
  status: "owed" | "paid" | "cancelled";
  paid_at: string | null;
  booking_number: string;
  hotel_code: string;
  guests: number;
  total_price: number;
  booking_status: string;
  starts_at: string;
  trip_day: string;
  product_name_en: string;
  product_name_es: string;
  customer_name: string;
};
