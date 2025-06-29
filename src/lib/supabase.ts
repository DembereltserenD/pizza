import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Debug environment variables
console.log("Supabase URL:", supabaseUrl ? "✓ Set" : "✗ Missing");
console.log("Supabase Anon Key:", supabaseAnonKey ? "✓ Set" : "✗ Missing");

// Only create client if environment variables are available and valid
export const supabase =
  supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith("http")
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

if (!supabase) {
  console.error(
    "❌ Supabase client not initialized. Please check your environment variables:",
  );
  console.error("- NEXT_PUBLIC_SUPABASE_URL");
  console.error("- NEXT_PUBLIC_SUPABASE_ANON_KEY");
} else {
  console.log("✅ Supabase client initialized successfully");
}

// Types based on our database schema
export interface Pizza {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PizzaItem {
  pizza_id: string;
  quantity: number;
}

export interface Order {
  id: string;
  pizza_items: PizzaItem[];
  total_price: number;
  building: string;
  floor: number;
  door_number: string;
  phone: string;
  payment_type: "qpay" | "cash";
  is_paid: boolean;
  status: "pending" | "accepted" | "on_delivery" | "delivered";
  created_at: string;
  delivered_at: string | null;
  user_id?: string | null; // Optional user_id for authenticated users
}

export interface UserRole {
  id: string;
  role: "admin" | "delivery";
  created_at: string;
}

// Helper functions
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat("mn-MN", {
    style: "currency",
    currency: "MNT",
    minimumFractionDigits: 0,
  })
    .format(price)
    .replace("MNT", "₮");
};

export const formatTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Buildings list for dropdown
export const BUILDINGS = [
  "Барилга 1",
  "Барилга 2",
  "Барилга 3",
  "Барилга 4",
  "Барилга 5",
  "Барилга 6",
  "Барилга 7",
  "Барилга 8",
  "Барилга 9",
  "Барилга 10",
];
