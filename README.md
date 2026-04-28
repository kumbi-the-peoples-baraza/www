# Kumbi

### The People's Baraza - Website

## Stack

- **Frontend**: React 18, TypeScript, Vite, Bun, Tailwind CSS, Shadcn/Radix, Framer Motion, TanStack Query, Zustand, Zod
- **Backend**: Go, Gin, PostgreSQL, pgx
- **Infra**: Docker Compose, Nginx, GitHub Actions, microk8s, Podman

## Quick Start

### Docker Compose (local dev, no Kubernetes)

```bash
# 1. Clone and setup
git clone <repo>
cd kumbi
./scripts/kumbi.sh setup

# 2. Configure secrets
cp k8s/dev/secrets.env.example k8s/dev/secrets.env
# Edit k8s/dev/secrets.env with your values

# 3. Start development servers (postgres via Docker Compose, backend + frontend natively)
./scripts/kumbi.sh dev

# 4. Create admin user
./scripts/kumbi.sh seed admin admin@kumbi.local yourpassword
```

### Podman pod (dev/test, no cluster required)

```bash
# 1. Clone and setup
git clone <repo>
cd kumbi

# 2. Configure secrets
cp k8s/dev/secrets.env.example k8s/dev/secrets.env
# Edit k8s/dev/secrets.env with your values

# 3. Start all services in a pod
./scripts/kumbi.sh k8s dev up
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:8080`  
CMS: `http://localhost:5173/cms`

## Commands

| Command                                  | Description              |
| ---------------------------------------- | ------------------------ |
| `./scripts/kumbi.sh setup`               | Install all dependencies |
| `./scripts/kumbi.sh dev`                 | Start dev servers        |
| `./scripts/kumbi.sh build`               | Production build         |
| `./scripts/kumbi.sh test`                | Run all tests            |
| `./scripts/kumbi.sh lint`                | Lint all code            |
| `./scripts/kumbi.sh deploy`              | Docker Compose deploy    |
| `./scripts/kumbi.sh seed admin <email> <pass>` | Create/update admin user |
| `./scripts/kumbi.sh create-user <name> <email> <pass> [role]` | Create any user |
| `./scripts/kumbi.sh k8s dev <cmd>`       | Podman pod (dev/test)    |
| `./scripts/kumbi.sh k8s prod <cmd>`      | microk8s deploy (prod)   |

## Kubernetes / microk8s

The project supports two Kubernetes-based deployment modes:

- **Dev/Test** — Podman pods (no cluster required, fast iteration)
- **Production** — microk8s with containerd (full cluster)

### Why no `overlays/` folder?

