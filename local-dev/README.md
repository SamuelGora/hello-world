# Local-First Implementation

This folder provides a parallel, explicit local-first implementation of the backend that mirrors
the main API behavior without hidden plugin/decorator registration. It is designed for predictable
local execution with a single `npm run dev` command.

## Folder Structure

```
local-dev/
  README.md
  backend/
    local-index.js   # single bootstrap file (plugins + decorators)
    routes.js        # route definitions only (no plugins/decorators)
    db.js            # local SQLite schema + init
    package.json
    .env.example
```

## Local Backend Commands

```bash
cd local-dev/backend
cp .env.example .env
npm install
npm run dev
```

Backend runs on `http://localhost:3001` and allows frontend requests from
`http://localhost:4173`.

## Local Frontend Command

From the repo root:

```bash
python -m http.server 4173
```

Frontend runs on `http://localhost:4173`.

## Architecture Notes

- **Global setup lives in** `local-dev/backend/local-index.js`:
  - `@fastify/cors`, `@fastify/cookie`, `@fastify/jwt` plugins
  - `authenticate` + `requireRoles` decorators
- **Route logic lives in** `local-dev/backend/routes.js` and does not register plugins or decorators.
- **Database setup lives in** `local-dev/backend/db.js`.

This keeps plugin/decorator registration centralized and explicit, avoiding hidden coupling or
implicit execution order.
