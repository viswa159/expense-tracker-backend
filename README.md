# Expense Tracker API

Express API for the expense tracker frontend using Supabase via the server-side service role key.

## GitHub-ready setup

- `.env` is now ignored by Git and should stay local.
- Use `.env.example` as the template for local and Firebase configuration.
- `node_modules` and Firebase local state are ignored.

## Local development

1. Copy `.env.example` to `.env`.
2. Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. Set `ALLOWED_EMAILS` to the Gmail addresses that should be able to use the app.
4. For local Firebase token verification, either:
   - set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`, or
   - point `GOOGLE_APPLICATION_CREDENTIALS` to a Firebase service account JSON file.
5. Install dependencies:

   ```bash
   npm install
   ```

6. Make sure your Supabase database already contains the tables from [schema.sql](C:/Users/Mahira/Documents/Workspace/expense-tracker-server/schema.sql).

7. Start the API:

   ```bash
   npm run dev
   ```

## Security model

- Every `/api/*` route requires a Firebase ID token.
- Only verified Google accounts listed in `ALLOWED_EMAILS` are accepted.
- CORS only allows localhost dev origins by default plus any origins listed in `ALLOWED_ORIGINS`.

## Deployment for Firebase Spark/free plan

Host this API outside Firebase (for example Render/Railway/Fly) and point the frontend `VITE_API_URL` to that backend URL.

Set environment values on your backend host:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_EMAILS`
- optional `ALLOWED_ORIGINS` (include your Firebase Hosting domain)

Firebase Cloud Functions deployment for this backend is optional and requires Blaze billing.
