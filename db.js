import pg from "pg";
import "dotenv/config";

// When you move to Supabase, you only change the values in .env —
// this file (and every query in index.js) stays exactly the same,
// because Supabase's database IS Postgres.
export const pool = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "expense_tracker",
  // Supabase requires SSL; local Postgres does not.
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});
