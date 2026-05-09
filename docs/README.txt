================================================================================
  Kumbi — Community Projects & Social Work Platform
================================================================================

OVERVIEW
--------
Kumbi is a full-stack web platform for community projects and social work.
It has a public-facing React SPA and a protected CMS for managing all content.

TECH STACK
----------
  Frontend : React 18, TypeScript, Vite, Bun, Tailwind CSS, Framer Motion,
             TanStack Query, Zustand, Zod, react-hook-form, TipTap, Axios
  Backend  : Go 1.23, Gin, pgx/v5, golang-jwt, bcrypt, zerolog
  Database : PostgreSQL 16
  Infra    : Docker (rootless), Docker Compose, Kubernetes (microk8s),
             Kustomize, nginx ingress, GitHub Actions

QUICK START
-----------
Native dev (postgres via Docker Compose, backend + frontend natively):

  1. Install prerequisites: Go 1.23+, Bun, Docker

  2. Clone and configure secrets:
       cp .env.example .env
       # Edit .env — set DATABASE_URL and JWT_SECRET at minimum

  3. Install dependencies:
       make setup

  4. Start development:
       make dev

  5. Open in browser:
       Public site : http://localhost:5173
       CMS         : http://localhost:5173/cms
       Backend API : http://localhost:8080

Kubernetes dev (microk8s):

  1. Install prerequisites: Go 1.23+, Bun, Docker, microk8s

  2. Configure secrets:
       cp infra/k8s/overlays/dev/secrets.yaml.example infra/k8s/overlays/dev/secrets.yaml
       # Edit secrets.yaml with your values

  3. Build, import images, and deploy:
       make k8s-dev-up

       Frontend + CMS : http://localhost
       Backend API    : http://localhost/api

SECRETS MANAGEMENT
------------------
Secrets live entirely within the infra stack — never in the repository.

  Context                  Location
  ─────────────────────────────────────────────────────────────────────────────
  Native dev / Compose     .env  (copy from .env.example)
  Kubernetes dev           infra/k8s/overlays/dev/secrets.yaml  (copy from .example)
  Kubernetes prod          infra/k8s/overlays/prod/secrets.yaml (copy from .example)

All three are gitignored. .env is only read by native dev and Docker Compose.
Kubernetes reads exclusively from its own Secret manifests.

MAKE TARGETS
------------
  make setup              Install all dependencies (bun install + go mod download)
  make dev                Start postgres (Docker), backend, and frontend natively
  make build              Build frontend (dist/) and backend (bin/server)
  make test               Run go test ./... and bun run test
  make lint               Run go vet and eslint
  make compose-up         Build and start all services via Docker Compose
  make compose-down       Stop Docker Compose services
  make compose-logs       Tail all service logs
  make k8s-dev-up         Build images, import into microk8s, apply dev overlay
  make k8s-dev-down       Remove all kumbi resources from cluster
  make k8s-dev-seed       Re-run seed-admin job in cluster
  make k8s-status         Show pods, services, ingress
  make k8s-prod-deploy    Full production deploy (build + push + apply + rollout + seed)
  make k8s-teardown       Delete kumbi namespace (destructive)
  make seed               Seed/reset admin user (reads SEED_ADMIN_* from .env)
  make create-user NAME=.. EMAIL=.. PASS=.. ROLE=..

Run `make help` for the full list with descriptions.

REQUIRED ENVIRONMENT VARIABLES
-------------------------------
  DATABASE_URL   PostgreSQL connection string
                 e.g. postgres://kumbi:secret@localhost:5432/kumbi?sslmode=disable
  JWT_SECRET     Random string, minimum 32 characters

