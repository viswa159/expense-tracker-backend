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

## Firebase deployment

This repo is configured to deploy the API as a Firebase Cloud Function named `api`.

1. Install the Firebase CLI and log in.
2. Keep `.firebaserc` pointed at the same Firebase project as the frontend.
3. Configure runtime secrets / environment values for:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ALLOWED_EMAILS`
   - optional `ALLOWED_ORIGINS`
4. Deploy:

   ```bash
   npm run deploy:firebase
   ```

The frontend Firebase Hosting config rewrites `/api/**` to this function, so both apps should target the same Firebase project.
