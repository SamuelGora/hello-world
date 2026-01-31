# Arcadia Clash Backend

This service runs the Fastify-based backend for the tournament platform.

## Scripts

```bash
npm install
npm run dev
```

## Database

The service uses a local SQLite database by default at `./data/arcadia.db`.
You can override the path with `DB_PATH`.

```bash
DB_PATH=./data/arcadia.db npm run dev
```

## Authentication

Set `JWT_SECRET` in your environment for signing login tokens and `COOKIE_SECRET` for session cookies.

Authentication now uses a short-lived access token plus a secure refresh cookie. The refresh cookie is
HTTP-only and used by `/api/auth/session` and `/api/auth/refresh` to mint new access tokens. Use
the returned `csrfToken` for state-changing requests that hit cookie-based auth endpoints.

## Endpoints

- `GET /health` — basic health check
- `GET /api/status` — service metadata
- `GET /api/db-status` — database connectivity check
- `POST /api/auth/register` — create user account
- `POST /api/auth/login` — authenticate and receive JWT
- `GET /api/auth/session` — load session via refresh cookie
- `POST /api/auth/refresh` — refresh access token (requires CSRF)
- `POST /api/auth/logout` — clear session (requires CSRF)
- `GET /api/me` — current user profile (requires JWT)
- `GET /api/users` — list users
- `POST /api/users` — create user
- `GET /api/teams` — list teams
- `POST /api/teams` — create team
- `POST /api/teams/:teamId/members` — add team member
- `GET /api/roles` — list roles
- `POST /api/roles` — create role
- `POST /api/users/:userId/roles` — assign role to user
- `GET /api/tournaments` — list tournaments
- `POST /api/tournaments` — create tournament
- `GET /api/events` — list events
- `POST /api/events` — create event
- `GET /api/schedule` — list scheduled matches
- `GET /api/matches` — list matches
- `GET /api/matches/latest` — latest match with scores
- `POST /api/matches` — create match
- `POST /api/matches/:matchId/result` — add/update match result
- `GET /api/standings` — list standings
- `POST /api/registrations` — register team for tournament
- `GET /api/brackets` — list brackets
- `POST /api/brackets` — create bracket
- `GET /api/support/tickets` — list support tickets (admin only)
- `POST /api/support/tickets` — create support ticket
- `GET /api/admin/actions` — list admin actions
- `POST /api/admin/actions` — log admin action
- `POST /api/tournament-signups` — submit tournament signup interest
