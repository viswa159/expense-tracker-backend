-- Run this against your local Postgres database once, then again
-- (or via a migration tool) when you move to Supabase.

CREATE TABLE IF NOT EXISTS categories (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('income', 'expense'))
);

CREATE TABLE IF NOT EXISTS trans (
  id                TEXT PRIMARY KEY,
  date              DATE NOT NULL,
  amount            NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  transaction_kind  TEXT NOT NULL CHECK (transaction_kind IN ('income', 'expense')),
  payment_method    TEXT NOT NULL CHECK (payment_method IN ('bank', 'credit')),
  category_id       TEXT NOT NULL REFERENCES categories(id),
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trans_date ON trans (date DESC);

-- Seed categories (matches the ones already hardcoded in the frontend)
INSERT INTO categories (id, name, kind) VALUES
  ('cat_salary', 'Salary', 'income'),
  ('cat_freelance', 'Freelance', 'income'),
  ('cat_interest', 'Interest', 'income'),
  ('cat_groceries', 'Groceries', 'expense'),
  ('cat_rent', 'Rent', 'expense'),
  ('cat_transport', 'Transport', 'expense'),
  ('cat_utilities', 'Utilities', 'expense'),
  ('cat_dining', 'Dining Out', 'expense'),
  ('cat_health', 'Health', 'expense'),
  ('cat_entertainment', 'Entertainment', 'expense'),
  ('cat_other', 'Other', 'expense')
ON CONFLICT (id) DO NOTHING;
