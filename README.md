# Kumbi — The People's Baraza

A civic technology platform for community impact in Nairobi, Kenya. Includes KumbiTrace (missing persons tracking), KumbiVote (blockchain elections), and Social Work coordination.

## Stack

- **Frontend**: React 18, TypeScript, Vite, Bun, Tailwind CSS, Framer Motion, TanStack Query, Zustand, TipTap, Zod
- **Backend**: Go, Gin, PostgreSQL, pgx/v5
- **Infra**: Docker (rootless), k3d (k3s in Docker), Kubernetes, Kustomize, Traefik ingress

## Quick Start

```bash
# Prerequisites: docker, k3d, kubectl, go 1.23+, bun
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

git clone <repo> && cd kumbi
cp infra/k8s/overlays/dev/secrets.yaml.example infra/k8s/overlays/dev/secrets.yaml
# Edit secrets.yaml — set JWT_SECRET (32+ chars), ALLOW_ORIGIN, and POSTGRES_PASSWORD

make setup          # install deps
make deploy         # creates k3d cluster, builds images, deploys (ENV=dev by default)
```

- Frontend + CMS: `http://localhost`
- API: `http://localhost/api/v1`
- Admin: credentials from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in secrets.yaml

## Environments

All commands take `ENV=dev|test|staging|prod`. Default is `dev`.

| ENV | URL | Namespace |
|-----|-----|-----------|
| `dev` | `http://localhost` | `kumbi` |
| `test` | `http://localhost:8080` | `kumbi-test` |
| `staging` | `http://localhost:8081` | `kumbi-staging` |
| `prod` | `https://kumbike.org` | `kumbi` |

```bash
make deploy           # dev
make deploy ENV=test
make deploy ENV=prod  # run on the VPS directly
```

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
make setup                    # install deps
make test                     # run tests
make lint                     # lint
make check-config [ENV=..]   # validate secrets.yaml (run automatically before deploy/seed/refresh)

make build [ENV=..] [CONTAINER=all|backend|frontend]  # build + load images
make build-backend [ENV=..]   # build backend only
make build-frontend [ENV=..]  # build frontend only
make deploy                   # full clean-slate deploy (dev)
make deploy ENV=test          # full test deploy
make deploy ENV=prod          # full prod deploy (run on VPS)
make deploy-backend [ENV=..]  # restart backend only
make deploy-frontend [ENV=..] # restart frontend only
make deploy-postgres [ENV=..] # restart postgres only
make refresh [ENV=..]         # rebuild images + redeploy (restarts pods)
make retry [ENV=..]          # restart failing pods and re-run failed seed job
make migrate [ENV=..]         # re-run DB migrations

make cluster-create [ENV=..]  # create k3d cluster
make cluster-delete [ENV=..]  # delete k3d cluster
make status [ENV=..]          # docker-ps + k8s nodes + pods/svc/ingress/jobs
make docker-ps [ENV=..]       # Docker containers in this cluster
make docker-logs [ENV=..]     # follow k3d server logs
make nodes [ENV=..]           # Kubernetes nodes
make logs [ENV=..] [CONTAINER=backend|frontend|postgres] # follow pod logs
make describe [ENV=..] [CONTAINER=] # describe deployment
make exec [ENV=..] [CONTAINER=] # open shell in pod
make teardown [ENV=..]        # ⚠ delete namespace

make sync                     # rsync prod code to VPS
make remote CMD=deploy        # sync + run command on VPS
make remote CMD=refresh

make scale-up [ENV=..]        # scale backend+frontend to 3 replicas
make scale-down [ENV=..]      # scale backend+frontend to 1 replica
make scale [ENV=..] BACKEND_REPLICAS=N FRONTEND_REPLICAS=N

make seed                     # seed/reset admin user (runs k8s job)
make create-user NAME=.. EMAIL=.. PASS=.. ROLE=..

