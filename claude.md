# Claude Project Guide

## Project overview
This repository is the backend API for the expense tracker app. It exposes a small Express service over PostgreSQL and is intentionally simple: fetch categories, list transactions, create a transaction, and update an existing transaction.

The app is designed to run locally with Postgres first and to stay compatible with a future Supabase migration because Supabase uses PostgreSQL under the hood.

## Tech stack
- Node.js
- Express
- PostgreSQL via `pg`
- `dotenv` for environment variables
- `cors` for browser access
- `uuid` for transaction IDs

## Project structure
- `index.js` — Express routes and API logic
- `db.js` — PostgreSQL pool setup using environment variables
- `schema.sql` — database schema and seed data
- `README.md` — setup and migration notes
- `.env` — local database configuration (not committed)
- `package.json` — project scripts and dependencies

## Local setup
1. Create a PostgreSQL database named `expense_tracker`.
2. Run the schema:
   ```bash
   psql -U postgres -d expense_tracker -f schema.sql
   ```
3. Create a `.env` file with values like:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=postgres
   DB_NAME=expense_tracker
   DB_SSL=false
   PORT=4000
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start the server:
   ```bash
   npm run dev
   ```

Expected startup output:
```bash
API listening on http://localhost:4000
```

## Scripts
```bash
npm run dev   # watch mode for local development
npm start     # run the server once
```

## Database model
The schema is intentionally minimal and aligns with the API layer.

`categories`
- `id` (TEXT PRIMARY KEY)
- `name` (TEXT NOT NULL)
- `kind` (TEXT CHECK IN ('income', 'expense'))

`trans`
- `id` (TEXT PRIMARY KEY)
- `date` (DATE NOT NULL)
- `amount` (NUMERIC(12, 2) > 0)
- `transaction_kind` (TEXT CHECK IN ('income', 'expense'))
- `payment_method` (TEXT CHECK IN ('bank', 'credit'))
- `category_id` (TEXT FOREIGN KEY to `categories.id`)
- `description` (TEXT, optional)
- `created_at` (TIMESTAMPTZ DEFAULT now())

Important: keep table names and column names aligned with `schema.sql` and the queries in `index.js`. Do not rename the `trans` table unless the schema and all API code are updated together.

## API endpoints
- `GET /api/categories` — returns all categories ordered by name
- `GET /api/transactions` — returns all transactions ordered by newest first
- `POST /api/transactions` — creates a transaction
- `PUT /api/transactions/:id` — updates a transaction by id

Request body for create/update:
```json
{
  "date": "2026-09-20",
  "amount": 125.5,
  "transaction_kind": "expense",
  "payment_method": "credit",
  "category_id": "cat_groceries",
  "description": "Weekly groceries"
}
```

## Important implementation notes
- The API is intentionally simple; there is no auth layer, no complex validation middleware, and no service abstraction.
- `index.js` queries directly against PostgreSQL using the shared `pool` created in `db.js`.
- `amount` should always remain positive. Validation is done in the request layer and the database schema.
- This backend is meant to work with the frontend app and can be swapped to Supabase by only changing environment values, not database logic.
- There are no automated tests in this repository at the moment.

## Migration guidance
If moving to Supabase later:
- keep the same PostgreSQL schema
- update `.env` with Supabase connection settings
- set `DB_SSL=true` for Supabase
- keep the Express route structure unchanged unless you add new business rules

## Guardrails for AI work
- Prefer minimal, direct edits.
- Keep the API contract stable unless the frontend also changes.
- Preserve `trans` naming and `categories` naming in all SQL and route logic.
- Do not introduce new database frameworks or major refactors without a clear reason.
- If a change affects the schema, update `schema.sql` and any related code in the same patch.
