# Architecture Overview

## System Design

Kumbi is a monorepo containing a React SPA frontend, a Go REST API backend, and PostgreSQL. All environments — dev, test, staging, and production — run on Kubernetes (k3d locally, external cluster for staging/prod) using the same Kustomize base with per-environment overlays.

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
| Kubernetes | k3d (k3s in Docker, rootless) | External cluster |
| Ingress | Traefik (k3d built-in) | nginx or Traefik |
| Image import | `docker save \| docker exec -i k3d-<cluster>-server-0 ctr images import -` | Registry push → pull |
| Secrets | `infra/k8s/overlays/<env>/secrets.yaml` (gitignored) | Written by CI from GitHub secrets |
| Namespace | `kumbi` (dev/prod), `kumbi-test` (test), `kumbi-staging` (staging) | Same |

> **Rootless Docker note:** `k3d image import` requires `/var/run/docker.sock` and does not work with rootless Docker. The Makefile pipes images directly via `docker exec` into the k3d containerd socket instead.

### Kustomize overlay structure

```
infra/
├── k3d/
│   ├── dev-cluster.yaml    # k3d dev — port 80:80, Traefik, rootless-compatible flags
│   └── test-cluster.yaml   # k3d test — port 8080:80
└── k8s/
    ├── base/               # Shared: namespace, postgres, backend, frontend, ingress, seed-job
    └── overlays/
        ├── dev/            # IfNotPresent, :dev tags, ENV=development, ns=kumbi
        ├── test/           # IfNotPresent, :test tags, ENV=test, ns=kumbi-test
        ├── staging/        # registry images, ENV=staging, ns=kumbi-staging
        └── prod/           # registry images, ENV=production, ns=kumbi
```

## Frontend

| Concern | Library |
|---------|---------|
| UI framework | React 18 + TypeScript |
| Build tool | Vite + Bun |
| Styling | Tailwind CSS + custom design system (sky-blue palette, glass morphism) |
| Animations | Framer Motion (parallax, page transitions) |
| Server state | TanStack Query v5 |
| Client state | Zustand (persisted to localStorage) |
| Forms | react-hook-form + Zod |
| Rich text editor | TipTap (StarterKit + Link + Image extensions) |
| HTTP client | Axios (JWT interceptor + 401 auto-logout) |
| Routing | React Router v6 (lazy-loaded routes) |

### Themes

Three themes selectable from the navbar: **Light** (sky blue), **Dim** (amber/incandescent), **Dark** (near-black + electric blue). Applied as a class on `<html>` via `useEffect`. Text zoom also controlled from the accessibility widget (bottom-right).

### State stores

| Store | Purpose |
|-------|---------|
| `authStore` | User, JWT token, isAuthenticated (persisted) |
| `themeStore` | Theme (light/dim/dark), text zoom (persisted) |
| `volunteerStore` | Volunteer overlay open/close |
| `contactStore` | Contact overlay open/close |

### Route structure

```
/                   Home — parallax hero, project cards, volunteer CTA
/projects           Projects listing (reads from site_config)
/projects/trace     KumbiTrace — features + notebook placeholder
/blog               Blog — fetches published posts from API
/about              About us — story from site_config
/volunteer          Volunteer info + registration overlay
/contact            → intercepted by Layout, opens ContactOverlay

/cms                Dashboard (JWT protected)
/cms/site-content   Site Content editor — all page text, images, nav, footer
/cms/pages          Page CRUD
/cms/blog           Blog post CRUD with rich text editor
/cms/content        Content block editor (per page)
/cms/media          Media library
/cms/forms          Form submissions + CSV export
/cms/notebooks      Jupyter notebook manager
/cms/users          User management (admin only)
/cms/analytics      Analytics config
/cms/appearance     Colour/theme settings
```

### Overlays (right-side panels, React Portal)

All three overlays render via `createPortal(…, document.body)` — bypassing all CSS stacking contexts — at `z-index: 9999`. Width: 100% mobile → 55% md → 40% xl.

| Overlay | Trigger |
|---------|---------|
| `LoginOverlay` | Padlock icon in navbar |
| `ContactOverlay` | "Contact Us" nav link or footer button |
| `VolunteerSheet` | "Volunteer" nav link or CTA button |

## Backend

