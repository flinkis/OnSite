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

## Production setup (Vercel)

Production URL: https://on-site-three.vercel.app

### 1. Google Cloud OAuth

In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your OAuth 2.0 Client, add **both** environments:

**Authorized JavaScript origins**
- `http://localhost:5173`
- `https://on-site-three.vercel.app`

**Authorized redirect URIs**
- `http://localhost:5173/api/auth/callback/google`
- `https://on-site-three.vercel.app/api/auth/callback/google`

Do **not** use port `3001` — the browser always uses the Vite dev server on `5173`.

### 2. Vercel environment variables

| Variable | Production | Preview | Notes |
|---|---|---|---|
| `AUTH_SECRET` | ✅ | ✅ | Random secret (`node -e "..."`) |
| `AUTH_URL` | ❌ unset | ❌ unset | Set to `http://localhost:5173` in local `.env` only; Vercel uses `trustHost` |
| `AUTH_GOOGLE_ID` | ✅ | ✅ | From Google Cloud Console |
| `AUTH_GOOGLE_SECRET` | ✅ | ✅ | From Google Cloud Console |
| `ADMIN_PASSWORD_HASH` | ✅ | ✅ | `npm run hash-admin -- <password>` |
| `DATABASE_URL` | ✅ | ✅ | Neon (Vercel Marketplace) |
| `VITE_AUTH_MODE` | ❌ unset | `mock` | Vite build-time only; prod uses real auth |
| `MOCK_AUTH` | ❌ unset | `true` | Preview API accepts mock login |

**Important:** `VITE_*` variables are embedded at **build time**. After changing them in Vercel, redeploy for changes to take effect.

### 3. Redeploy after env changes

```bash
npx vercel --prod
```

Or push to GitHub if the repo is connected to Vercel.

## Features (v1)

- Google sign-in for users, password login for admin
- QR scan check-in with deep-link fallback
- Location CRUD, token rotation, printable QR codes
- Duplicate-scan throttle and impossible-travel flagging
- Live presence, history filters, CSV export

See [docs/plan.md](docs/plan.md) for the full project plan including v2 GPS validation.
