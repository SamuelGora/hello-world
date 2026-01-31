# Deployment Guide

This project currently ships a static frontend (HTML/CSS/JS) and a Fastify backend. The fastest
path to deployment is to host the static site on a CDN and the API on a Node-friendly platform.

## Frontend (Static HTML)

### Option A: Vercel
1. Create a new Vercel project and import this repository.
2. Set the **Framework Preset** to **Other** (static).
3. Set **Build Command** to `None`.
4. Set **Output Directory** to `/` (root).
5. Deploy.

### Option B: Netlify
1. Create a new Netlify site from Git.
2. Set **Build Command** to `None`.
3. Set **Publish Directory** to `/`.
4. Deploy.

## Backend (Fastify API)

### Option A: Render (recommended starter)
1. Create a new **Web Service**.
2. Set the **Root Directory** to `server`.
3. Set the **Build Command** to `npm install`.
4. Set the **Start Command** to `npm start`.
5. Add the environment variables from `server/.env.example`.

### Option B: Fly.io
1. Initialize a Fly app inside `server/`.
2. Set environment variables from `server/.env.example`.
3. Deploy using `fly deploy`.

## Environment Variables

See `server/.env.example` for the required variables. At a minimum, set:
- `JWT_SECRET` (required)
- `COOKIE_SECRET` (required)
- `DB_PATH` (required for local/volume storage)
- `NODE_ENV=production`

## Analytics

Replace the placeholder analytics ID (`G-ARCADIA-0001`) in the HTML files with your production
Google Analytics measurement ID before deploying the frontend.

## Database Notes

SQLite is great for local development. For production, consider migrating to a managed Postgres
service (Supabase, Neon, RDS). When you switch, replace the SQLite layer with a Postgres client and
update the database initialization accordingly.

## Post-Deployment Checklist

- Verify `/health` and `/api/status` respond on the backend URL.
- Confirm `/api/auth/login` issues tokens and `/api/auth/session` returns the profile.
- Update frontend fetch URLs if the API runs on a different domain (CORS).