make save-logs [ENV=..]       # dump docker/k3d/k8s state to logs/
make images [ENV=..]          # list locally built Docker images
make logs-cleanup             # remove logs older than 30 days
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
│   ├── k3d/            # dev-cluster.yaml, test-cluster.yaml, staging-cluster.yaml, prod-cluster.yaml
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
- `DATABASE_URL` is computed by `make generate-secrets` from `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD` — it's stored in `backend-secret` alongside app secrets
- `ALLOW_ORIGIN` must be `http://localhost` for k3d dev (not `:5173`)
- `JWT_SECRET` must be at least 32 characters
- Workflow: `cp secrets.yaml.example secrets.yaml` → edit values → `make deploy` (auto-runs generator → check-config → deploy)

See `docs/deployment.md` for the full secrets reference and CI/CD injection patterns.

## What changed (recent infra overhaul)

- **`DATABASE_URL` reintroduced** — back to the standard single-env-var approach. The generator script (`scripts/generate-secrets.sh`) computes `DATABASE_URL` from `POSTGRES_*` vars and writes it into `backend-secret`. Runs automatically before every deploy via `check-config`. Falls back to compiling from PG vars for local dev / docker-compose.
- **Three secrets per overlay** — every `secrets.yaml` now has a `backend-secret` (app vars) and a `postgres-secret` (PG credentials with `USER`/`DB`/`PASSWORD`).
- **`imagePullPolicy: IfNotPresent`** — all overlays (dev/test/staging/prod) patch this via kustomize; base manifests are pull-policy-free.
- **Staging environment** — new overlay at `infra/k8s/overlays/staging/`, new k3d cluster config at `infra/k3d/staging-cluster.yaml`.
- **Granular Makefile control** — `CONTAINER=backend|frontend|postgres|all` on `build`, plus dedicated `build-backend`, `deploy-frontend`, `deploy-postgres`, `logs`, `describe`, `exec` targets.
- **`make create-user`** reads from `secrets.yaml` — no `.env` files involved anywhere.
- **`make sync`** excludes hidden dirs (`.github`, `.opencode`) and non-prod overlays; only pushes what the VPS needs.
- **CI/CD fixed** — seed job now kustomized (was applying base file with wrong image tag), image paths deduplicated, secrets renamed to `POSTGRES_*` vars.
- **No `.env` files** — every target gets its values from `secrets.yaml` or GitHub Secrets. The `godotenv.Load()` in Go is a silent no-op.
- **Config validation** — `make check-config` (and as a prerequisite to `deploy`/`refresh`/`seed`/`create-user`/`migrate`) validates secrets.yaml for YAML structure, required keys, `CHANGE_ME` placeholders, weak passwords, JWT length, missing `DATABASE_URL`, shared postgres-secret, and matching image tags. Has a 30s timeout.
- **Image tag consistency** — every overlay's `kustomization.yaml` now patches `newTag` to match the environment name (`dev`, `test`, `staging`, `prod`), so build and deploy always agree on image names. The dev and prod overlays previously used `:latest`, which caused `ErrImagePull` because images were built as `:dev` and `:prod`.
- **`ctr images import` with dual naming** — reverted from `k3d image import` (which fails with rootless Docker because the tools container can't reach the Docker socket). Now uses `docker save | ctr images import` directly, tagging with both `kumbi/backend:dev` and `docker.io/kumbi/backend:dev` so kubelet always finds the image.
- **Structured logging** — all make targets (`deploy`, `build`, `refresh`, `seed`, `cluster-create`, `deploy-*`, `migrate`, `status`, `check-config`) capture their output to `logs/<action>-<env>-<timestamp>.log` via `tee`. Comprehensive `make save-logs` dumps Docker/k3d/k8s state. Old logs auto-clean after 30 days (`make logs-cleanup`). CI/CD uploads logs as artifacts per job.
- **`make retry`** — detects deployments with fewer ready replicas than desired, restarts them, and re-runs any failed seed job. Fixes flaky deploys where pods crash-looped due to secret timing or where the seed job timed out.
- **`refresh` now restarts pods** — `kubectl apply -k` updates secrets/configmaps, but k8s doesn't restart pods when `envFrom` secrets change. `make refresh` now runs `rollout restart` after `apply -k` so pods pick up new secrets (like the freshly generated `DATABASE_URL`).
