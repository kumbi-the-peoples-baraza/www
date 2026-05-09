# Architecture Overview

## System Design

Kumbi is a monorepo containing a React SPA frontend, a Go REST API backend, and PostgreSQL as the primary database. All environments — dev, test, staging, and production — run on Kubernetes (k3d locally, external cluster for staging/prod) using the same Kustomize base with per-environment overlays.

```
Browser
  │
  ▼
Traefik Ingress (k3d) / nginx Ingress (prod)
  ├── /          → React SPA (nginx static, port 80)
  ├── /api/*     → Go backend (proxy, port 8080)
  └── /storage/* → Go backend (proxy, static file serving)

Go Backend (port 8080)
  ├── Gin router
  ├── JWT middleware
  └── pgx/v5 → PostgreSQL (port 5432)
```

## Infrastructure

| Layer | Dev / Test | Staging / Prod |
|-------|-----------|----------------|
| Kubernetes | k3d (Docker-in-Docker) | External cluster |
| Ingress | Traefik (k3d built-in) | nginx or Traefik |
| Image source | Local Docker build → `k3d image import` | Registry push → pull |
| Secrets | `infra/k8s/overlays/<env>/secrets.yaml` (gitignored) | Written by CI from GitHub secrets |
| Namespace | `kumbi` (dev/prod), `kumbi-test` (test), `kumbi-staging` (staging) | Same |

### Kustomize overlay structure

```
infra/
├── k3d/
│   ├── dev-cluster.yaml    # k3d dev cluster — port 80, Traefik
│   └── test-cluster.yaml   # k3d test cluster — port 8080, Traefik
└── k8s/
    ├── base/               # Shared: namespace, postgres, backend, frontend, ingress, seed-job
    └── overlays/
        ├── dev/            # IfNotPresent, :dev tags, ENV=development
        ├── test/           # IfNotPresent, :test tags, ENV=test, ns=kumbi-test
        ├── staging/        # registry images, ENV=staging, ns=kumbi-staging
        └── prod/           # registry images, ENV=production, ns=kumbi
```

## Frontend

| Concern              | Library                                        |
| -------------------- | ---------------------------------------------- |
| UI framework         | React 18 + TypeScript                          |
| Build tool           | Vite + Bun                                     |
| Styling              | Tailwind CSS (glass morphism design system)    |
| Component primitives | Radix UI / Shadcn                              |
| Animations           | Framer Motion                                  |
| Server state         | TanStack Query v5                              |
| Client state         | Zustand (persisted)                            |
| Forms                | react-hook-form + Zod                          |
| Rich text            | TipTap                                         |
| HTTP client          | Axios (with JWT interceptor + 401 auto-logout) |
| Routing              | React Router v6 (lazy-loaded routes)           |

### State stores

- `authStore` — user, JWT token, isAuthenticated (persisted to localStorage)
- `themeStore` — dark/light mode, text zoom level (persisted)
- `volunteerStore` — controls the volunteer sheet open/close state

### Route structure

```
/                   Home (parallax hero + project cards)
/projects           Projects listing
/projects/trace     Trace data / Jupyter notebooks
/blog               Social work blog
/about              About us
/contact            Contact form
/volunteer          Volunteer info
/login              CMS login

/cms                Dashboard (protected)
/cms/pages          Page CRUD
/cms/content        Content editor
/cms/media          Media library
/cms/forms          Form submissions + export
/cms/notebooks      Jupyter notebook manager
/cms/users          User management
/cms/analytics      Analytics config
/cms/appearance     Theme / colour settings
```

All CMS routes require a valid JWT. Unauthenticated requests redirect to `/login`.

## Backend

| Concern         | Library                              |
| --------------- | ------------------------------------ |
| HTTP framework  | Gin                                  |
| Database driver | pgx/v5 (pgxpool)                     |
| Auth            | golang-jwt/jwt v5 + bcrypt           |
| Config          | godotenv + os.Getenv                 |
| Logging         | zerolog                              |
| File storage    | Local filesystem (configurable path) |

### Package layout

```
cmd/
  server/   main entrypoint — loads config, connects DB, runs migrations, starts HTTP server
  seed/     CLI tool to create/update an admin user

internal/
  api/
    handlers/   one file per resource (auth, pages, forms, media, notebooks, appearance)
    middleware/ JWT auth, role guard, request logger, panic recovery
    routes/     wires all handlers and middleware onto the Gin engine
  auth/         JWT generation/parsing, bcrypt helpers
  config/       loads env vars, panics on missing required values
  db/           pgxpool connection, schema migrations (run on startup)
  models/       Go structs matching DB tables
  services/     Notifier — sends email (SMTP) and WhatsApp webhook on form submit

pkg/
  logger/       zerolog console logger factory
```

### API surface

```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me                    (JWT required)

GET    /api/v1/pages
GET    /api/v1/pages/:slug
POST   /api/v1/pages                      (admin, editor)
PUT    /api/v1/pages/:id                  (admin, editor)
DELETE /api/v1/pages/:id                  (admin)

POST   /api/v1/forms/contact
POST   /api/v1/forms/volunteer
GET    /api/v1/forms/:type/submissions    (admin, editor)
GET    /api/v1/forms/:type/export/csv     (admin, editor)

POST   /api/v1/media                      (JWT required)
GET    /api/v1/media                      (JWT required)
DELETE /api/v1/media/:id                  (admin)

POST   /api/v1/notebooks                  (admin, editor)
GET    /api/v1/notebooks                  (JWT required)
GET    /api/v1/notebooks/:id              (JWT required)

GET    /api/v1/appearance
PUT    /api/v1/appearance                 (admin)

GET    /api/v1/users                      (admin)
POST   /api/v1/users                      (admin)
PUT    /api/v1/users/:id                  (admin)
DELETE /api/v1/users/:id                  (admin)

GET    /api/v1/analytics
PUT    /api/v1/analytics                  (admin)

GET    /health
GET    /storage/*                         (static file serving)
```

## Database schema

```
users              id, name, email, password (bcrypt), role, active, timestamps
sessions           id, user_id, token_hash, expires_at, created_at
pages              id, slug, title, description, status, display_mode, order, metadata (jsonb), timestamps
content_blocks     id, page_id, type, content, media_url, order, settings (jsonb), timestamps
media_files        id, name, url, mime_type, size, created_at
form_submissions   id, form_type, data (jsonb), created_at
notebooks          id, name, path, uploaded_at
appearance         id, primary_color, secondary_color, gradient_start/end, bg/fg images, dark_mode, font_family
analytics_config   id, config (jsonb), updated_at
```

Migrations run automatically on server startup via `db.Migrate()`. The schema uses `CREATE TABLE IF NOT EXISTS` and `INSERT ... ON CONFLICT DO NOTHING` so it is safe to re-run.

## Security

- Passwords hashed with bcrypt (cost 10)
- JWT HS256, 24-hour expiry, secret from env
- Role-based middleware guards all CMS endpoints
- CORS restricted to `ALLOW_ORIGIN` env var
- Secrets never committed — `infra/k8s/overlays/dev/secrets.yaml` and `infra/k8s/overlays/prod/secrets.yaml` are gitignored; `.env` is native-dev-only
- Backend container runs as UID `65534` (numeric nobody, rootless Docker compatible)
- Production: inject secrets via AWS Secrets Manager, Vault, or CI secrets
