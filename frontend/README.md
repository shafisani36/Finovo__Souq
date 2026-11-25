# Finovo Souq - Frontend

React + Vite + TypeScript frontend for the Finovo Souq classifieds marketplace (MERN stack).
Clean light dashboard UI with role-based areas for **admin** and **user** (one account buys and sells),
matching the roles in the backend user model.

## Run

```bash
# 1. Backend (repo root/backend): needs MongoDB, Redis and a .env (see backend/.env.example)
cd backend && npm install && npm run dev      # http://localhost:5000

# 2. Frontend
cd frontend && npm install && npm run dev     # http://localhost:5177
npm run build      # production build in dist/
npm run lint
```

In development the frontend calls `/api/v1/...` and `/socket.io` on its own server and Vite proxies both
to the backend, so the httpOnly refresh-token cookie and the live chat work without any CORS setup.

## Environment

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base, `/api/v1` by default |
| `VITE_PROXY_TARGET` | Development only: where Vite proxies `/api` and `/socket.io` (default `http://localhost:5000`) |

In production serve the frontend and the API on the same site (for example nginx sending `/api` and `/socket.io`
to the backend), because the refresh-token cookie is `SameSite=Strict`. Set the backend `CLIENT_URL` to the site URL.

To make an admin, register normally and set `role: "admin"` on that user in MongoDB.

## Chat

- Buyers start a chat from an ad ("Message seller"); one conversation per buyer per ad.
- Text, photos and voice messages (up to 2 minutes, recorded in the browser). Photos are re-encoded on the
  server, which removes location data; chat files are private and only reachable through links that expire after an hour.
- New messages, read receipts (two ticks), "typing..." and notifications arrive live over Socket.IO.
- People can delete their own messages and block the other person in a conversation.

## Structure

```
src/
  api/            client.ts (fetch, timeout, token refresh), endpoints.ts, errors.ts, normalize.ts
  services/       one file per API area (auth, listings, admin, dashboards, chat, saved, notifications)
  features/auth/  AuthContext, guards, rbac.ts, navigation.ts, validation.ts, auth pages
  features/realtime/ Socket.IO connection and useSocketEvent hook
  features/saved/ saved-ads provider (optimistic save/unsave)
  layouts/        PublicLayout, AuthLayout, DashboardLayout (role-based sidebar)
  pages/          public/, admin/, account/, shared/
  components/     ui/, charts/ (SVG, no chart library), listings/, dashboard/, chat/ (bubbles, voice recorder and player), marketing/
  styles/         tokens.css (design tokens), base, components, layout, pages
```

## Routes

- Public: `/`, `/search`, `/listings/:id`
- Public pages: `/about`, `/faq`, `/contact`
- Auth: `/login`, `/register`
- Admin: `/admin/dashboard`, `/admin/moderation`, `/admin/reports`, `/admin/users`, `/admin/notifications`, `/admin/profile`
- User: `/account/dashboard`, `/account/listings`, `/account/listings/new`, `/account/listings/:id/edit`,
  `/account/saved`, `/account/messages`, `/account/notifications`, `/account/profile`

A user opening another role's area is redirected to their own dashboard. The API must still enforce roles and ownership.

## API

Success responses are `{ statusCode, success: true, message, data }`; errors are
`{ success: false, message, errors?: (string | { field, message })[] }`, and field errors are shown under the matching input.
All endpoints are listed in `src/api/endpoints.ts` and the response shapes in `src/types/index.ts`.
