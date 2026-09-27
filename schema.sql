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

CREATE OR REPLACE FUNCTION get_balances()
RETURNS TABLE (
  account_balance NUMERIC,
  net_balance NUMERIC
)
LANGUAGE sql
AS $$
  SELECT
    COALESCE(
      SUM(
        CASE
          WHEN transaction_kind = 'income' THEN amount
          WHEN transaction_kind = 'expense' AND payment_method = 'bank' THEN -amount
          ELSE 0
        END
      ),
      0
    ) AS account_balance,
    COALESCE(
      SUM(
        CASE
          WHEN transaction_kind = 'income' THEN amount
          WHEN transaction_kind = 'expense' THEN -amount
          ELSE 0
        END
      ),
      0
    ) AS net_balance
  FROM trans;
$$;

CREATE OR REPLACE FUNCTION get_monthly_totals(requested_year INTEGER, requested_month INTEGER)
RETURNS TABLE (
  month_income NUMERIC,
  month_expense NUMERIC,
  month_net_balance NUMERIC
)
LANGUAGE sql
AS $$
  WITH month_window AS (
    SELECT
      make_date(requested_year, requested_month, 1) AS month_start,
      (make_date(requested_year, requested_month, 1) + INTERVAL '1 month')::date AS month_end
  )
  SELECT
    COALESCE(
      SUM(
        CASE
          WHEN t.transaction_kind = 'income' THEN t.amount
          ELSE 0
        END
      ),
      0
    ) AS month_income,
    COALESCE(
      SUM(
        CASE
          WHEN t.transaction_kind = 'expense' THEN t.amount
          ELSE 0
        END
      ),
      0
    ) AS month_expense,
    COALESCE(
      SUM(
        CASE
          WHEN t.transaction_kind = 'income' THEN t.amount
          WHEN t.transaction_kind = 'expense' THEN -t.amount
          ELSE 0
        END
      ),
      0
    ) AS month_net_balance
  FROM trans t
  CROSS JOIN month_window w
  WHERE t.date >= w.month_start
    AND t.date < w.month_end;
$$;
