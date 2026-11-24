# Finovo Souq - Frontend

React + Vite + TypeScript frontend for the Finovo Souq classifieds marketplace (MERN stack).
Clean light dashboard UI with role-based areas for **admin** and **user** (one account buys and sells),
matching the roles in the backend user model.

## Run

```bash
# 1. Backend (repo root/backend): needs MongoDB, Redis and a .env with MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
cd backend && npm install && npm run dev      # http://localhost:5000

# 2. Frontend
cd frontend && npm install && npm run dev     # http://localhost:5177
npm run build      # production build in dist/
npm run lint
```

In development the frontend calls `/api/v1/...` on its own server and Vite proxies it to the backend,
so the httpOnly refresh-token cookie works without any CORS setup.

## Environment

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base. `/api/v1` in development (proxied); full URL in production, e.g. `https://api.example.com/api/v1` |
| `VITE_PROXY_TARGET` | Where the dev proxy sends `/api` (default `http://localhost:5000`) |
| `VITE_USE_MOCK_API` | `true` = everything runs on the built-in mock API, no backend needed (demo). |
| `VITE_MOCK_PENDING_ENDPOINTS` | `true` = auth uses the real backend; endpoints the backend does not have yet (listings, messages, dashboards...) use the mock API. |

Both mock flags must be `false` in production. When the frontend is served from another domain,
set the backend `CLIENT_URL` to the frontend URL (CORS with credentials).

### Backend endpoints already connected

`POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` (cookie), `POST /auth/logout` (with `sessionId`),
`GET /auth/me`. The list lives in `LIVE_ENDPOINTS` in `src/api/endpoints.ts`: add an endpoint there once the backend serves it.

### Demo accounts (mock mode only)

| Role | Email | Password |
|---|---|---|
| Admin | admin@finovosouq.com | Admin@123 |
| User | user@finovosouq.com | User@1234 |

With the real backend, register normally. To make an admin, set `role: "admin"` on the user in MongoDB.

## Structure

```
src/
  api/            client.ts (fetch, timeout, token refresh), endpoints.ts, errors.ts, normalize.ts, mock/ (mock API)
  services/       one file per API area (auth, listings, admin, dashboards, chat, saved, notifications)
  features/auth/  AuthContext, guards, rbac.ts, navigation.ts, validation.ts, auth pages
  features/saved/ saved-ads provider (optimistic save/unsave)
  layouts/        PublicLayout, AuthLayout, DashboardLayout (role-based sidebar)
  pages/          public/, admin/, account/, shared/
  components/     ui/, charts/ (SVG, no chart library), listings/, dashboard/
  styles/         tokens.css (design tokens), base, components, layout, pages
```

## Routes

- Public: `/`, `/search`, `/listings/:id`
- Auth: `/login`, `/register`, `/forgot-password`
- Admin: `/admin/dashboard`, `/admin/moderation`, `/admin/reports`, `/admin/users`, `/admin/notifications`, `/admin/profile`
- User: `/account/dashboard`, `/account/listings`, `/account/listings/new`, `/account/listings/:id/edit`,
  `/account/saved`, `/account/messages`, `/account/notifications`, `/account/profile`

A user opening another role's area is redirected to their own dashboard. The API must still enforce roles and ownership.

## API contract notes for the backend

- Success: `{ statusCode, success: true, message, data }`; errors: `{ success: false, message, errors?: string[] }`.
  Validation sentences in `errors` are shown under the matching form field.
- Endpoints still to build follow the Technical Plan, section 8 (`src/api/endpoints.ts`); response shapes are in `src/types/index.ts`.
- Proposed extra endpoints: `GET /admin/dashboard`, `GET /dashboard/user`, `PATCH /admin/reports/:id/status`,
  `PATCH /users/me` (name, phone, city), `POST /auth/password/forgot`.