| Concern | Library |
|---------|---------|
| HTTP framework | Gin |
| Database driver | pgx/v5 (pgxpool) |
| Auth | golang-jwt/jwt v5 + bcrypt |
| Config | godotenv + os.Getenv |
| Logging | zerolog |
| File storage | Local filesystem (configurable path) |

### Package layout

```
cmd/
  server/   main entrypoint — config, DB connect, migrations, HTTP server
  seed/     CLI — create/update admin user

internal/
  api/
    handlers/   auth, pages, content, blog, config, forms, media,
                notebooks, appearance, users, analytics
    middleware/ JWT auth, role guard, request logger, panic recovery
    routes/     wires all handlers onto the Gin engine
  auth/         JWT generation/parsing, bcrypt helpers
  config/       env var loader
  db/           pgxpool connection + schema migrations (run on startup)
  services/     Notifier — SMTP email + WhatsApp webhook on form submit
```

### API surface

```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me                       (JWT)

GET    /api/v1/config                        (public)
PUT    /api/v1/config                        (admin, editor)

GET    /api/v1/pages
GET    /api/v1/pages/:slug
POST   /api/v1/pages                         (admin, editor)
PUT    /api/v1/pages/:id                     (admin, editor)
DELETE /api/v1/pages/:id                     (admin)

GET    /api/v1/content/:pageId               (JWT)
POST   /api/v1/content/:pageId               (admin, editor)
PUT    /api/v1/content/:id                   (admin, editor)
DELETE /api/v1/content/:id                   (admin, editor)

GET    /api/v1/blog                          (public — published only)
GET    /api/v1/blog/:slug                    (public)
GET    /api/v1/blog/all                      (JWT — all including drafts)
POST   /api/v1/blog                          (admin, editor)
PUT    /api/v1/blog/:id                      (admin, editor)
DELETE /api/v1/blog/:id                      (admin)

POST   /api/v1/forms/contact
POST   /api/v1/forms/volunteer
GET    /api/v1/forms/:type/submissions       (admin, editor)
GET    /api/v1/forms/:type/export/csv        (admin, editor)

POST   /api/v1/media                         (JWT)
GET    /api/v1/media                         (JWT)
DELETE /api/v1/media/:id                     (admin)

POST   /api/v1/notebooks                     (admin, editor)
GET    /api/v1/notebooks                     (JWT)
GET    /api/v1/notebooks/:id                 (JWT)

GET    /api/v1/appearance
PUT    /api/v1/appearance                    (admin)

GET    /api/v1/users                         (admin)
POST   /api/v1/users                         (admin)
PUT    /api/v1/users/:id                     (admin)
DELETE /api/v1/users/:id                     (admin)

GET    /api/v1/analytics
PUT    /api/v1/analytics                     (admin)

GET    /health
GET    /storage/*
```

## Database schema

```
users              id, name, email, password (bcrypt), role, active, timestamps
sessions           id, user_id, token_hash, expires_at, created_at
pages              id, slug, title, description, status, display_mode, order, metadata (jsonb), timestamps
content_blocks     id, page_id, type, content, media_url, order, settings (jsonb), timestamps
blog_posts         id, slug, title, excerpt, body, cover_image, status, author_id, published_at, timestamps
media_files        id, name, url, mime_type, size, created_at
form_submissions   id, form_type, data (jsonb), created_at
notebooks          id, name, path, uploaded_at
appearance         id, primary_color, secondary_color, gradient_start/end, bg/fg images, dark_mode, font_family
analytics_config   id, config (jsonb), updated_at
site_config        id='default', data (jsonb), updated_at
```

`site_config` stores all editable public-site content as a single JSONB document: nav brand/tagline, hero heading/image/CTAs, project card text and images, volunteer section, footer details, and per-page hero images. Edited via `/cms/site-content`.

Migrations run automatically on server startup (`db.Migrate()`). All statements use `CREATE TABLE IF NOT EXISTS` / `INSERT … ON CONFLICT DO NOTHING` — safe to re-run.

## Security

- Passwords hashed with bcrypt (cost 10)
- JWT HS256, 24-hour expiry, secret from env
- Role-based middleware guards all CMS endpoints (`admin` > `editor` > `viewer`)
- CORS restricted to `ALLOW_ORIGIN` env var
- Secrets never committed — all `secrets.yaml` files and `.env` are gitignored
- Backend container runs as UID `65534` (nobody, rootless Docker compatible)
- Production: inject secrets via CI environment variables written to `secrets.yaml` at deploy time
