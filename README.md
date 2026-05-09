# Kumbi

### The People's Baraza - Website

## Stack

- **Frontend**: React 18, TypeScript, Vite, Bun, Tailwind CSS, Shadcn/Radix, Framer Motion, TanStack Query, Zustand, Zod
- **Backend**: Go, Gin, PostgreSQL, pgx
- **Infra**: Docker, k3d (k3s in Docker), Kubernetes, Kustomize, Traefik ingress

## Quick Start

```bash
# Prerequisites: docker, k3d, kubectl, go 1.23+, bun
# Install k3d: curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

git clone <repo> && cd kumbi
cp .env.example .env
cp infra/k8s/overlays/dev/secrets.yaml.example infra/k8s/overlays/dev/secrets.yaml
# Edit secrets.yaml — set DATABASE_URL, JWT_SECRET, POSTGRES_PASSWORD at minimum

make setup   # install deps
make dev     # creates k3d cluster, builds images, deploys
```

Frontend + CMS: `http://localhost` · Backend API: `http://localhost/api`

## Environments

| Env | Command | URL |
|-----|---------|-----|
| dev | `make dev` | `http://localhost` |
| test | `make k8s-test-up` | `http://localhost:8080` |
| staging | `make k8s-staging-build && make k8s-staging-apply` | configured by cluster |
| prod | `make k8s-prod-deploy` | configured by cluster |

## Commands

**Setup & build**

| Command | Description |
|---------|-------------|
| `make setup` | Install all dependencies |
| `make build` | Build frontend bundle + backend binary |
| `make test` | Run all tests |
| `make lint` | Lint all code |

**Dev (k3d)**

| Command | Description |
|---------|-------------|
| `make dev` | Build images, deploy to local k3d cluster |
| `make k3d-create` | Create dev k3d cluster only |
| `make k3d-delete` | Delete dev k3d cluster |
| `make k8s-dev-down` | Remove kumbi namespace from dev cluster |
| `make k8s-dev-seed` | Re-run seed-admin job |
| `make k8s-status` | Show pods, services, ingress |

**Test (separate k3d cluster)**

| Command | Description |
|---------|-------------|
| `make k8s-test-up` | Build, load, deploy test overlay |
| `make k8s-test-down` | Remove kumbi-test namespace |
| `make k3d-test-create` | Create test k3d cluster only |
| `make k3d-test-delete` | Delete test k3d cluster |

**Docker Compose (local tooling helper)**

| Command | Description |
|---------|-------------|
| `make compose-up` | Build and start all services |
| `make compose-down` | Stop and remove containers |
| `make compose-logs` | Tail all service logs |

**Kubernetes — dev**

| Command | Description |
|---------|-------------|
| `make k8s-dev-up` | Build images, import into microk8s, apply dev overlay |
| `make k8s-dev-down` | Remove all kumbi resources from cluster |
| `make k8s-dev-seed` | Re-run seed-admin job |
| `make k8s-status` | Show pods, services, ingress |

**Kubernetes — prod**

| Command | Description |
|---------|-------------|
| `make k8s-prod-build` | Build and push images to registry |
| `make k8s-prod-apply` | Apply prod overlay |
| `make k8s-prod-rollout` | Restart deployments |
| `make k8s-prod-seed` | Run seed-admin job |
| `make k8s-prod-deploy` | Full deploy: build + apply + rollout + seed |
| `make k8s-teardown` | Delete kumbi namespace (destructive) |

**User management**

| Command | Description |
|---------|-------------|
| `make seed` | Seed/reset admin user |
| `make create-user NAME=.. EMAIL=.. PASS=.. ROLE=..` | Create any user |

Run `make help` for the full list with descriptions.

## Project Structure

```
kumbi/
├── frontend/          # React SPA
│   └── src/
│       ├── api/       # Axios client + API functions
│       ├── components/
│       │   ├── cms/   # CMS pages
│       │   ├── forms/ # Volunteer sheet, contact form
│       │   ├── layout/# Navbar, Footer, Layouts
│       │   ├── pages/ # Public pages
│       │   └── ui/    # Shared UI components
│       ├── store/     # Zustand stores
│       └── types/     # TypeScript types
├── backend/           # Go API
│   ├── cmd/
│   │   ├── server/    # Main entrypoint
│   │   └── seed/      # Admin seeder
│   └── internal/
│       ├── api/       # Handlers, middleware, routes
│       ├── auth/      # JWT, bcrypt
│       ├── config/    # Config loader
│       ├── db/        # Connection, migrations
│       ├── models/    # Data models
│       └── services/  # Email/WhatsApp notifier
├── infra/
│   └── k8s/           # Kubernetes manifests (Kustomize)
│       ├── base/      # Shared manifests
│       └── overlays/
│           ├── dev/   # microk8s dev overlay + secrets template
│           └── prod/  # Production overlay + secrets template
├── docs/              # Extended documentation
├── .env.example       # Native dev secrets template
├── docker-compose.yml # All-in-one Compose config
├── Makefile           # Main CLI
└── .github/workflows/ # CI/CD
```

