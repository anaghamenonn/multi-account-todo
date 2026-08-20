# Multi-Account Todo Application

A small, production-minded Todo app where every Todo belongs to exactly one
authenticated account. The central requirement this project is built
around is **account-level data isolation**: User A can never see, edit, or
delete User B's Todos, even by guessing/changing an id in the API URL.

- **Frontend**: Next.js (App Router) + TypeScript, authenticating via Auth0
- **Backend**: Django + Django REST Framework, independently verifying
  Auth0-issued access tokens
- **Database**: SQLite by default (zero setup), swappable to PostgreSQL via
  one environment variable

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Running with Docker](#running-with-docker)
- [Environment Variables](#environment-variables)
- [Auth0 Configuration](#auth0-configuration)
- [Database & Migrations](#database--migrations)
- [Running the App](#running-the-app)
- [Tests](#tests)
- [API Reference](#api-reference)
- [Security: How Account Isolation Is Enforced](#security-how-account-isolation-is-enforced)
- [Assumptions & Architectural Decisions](#assumptions--architectural-decisions)

---

## Architecture

```
Next.js (browser)
   │  1. loginWithRedirect() → Auth0 Universal Login → redirected back with a session
   │  2. getAccessTokenSilently() → holds a short-lived Auth0 RS256 access token
   ▼
Django REST API (/api/todos/...)
   │  3. Auth0JWTAuthentication verifies the token's signature (via Auth0's JWKS),
   │     issuer, and audience - independently of anything the frontend claims.
   │  4. The verified "sub" claim is resolved/created into an Account row.
   │  5. Every query is scoped to that Account. No endpoint accepts a
   │     client-supplied user/account id.
   ▼
SQLite / PostgreSQL
```

The frontend is a pure SPA client of the Django API - it never proxies
requests through Next.js API routes, and never itself decides who owns a
Todo. Ownership is decided once, server-side, per request, from the
verified token.

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- `@auth0/auth0-react` (Auth0's SPA SDK - Authorization Code + PKCE flow)
- Django 6, Django REST Framework
- `PyJWT` (with `cryptography`) for RS256 JWT verification against Auth0's JWKS
- `django-cors-headers` for cross-origin requests from the frontend
- SQLite (dev default) / PostgreSQL (via `DATABASE_URL`, using `dj-database-url`)

## Project Structure

```
/
├── backend/
│   ├── config/            # Django project (settings, urls)
│   ├── accounts/          # Account model + Auth0 JWT authentication class
│   ├── todos/              # Todo model, serializer, viewset, permissions, tests
│   ├── manage.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── page.tsx        # redirects to /login or /dashboard
│   │   ├── login/page.tsx  # app name + Login button
│   │   ├── dashboard/page.tsx
│   │   └── providers.tsx   # Auth0Provider wrapper
│   ├── components/         # TodoForm, TodoItem, TodoList, LoginButton, ...
│   ├── hooks/useTodos.ts   # data fetching + mutations + loading/error state
│   ├── lib/api.ts          # centralized fetch client (auth header, error mapping)
│   ├── types/todo.ts
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml
└── README.md
```

## Setup

Prerequisites: Node.js 20+, Python 3.12+, an Auth0 account (free tier is fine).

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows
# source venv/bin/activate       # macOS/Linux

pip install -r requirements.txt

cp .env.example .env             # then fill in AUTH0_DOMAIN / AUTH0_AUDIENCE
python manage.py migrate
python manage.py runserver       # http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install

cp .env.example .env.local       # then fill in the NEXT_PUBLIC_AUTH0_* values
npm run dev                      # http://localhost:3000
```

Visit `http://localhost:3000` - it redirects to `/login`.

## Running with Docker

Alternative to the manual setup above. Requires Docker Desktop.

```bash
cp backend/.env.example backend/.env             # fill in AUTH0_DOMAIN / AUTH0_AUDIENCE
cp frontend/.env.example frontend/.env.local     # fill in the NEXT_PUBLIC_AUTH0_* values

docker compose up --build
```

This builds and runs both services: Django on `http://localhost:8000`
(migrations applied automatically on start) and Next.js on
`http://localhost:3000`. Both source trees are bind-mounted into their
containers, so code edits on the host are picked up live, same as running
them natively. Uses the default SQLite database inside `backend/` unless
`DATABASE_URL` is set in `backend/.env`.

```bash
docker compose down          # stop and remove containers
```

## Environment Variables

### `backend/.env`

| Variable | Description |
|---|---|
| `DJANGO_SECRET_KEY` | Django's cryptographic secret key. Generate a real one for anything beyond local dev. |
| `DJANGO_DEBUG` | `True`/`False`. |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated hostnames Django will serve. |
| `AUTH0_DOMAIN` | Your Auth0 tenant domain, e.g. `your-tenant.us.auth0.com`. Used to fetch the JWKS that verifies token signatures. |
| `AUTH0_AUDIENCE` | The API identifier configured in Auth0 (see below). Tokens not issued for this audience are rejected. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins allowed to call the API from a browser (the frontend's URL). |
| `DATABASE_URL` | Optional. If set (e.g. `postgres://user:pass@host:5432/dbname`), Postgres is used instead of the default SQLite file. |

### `frontend/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_AUTH0_DOMAIN` | Same Auth0 tenant domain as the backend. |
| `NEXT_PUBLIC_AUTH0_CLIENT_ID` | Client ID of the Auth0 **Single Page Application** you register (see below). |
| `NEXT_PUBLIC_AUTH0_AUDIENCE` | Same value as the backend's `AUTH0_AUDIENCE` - this is what makes Auth0 issue a JWT `access_token` scoped to your API instead of an opaque token. |
| `NEXT_PUBLIC_API_URL` | Base URL of the Django backend, e.g. `http://localhost:8000`. |

All `NEXT_PUBLIC_*` variables are inlined into the browser bundle at build
time by Next.js - this is expected here, since the frontend is a public
SPA client with no client secret to protect. Real secrets (`AUTH0_CLIENT_SECRET`
in the assignment's example `.env.example`) live only on the backend, and
only if you extend this app to call Auth0's Management API, which the
current implementation does not need (see [Assumptions](#assumptions--architectural-decisions)).

Neither `.env` nor `.env.local` is committed - copy the `.env.example`
files and fill in real values locally.

## Auth0 Configuration

1. **Create an API** (Applications → APIs): this represents the Django
   backend.
   - Identifier: any URI-like string, e.g. `https://todo-api.local` - this
     becomes both `AUTH0_AUDIENCE` and `NEXT_PUBLIC_AUTH0_AUDIENCE`.
   - Signing algorithm: RS256 (default).
2. **Create an Application** (Applications → Applications) of type
   **Single Page Application**: this represents the Next.js frontend.
   - Note its **Domain** and **Client ID** → `NEXT_PUBLIC_AUTH0_DOMAIN` /
     `NEXT_PUBLIC_AUTH0_CLIENT_ID`.
   - **Allowed Callback URLs**: `http://localhost:3000`
   - **Allowed Logout URLs**: `http://localhost:3000/login`
   - **Allowed Web Origins**: `http://localhost:3000`
3. No password/database connection setup is required beyond Auth0's
   defaults - this app never talks to Auth0's Management API and never
   implements its own credential storage.

## Database & Migrations

SQLite is used by default (`backend/db.sqlite3`, gitignored) - nothing to
install. To use Postgres instead, set `DATABASE_URL` in `backend/.env` and
re-run migrations; no code changes are needed since the database
configuration is read from that single variable.

```bash
python manage.py makemigrations   # only needed if you change the models
python manage.py migrate
python manage.py createsuperuser  # optional, for /admin/
```

## Running the App

With both servers running (backend on :8000, frontend on :3000):

1. Open `http://localhost:3000` → redirected to `/login`.
2. Click **Log In** → Auth0 Universal Login → redirected back, now on
   `/dashboard`.
3. Create, edit, complete/uncomplete, delete, filter (All/Active/Completed),
   and search todos by title.
4. **Log Out** clears the session and returns to `/login`.

## Tests

Backend tests cover authentication and, most importantly, cross-account
isolation - without needing real Auth0 credentials. A throwaway RSA
keypair is generated at test time, used to sign fake access tokens, and
`PyJWKClient.get_signing_key_from_jwt` is patched so the real
`Auth0JWTAuthentication` code path verifies those tokens against the test
public key instead of calling out to Auth0.

```bash
cd backend
python manage.py test
```

Covers: unauthenticated requests rejected (401), invalid/wrong-audience
tokens rejected, an account is lazily created from a first valid token,
create/list/update/delete of one's own todos, status filtering, **and**
the isolation guarantees: User A cannot GET/PATCH/DELETE User B's todo
(404, not 403 - so existence isn't leaked either), and `account`/`account_id`
sent in a request body is silently ignored, never trusted.

No frontend automated tests are included; it was manually verified
against the two-account scenario described below.

## API Reference

All endpoints require `Authorization: Bearer <auth0 access token>`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/todos/` | List the authenticated account's todos. Supports `?status=active\|completed`, `?search=<title text>`, `?page=`. |
| POST | `/api/todos/` | Create a todo owned by the authenticated account. Body: `{ "title": string, "description"?: string }`. |
| GET | `/api/todos/:id/` | Retrieve one of the authenticated account's todos. 404 if it doesn't exist *or* belongs to someone else. |
| PATCH | `/api/todos/:id/` | Partially update (`title`, `description`, `completed`). |
| DELETE | `/api/todos/:id/` | Delete. |

Error responses are consistent JSON (`{"detail": "..."}` or
DRF's per-field validation errors), which the frontend's `lib/api.ts` maps
to plain-language messages for 400/401/403/404/network failures.

## Security: How Account Isolation Is Enforced

This is the part of the assignment worth being precise about:

1. **The frontend never sends an account/user id.** `TodoSerializer` does
   not even declare an `account` field, so nothing in a request body can
   set or change ownership - see [`backend/todos/serializers.py`](backend/todos/serializers.py).
2. **The backend determines the account from the verified token, every
   request.** [`accounts/authentication.py`](backend/accounts/authentication.py)
   verifies the JWT's signature (against Auth0's public JWKS), `iss`, and
   `aud`, then resolves the token's `sub` claim to an `Account` row
   (creating it on first sight). That `Account` becomes `request.user`.
3. **Every query is scoped to `request.user`.**
   [`TodoViewSet.get_queryset()`](backend/todos/views.py) filters with
   `Todo.objects.filter(account=self.request.user)` for list *and* for
   detail/update/delete (DRF's `get_object()` looks up within
   `get_queryset()`). Requesting another account's todo id therefore 404s
   - it isn't found in the query, rather than being found and rejected -
   which also avoids leaking whether a given id exists at all.
4. **Object-level permission as defense in depth.** `TodoViewSet` also
   applies `IsOwner` (`has_object_permission`), so even if the queryset
   filter were ever loosened by a future change, a mismatched `account_id`
   would still be rejected.
5. **`perform_create()`** sets `account=self.request.user` explicitly -
   ownership is never inferred from serializer input.

Manually verified: created two Auth0 test users, gave each two todos, and
confirmed that neither user's token can list, retrieve, update, or delete
the other's todos - including by hand-editing the `:id` in the URL.

## Assumptions & Architectural Decisions

- **SPA pattern, not a Next.js backend-for-frontend.** The frontend talks
  directly to Django with a Bearer token via `@auth0/auth0-react`, rather
  than using `@auth0/nextjs-auth0` with server-side sessions and Next.js
  API routes as a proxy. This matches the assignment's description
  ("frontend uses Auth0... Django backend must also validate the token")
  and keeps the architecture to two services instead of three, at the cost
  of the access token living in the browser (mitigated by using
  short-lived tokens and Auth0's recommended SPA configuration).
- **No `AUTH0_CLIENT_SECRET` is used anywhere.** The frontend's Auth0
  application is a public SPA client (Authorization Code + PKCE), which by
  design has no client secret. The backend only *verifies* tokens (JWKS +
  RS256), which also requires no secret. The assignment's example
  `.env.example` lists `AUTH0_CLIENT_SECRET` as a generic placeholder; it
  isn't populated here because nothing in this implementation calls
  Auth0's Management/token-exchange APIs that would need it.
- **`Account` doubles as `request.user`.** Rather than pulling in Django's
  full `auth.User` model (with passwords, permissions, etc. this app
  doesn't use), `Account` duck-types `is_authenticated`/`is_anonymous` so
  DRF's `IsAuthenticated` and `request.user.id` work directly against it.
  This keeps the "no complex user management system" requirement literal.
- **Accounts are created lazily**, on the first request bearing a valid
  token for a given Auth0 `sub`. There is no separate signup/provisioning
  endpoint, since Auth0 already owns signup.
- **SQLite by default.** Simplest possible local setup; switching to
  Postgres is a single `DATABASE_URL` env var away via `dj-database-url`,
  no code changes.
- **Pagination, search, and status filtering are implemented** (bonus
  requirements) since they were cheap given the viewset/queryset structure
  already in place for isolation.
- **Docker Compose is included** (`docker-compose.yml`, dev-mode
  Dockerfiles with bind mounts) as a convenience for reviewers - it isn't
  the primary documented workflow, since the native setup in
  [Setup](#setup) needs no Docker at all.
- **No public deployment** included, to keep scope inside the assignment's
  4-6 hour target.
