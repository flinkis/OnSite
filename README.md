# OnSite — Location Check-in App

Web app for verifying presence at physical locations via QR code scans.

## Stack

- **Frontend:** Vite + React + TypeScript, TanStack Query
- **Backend:** Hono on Vercel Functions
- **Auth:** Auth.js (Google OAuth + admin credentials, JWT sessions)
- **Database:** Neon Postgres + Drizzle ORM

## Local development

1. Copy env template and configure:

```bash
cp .env.example .env
```

2. Set `VITE_AUTH_MODE=mock` for UI development without OAuth.

3. Generate admin password hash:

```bash
npm run hash-admin -- your-password
```

4. Install and run:

```bash
npm install
npm run db:push   # requires DATABASE_URL
npm run dev
```

- Frontend: http://localhost:5173
- API (proxied): http://localhost:5173/api/*

### Mock auth

With `VITE_AUTH_MODE=mock`:
- **Continue with Google** → signs in as a test user
- **Admin login** → password `admin`

## Production setup

1. Google Cloud OAuth client with redirect URI:
   `https://<your-domain>/api/auth/callback/google`
2. Vercel env vars: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
   `ADMIN_PASSWORD_HASH`, `DATABASE_URL`
3. Set `AUTH_URL` to your production URL
4. Remove or unset `VITE_AUTH_MODE` for real auth

## Features (v1)

- Google sign-in for users, password login for admin
- QR scan check-in with deep-link fallback
- Location CRUD, token rotation, printable QR codes
- Duplicate-scan throttle and impossible-travel flagging
- Live presence, history filters, CSV export

See [docs/plan.md](docs/plan.md) for the full project plan including v2 GPS validation.