## Kubernetes / microk8s

The project uses **microk8s** for both local development and production. Manifests are managed with **Kustomize** overlays — no Helm, no custom shell scripts.

### Why Kustomize overlays?

`base/` contains environment-agnostic manifests. `overlays/dev/` and `overlays/prod/` patch only what differs (image tags, pull policy, env values). This keeps the base DRY and makes environment differences explicit and reviewable.

### Dev workflow

```bash
make k8s-dev-up          # build images, microk8s import, kubectl apply -k overlays/dev
make k8s-status          # pods, services, ingress
make k8s-dev-seed        # re-run seed-admin job
make k8s-dev-down        # kubectl delete namespace kumbi
```

### Production workflow

```bash
# Set secrets
cp infra/k8s/overlays/prod/secrets.yaml.example infra/k8s/overlays/prod/secrets.yaml
# Edit secrets.yaml — replace all CHANGE_ME values

# Deploy
REGISTRY=registry.example.com TAG=v1.0.0 VITE_API_BASE_URL=https://api.example.com \
  make k8s-prod-deploy
```

## Secrets Management

Secrets live entirely within the infra stack and are never committed.

| Context | Location |
|---------|----------|
| Native dev / Docker Compose | `.env` (copy from `.env.example`) |
| Kubernetes dev | `infra/k8s/overlays/dev/secrets.yaml` (copy from `.example`) |
| Kubernetes prod | `infra/k8s/overlays/prod/secrets.yaml` (copy from `.example`) |

`.env` is only read by native dev and Docker Compose. Kubernetes reads exclusively from its own Secret manifests in `infra/k8s/overlays/`.

> For CI/CD, inject secrets via AWS Secrets Manager, HashiCorp Vault, or `kubectl create secret` from CI environment variables. Never store real secrets in the repository.

### All secrets / environment variables

#### Backend

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | Min 32-char random string |
| `ALLOW_ORIGIN` | | `http://localhost:5173` | Allowed CORS origin |
| `PORT` | | `8080` | HTTP listen port |
| `ENV` | | `development` | Runtime environment |
| `STORAGE_PATH` | | `./storage` | Filesystem path for uploaded media |
| `SMTP_HOST` | | — | SMTP server hostname |
| `SMTP_PORT` | | `587` | SMTP server port |
| `SMTP_USER` | | — | SMTP username |
| `SMTP_PASS` | | — | SMTP password |
| `WHATSAPP_WEBHOOK_URL` | | — | WhatsApp notification webhook URL |
| `SEED_ADMIN_EMAIL` | | `admin@kumbi.local` | Default admin email |
| `SEED_ADMIN_PASSWORD` | | — | Default admin password |

#### Database

| Key | Required | Description |
|-----|----------|-------------|
| `POSTGRES_PASSWORD` | ✅ | Postgres superuser password |

> `DATABASE_URL` and `POSTGRES_PASSWORD` must use the same password.

#### Frontend (Vite build args — baked at build time)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8080` | Backend API base URL |

#### Kubernetes prod build

| Variable | Default | Description |
|----------|---------|-------------|
| `REGISTRY` | `registry.localhost:5000` | Container registry |
| `TAG` | `latest` | Image tag |

## User Management

```bash
# Seed/reset default admin
make seed

# Create additional users
make create-user NAME="Jane Doe" EMAIL=jane@kumbi.local PASS=password123 ROLE=editor
```

Available roles: `admin`, `editor`, `viewer`

## CMS Features

- **Pages**: Full CRUD with display modes (full, modal, overlay, carousel, hero, link)
- **Content**: Manage content blocks per page (text with rich editor, image, video, audio, PDF, notebook, form)
- **Media**: Upload/manage images, videos, audio, PDFs
- **Notebooks**: Import Jupyter notebooks for data display
- **Forms**: View and export contact/volunteer submissions (CSV)
- **Users**: Create, edit, deactivate, and delete users with role management (admin only)
- **Appearance**: Colors, gradients, fonts, dark/light mode
- **Analytics**: JSON configuration store for analytics integrations

## Public Pages

| Route | Page |
|-------|------|
| `/` | Home (parallax, project highlights) |
| `/projects` | All projects |
| `/projects/trace` | Trace data/notebooks |
| `/blog` | Social work blog |
| `/about` | About us |
| `/contact` | Contact form |
| `/volunteer` | Volunteer info + slide-in registration form |
| `/login` | CMS login |
| `/cms` | CMS dashboard (protected) |
