# Kumbi — The People's Baraza

A civic technology platform for community impact in Nairobi, Kenya. Includes KumbiTrace (missing persons tracking), KumbiVote (blockchain elections), and Social Work coordination.

## Stack

- **Frontend**: React 18, TypeScript, Vite, Bun, Tailwind CSS, Framer Motion, TanStack Query, Zustand, TipTap, Zod
- **Backend**: Go, Gin, PostgreSQL, pgx/v5
- **Infra**: Docker (rootless), k3d (k3s in Docker), Kubernetes, Kustomize, Traefik ingress

## Quick Start

```bash
# Prerequisites: docker (rootless), k3d, kubectl, go 1.23+, bun
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

git clone <repo> && cd kumbi
cp infra/k8s/overlays/dev/secrets.yaml.example infra/k8s/overlays/dev/secrets.yaml
# Edit secrets.yaml — DATABASE_URL user must be "kumbi", ALLOW_ORIGIN must be "http://localhost"

make setup   # install deps
make dev     # creates k3d cluster, builds images, deploys to namespace "kumbi"
```

- Frontend + CMS: `http://localhost`
- API: `http://localhost/api/v1`
- Admin: credentials from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in secrets.yaml

## Environments

| Env | Command | URL | Namespace |
|-----|---------|-----|-----------|
| dev | `make dev` | `http://localhost` | `kumbi` |
| test | `make k8s-test-up` | `http://localhost:8080` | `kumbi-test` |
| staging | `make k8s-staging-build && make k8s-staging-apply` | cluster-configured | `kumbi-staging` |
| prod | `make k8s-prod-deploy` | cluster-configured | `kumbi` |

## CMS

Log in at `http://localhost/cms` (or click the padlock icon in the navbar).

| Section | What you can do |
|---------|----------------|
| **Site Content** | Edit all page text, headings, hero images, project card content, footer details, nav brand |
| **Blog** | Write and publish blog posts with the rich text editor |
| **Pages** | Manage page metadata and descriptions |
| **Content** | Edit content blocks (text, image, video, etc.) per page |
| **Media** | Upload and manage files |
| **Forms** | View and export contact/volunteer submissions |
| **Users** | Manage user accounts and roles |
| **Appearance** | Colours, fonts, theme settings |

## Make Reference

```bash
make setup              # install deps
make dev                # full dev deploy (k3d + k8s)
make build              # build binaries
make test               # run tests
make lint               # lint

make k3d-create         # create dev k3d cluster
make k3d-delete         # delete dev k3d cluster
make k8s-dev-up         # build + import images + deploy dev overlay
make k8s-dev-down       # delete kumbi namespace
make k8s-dev-seed       # re-run seed-admin job
make k8s-status         # show pods/svc/ingress

make k8s-test-up        # deploy test overlay (separate cluster, port 8080)
make k8s-test-down      # delete kumbi-test namespace

make k8s-staging-build  # build + push staging images
make k8s-staging-apply  # apply staging overlay

make k8s-prod-deploy    # full prod deploy (build + apply + rollout + seed)
make k8s-teardown       # ⚠ delete kumbi namespace

make seed               # seed/reset admin user
make create-user NAME=.. EMAIL=.. PASS=.. ROLE=..
```

Run `make help` for the full annotated list.

## Project Structure

```
kumbi/
├── frontend/src/
│   ├── api/            # Axios client + typed API functions
│   ├── components/
│   │   ├── cms/        # CMS pages (Blog, SiteContent, Pages, Content, …)
│   │   ├── forms/      # VolunteerSheet overlay
│   │   ├── layout/     # Navbar, Footer, Layout, CMSLayout
│   │   ├── pages/      # Public pages (Home, Blog, About, …)
│   │   └── ui/         # OverlayPanel, RichTextarea, PageHero, ThemeSwitcher, …
│   ├── hooks/          # useConfig — fetches + merges site_config
│   └── store/          # authStore, themeStore, volunteerStore, contactStore
├── backend/
│   ├── cmd/server/     # Main entrypoint
│   ├── cmd/seed/       # Admin seeder CLI
│   └── internal/
│       ├── api/        # handlers/, middleware/, routes/
│       ├── auth/       # JWT + bcrypt
│       ├── config/     # Env loader
│       ├── db/         # Connection + migrations (including site_config seed)
│       └── services/   # Email + WhatsApp notifier
├── infra/
│   ├── k3d/            # dev-cluster.yaml, test-cluster.yaml
│   └── k8s/
│       ├── base/       # namespace, postgres, backend, frontend, ingress, seed-job
│       └── overlays/   # dev, test, staging, prod
├── docs/               # architecture.md, deployment.md, api.md, …
├── .github/workflows/  # ci.yml — test → build → deploy-staging → deploy-prod
└── Makefile
```

## Secrets

All secrets are gitignored. Copy the `.example` file for each environment and fill in values.

| Env | File |
|-----|------|
| dev | `infra/k8s/overlays/dev/secrets.yaml` |
| test | `infra/k8s/overlays/test/secrets.yaml` |
| staging | `infra/k8s/overlays/staging/secrets.yaml` |
| prod | `infra/k8s/overlays/prod/secrets.yaml` |

Key constraints:
- `DATABASE_URL` user must match `POSTGRES_USER` in `base/postgres.yaml` (`kumbi`)
- `ALLOW_ORIGIN` must be `http://localhost` for k3d dev (not `:5173`)
- `JWT_SECRET` must be at least 32 characters

See `docs/deployment.md` for the full secrets reference and CI/CD injection patterns.
