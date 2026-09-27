import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_KEY || "";

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is required");
}

if (!supabaseServiceRoleKey) {
  throw new Error("SUPABASE_KEY is required");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