OPTIONAL ENVIRONMENT VARIABLES
-------------------------------
  PORT                  Backend HTTP port (default: 8080)
  ENV                   development | production (default: development)
  ALLOW_ORIGIN          CORS allowed origin (default: http://localhost:5173)
  STORAGE_PATH          Path for uploaded files (default: ./storage)
  SMTP_HOST             SMTP server for email notifications
  SMTP_PORT             SMTP port (default: 587)
  SMTP_USER             SMTP username / from address
  SMTP_PASS             SMTP password
  WHATSAPP_WEBHOOK_URL  Webhook URL for WhatsApp form notifications

PROJECT STRUCTURE
-----------------
  kumbi/
  ├── frontend/
  │   ├── src/
  │   │   ├── api/            Axios client + typed API functions
  │   │   ├── components/
  │   │   │   ├── cms/        CMS pages (Dashboard, Pages, Media, Forms, ...)
  │   │   │   ├── forms/      VolunteerSheet (slide-in panel)
  │   │   │   ├── layout/     Navbar, Footer, Layout, CMSLayout
  │   │   │   ├── pages/      Public pages (Home, Projects, Blog, Contact, ...)
  │   │   │   └── ui/         Skeleton, PageLoader, RichTextarea
  │   │   ├── lib/            utils (cn, downloadBlob)
  │   │   ├── store/          Zustand stores (auth, theme, volunteer)
  │   │   └── types/          TypeScript interfaces
  │   ├── Dockerfile
  │   ├── nginx.conf
  │   ├── tailwind.config.js
  │   └── vite.config.ts
  │
  ├── backend/
  │   ├── cmd/
  │   │   ├── server/         Main entrypoint
  │   │   └── seed/           Admin user seeder CLI
  │   ├── internal/
  │   │   ├── api/
  │   │   │   ├── handlers/   auth, pages, content, forms, media, notebooks, appearance, users, analytics
  │   │   │   ├── middleware/ JWT auth, role guard, logger, recovery
  │   │   │   └── routes/     Gin router setup
  │   │   ├── auth/           JWT generation/parsing, bcrypt
  │   │   ├── config/         Env var loader
  │   │   ├── db/             pgxpool connection + auto-migrations
  │   │   ├── models/         Go structs for DB tables
  │   │   └── services/       Email + WhatsApp notifier
  │   ├── pkg/logger/         zerolog factory
  │   └── Dockerfile
  │
  ├── infra/
  │   └── k8s/
  │       ├── base/           Shared K8s manifests (namespace, postgres, backend, frontend, ingress, seed-job)
  │       └── overlays/
  │           ├── dev/        microk8s dev overlay — secrets template, IfNotPresent pull policy
  │           └── prod/       Production overlay — registry images, prod secrets template
  │
  ├── docs/                   Full documentation (see below)
  ├── .env.example            Native dev secrets template (Kubernetes uses infra/k8s/overlays/)
  ├── docker-compose.yml      All-in-one Compose config
  ├── Makefile                Main CLI
  └── .github/workflows/ci.yml

DOCUMENTATION
-------------
  docs/architecture.md   System design, API surface, DB schema, security model
  docs/backend.md        Backend setup, env vars, adding handlers, roles
  docs/frontend.md       Design system, adding pages/CMS sections, forms, stores
  docs/cms-guide.md      CMS user guide (pages, media, forms, appearance, users)
  docs/deployment.md     Dev setup, production deploy, secrets management, CI/CD

PUBLIC PAGES
------------
  /               Home — parallax hero, project highlights, volunteer CTA
  /projects       Projects listing — placeholder
  /projects/trace Trace data / Jupyter notebook viewer — placeholder
  /blog           Social work blog — placeholder
  /about          About us — placeholder
  /contact        Contact form (sends email + WhatsApp)
  /volunteer      Volunteer information + slide-in registration form
  /login          CMS login

CMS PAGES (requires login)
---------------------------
  /cms              Dashboard with stats
  /cms/pages        Full CRUD for all site pages
  /cms/content      Content block editor (text, image, video, audio, PDF, notebook, form)
  /cms/media        Upload and manage images, video, audio, PDFs
  /cms/forms        View and export contact/volunteer submissions
  /cms/notebooks    Upload and manage Jupyter notebooks
  /cms/users        User, role, and session management (admin only)
  /cms/analytics    JSON analytics configuration store
  /cms/appearance   Colours, gradients, fonts, dark/light mode

SECURITY NOTES
--------------
  - Passwords are hashed with bcrypt (cost 10)
  - JWTs use HS256 with a 24-hour expiry
  - All CMS endpoints require a valid JWT
  - Role-based access: admin > editor > viewer
  - CORS is restricted to ALLOW_ORIGIN
  - Backend container runs as UID 65534 (numeric nobody, rootless Docker compatible)
  - .env and infra/k8s/overlays/*/secrets.yaml are gitignored — never commit secrets
  - For production use AWS Secrets Manager, HashiCorp Vault, or equivalent

================================================================================