`overlays/` is a [Kustomize](https://kustomize.io/) convention (`base/` + `overlays/dev/` + `overlays/prod/`). This project does **not** use Kustomize — environment differences are handled by plain shell scripts (`pod.sh` for dev, `deploy.sh` for prod) that read from `secrets.env` / `secrets.yaml`. The `dev/` and `prod/` folders sit alongside `base/` as peers, which is the correct layout for this shell-script-driven approach. If Kustomize is adopted in the future, `dev/` and `prod/` would move under an `overlays/` directory.

### Dev/Test with Podman Pods

Requires: `podman`

```bash
# Start all services in a pod (postgres, backend, frontend)
./scripts/kumbi.sh k8s dev up

# Tail logs for a specific service
./scripts/kumbi.sh k8s dev logs backend

# Show pod status
./scripts/kumbi.sh k8s dev status

# Create admin user
./scripts/kumbi.sh k8s dev seed admin@kumbi.local yourpassword

# Stop and remove pod
./scripts/kumbi.sh k8s dev down
```

Services are exposed on the host:

| Service  | URL                        |
| -------- | -------------------------- |
| Frontend | http://localhost:5173       |
| Backend  | http://localhost:8080       |
| Postgres | localhost:5432              |

### Production with microk8s

Requires: `microk8s`, `podman`

#### 1. Enable required microk8s addons

```bash
microk8s enable dns ingress registry storage
```

#### 2. Configure production secrets

Edit `k8s/prod/secrets.yaml` — replace all `CHANGE_ME` placeholders:

```yaml
# backend-secret
JWT_SECRET: your_long_random_secret
DATABASE_URL: postgres://kumbi:your_db_pass@postgres:5432/kumbi?sslmode=disable
ALLOW_ORIGIN: https://yourdomain.com
SEED_ADMIN_EMAIL: admin@kumbi.local
SEED_ADMIN_PASSWORD: your_admin_password

# postgres-secret
POSTGRES_PASSWORD: your_db_pass
```

> `DATABASE_URL` and `POSTGRES_PASSWORD` must use the same password. `secrets.yaml` is applied before the postgres manifest so the password is never hardcoded in the cluster.

#### 3. Build, deploy, and seed

```bash
# Build images with podman and import into microk8s containerd, then apply manifests
./scripts/kumbi.sh k8s prod deploy

# Or step by step:
./scripts/kumbi.sh k8s prod build    # build + import images
./scripts/kumbi.sh k8s prod apply    # apply k8s manifests
./scripts/kumbi.sh k8s prod rollout  # restart deployments

# Check status
./scripts/kumbi.sh k8s prod status

# Create admin user
./scripts/kumbi.sh k8s prod seed admin@kumbi.local yourpassword

# Tear down (destructive — deletes namespace)
./scripts/kumbi.sh k8s prod teardown
```

#### Environment variables for prod build

| Variable           | Default              | Description                        |
| ------------------ | -------------------- | ---------------------------------- |
| `REGISTRY`         | `localhost:32000`    | microk8s built-in registry address |
| `TAG`              | `latest`             | Image tag                          |
| `VITE_API_BASE_URL`| `http://localhost:8080` | Frontend API base URL (baked at build time) |

```bash
REGISTRY=localhost:32000 TAG=v1.2.0 VITE_API_BASE_URL=https://api.yourdomain.com \
  ./scripts/kumbi.sh k8s prod deploy
```

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
├── k8s/               # Kubernetes manifests and scripts
│   ├── base/          # Shared manifests (namespace, postgres, backend, frontend, ingress)
│   ├── dev/           # Podman pod script (pod.sh) + dev secrets template
│   ├── prod/          # microk8s deploy script (deploy.sh) + prod secrets template
│   └── k8s.sh         # Entry point — delegates to dev/ or prod/
├── docs/              # Extended documentation
│   ├── architecture.md
│   ├── backend.md
│   ├── frontend.md
│   ├── cms-guide.md
│   ├── deployment.md
│   └── api.md
├── scripts/           # Build/deploy scripts
│   └── kumbi.sh       # Main CLI
├── docker-compose.yml
└── .github/workflows/ # CI/CD
```

## Secrets Management

Secrets are never committed to the repository for k8s deployments. For the Docker Compose path, `docker-compose.yml` uses a dev-only hardcoded password — replace it or use `${VAR}` substitution for production Docker Compose use.

### Dev/Test (Podman pod or Docker Compose)

All local workflows — native dev, Docker Compose, and Podman pod — read from the same file:

```bash
# One-time setup
cp k8s/dev/secrets.env.example k8s/dev/secrets.env
# Edit k8s/dev/secrets.env with your values
```

`secrets.env` is sourced by both `kumbi.sh` (for native dev and Docker Compose) and `pod.sh` (for the Podman pod). The backend reads vars directly from the environment — no `backend/.env` file is used.

### Production (microk8s)

```bash
# One-time setup
cp k8s/prod/secrets.yaml.example k8s/prod/secrets.yaml
# Edit k8s/prod/secrets.yaml — replace all CHANGE_ME values
```

`secrets.yaml` is applied as a Kubernetes Secret before the backend deployment. The backend pod reads all secrets from the `backend-secret` Secret via `envFrom`.

> **Never commit `k8s/dev/secrets.env` or `k8s/prod/secrets.yaml`.** Both are gitignored. Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) in CI/CD and inject via environment or `kubectl apply`.

### All secrets / environment variables

#### Backend (`backend-secret` / `secrets.env`)

| Key                    | Required | Default              | Description                              |
| ---------------------- | -------- | -------------------- | ---------------------------------------- |
| `DATABASE_URL`         | ✅       | —                    | PostgreSQL connection string             |
| `JWT_SECRET`           | ✅       | —                    | Min 32-char random string                |
| `ALLOW_ORIGIN`         |          | `http://localhost:5173` | Allowed CORS origin                   |
| `PORT`                 |          | `8080`               | HTTP listen port                         |
| `ENV`                  |          | `development`        | Runtime environment (`development` / `production`) |
| `STORAGE_PATH`         |          | `./storage`          | Filesystem path for uploaded media       |
| `SMTP_HOST`            |          | —                    | SMTP server hostname                     |
| `SMTP_PORT`            |          | `587`                | SMTP server port                         |
| `SMTP_USER`            |          | —                    | SMTP username                            |
| `SMTP_PASS`            |          | —                    | SMTP password                            |
| `WHATSAPP_WEBHOOK_URL` |          | —                    | WhatsApp notification webhook URL        |
| `SEED_ADMIN_EMAIL`     |          | `admin@kumbi.local`  | Default admin email (seed job)           |
| `SEED_ADMIN_PASSWORD`  |          | —                    | Default admin password (seed job)        |

#### Database (`postgres-secret` / `secrets.env`)

| Key                 | Required | Description                    |
| ------------------- | -------- | ------------------------------ |
| `POSTGRES_PASSWORD` | ✅       | Postgres superuser password    |

> `DATABASE_URL` and `POSTGRES_PASSWORD` must use the same password.

#### Frontend (Vite build args — baked at build time, not runtime env vars)

Vite replaces `VITE_*` variables at bundle time. They are passed as `--build-arg` to `podman build` / `docker build` and are **not** available at container runtime.

| Variable            | Default                  | Description                        |
| ------------------- | ------------------------ | ---------------------------------- |
| `VITE_API_BASE_URL` | `http://localhost:8080`  | Backend API base URL               |

## User Management

The default admin account (`admin@kumbi.local`) is seeded automatically on first deploy.

### Dev/Test

```bash
# Reset/seed default admin (reads SEED_ADMIN_* from secrets.env)
./scripts/kumbi.sh k8s dev seed

# Create an additional admin user
./scripts/kumbi.sh k8s dev create-user "Jane Doe" jane@kumbi.local password123

# Create an editor
./scripts/kumbi.sh k8s dev create-user "Bob" bob@kumbi.local password123 editor
```

### Production

```bash
# Seed default admin (runs seed-admin Job, idempotent)
./scripts/kumbi.sh k8s prod seed

# Create an additional admin user
./scripts/kumbi.sh k8s prod create-user "Jane Doe" jane@kumbi.local password123

# Create an editor
./scripts/kumbi.sh k8s prod create-user "Bob" bob@kumbi.local password123 editor
```

### Local (Docker Compose / direct)

```bash
# Seed default admin
./scripts/kumbi.sh seed admin admin@kumbi.local yourpassword

# Create any user
./scripts/kumbi.sh create-user "Jane Doe" jane@kumbi.local password123 admin
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

| Route             | Page                                        |
| ----------------- | ------------------------------------------- |
| `/`               | Home (parallax, project highlights) — implemented |
| `/projects`       | All projects — placeholder                  |
| `/projects/trace` | Trace data/notebooks — placeholder          |
| `/blog`           | Social work blog — placeholder              |
| `/about`          | About us — placeholder                      |
| `/contact`        | Contact form                                |
| `/volunteer`      | Volunteer info + slide-in registration form |
| `/login`          | CMS login                                   |
| `/cms`            | CMS dashboard (protected)                   |
