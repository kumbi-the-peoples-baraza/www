# Kumbi — Deployment & Operations Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| `docker` | 24+ | Build images |
| `k3d` | 5.8+ | Local Kubernetes via Docker |
| `kubectl` | 1.29+ | Cluster management |
| `go` | 1.23+ | Backend dev/build |
| `bun` | 1.1+ | Frontend dev/build |

Install k3d:
```bash
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
```

> **Rootless Docker note:** `k3d image import` requires `/var/run/docker.sock` and does not work with rootless Docker. The Makefile uses `docker save <img> | docker exec -i k3d-<cluster>-server-0 ctr images import -` instead. This is handled automatically by all build/deploy commands.

---

## How it works

All commands take an `ENV` argument:

```bash
make <command> ENV=dev|test|staging|prod [CONTAINER=backend|frontend|postgres|all]
```

Default is `ENV=dev CONTAINER=all`. The same Makefile runs everywhere — on your local machine for dev/test/staging, and directly on the VPS for prod.

---

## Environments

| ENV | Cluster | Namespace | URL |
|-----|---------|-----------|-----|
| `dev` | `kumbi-dev` | `kumbi` | `http://localhost` |
| `test` | `kumbi-test` | `kumbi-test` | `http://localhost:8080` |
| `staging` | `kumbi-staging` | `kumbi-staging` | `http://localhost:8081` |
| `prod` | `kumbi` | `kumbi` | `https://kumbike.org` |

---

## Core Commands

### `make deploy ENV=<env>`
Full clean-slate deploy. Wipes the existing cluster and all Docker state, then:
1. Creates a fresh k3d cluster
2. (prod only) Installs NGINX Ingress + cert-manager + ClusterIssuer
3. Builds Docker images and loads them into the cluster
4. Applies the Kustomize overlay
5. Waits for rollout
6. Seeds the admin user

```bash
make deploy           # dev (default)
make deploy ENV=test
make deploy ENV=prod  # run this on the VPS
```

### `make refresh ENV=<env>`
Rebuild images and redeploy without recreating the cluster. After applying the overlay, all deployments are `rollout restart`ed so pods pick up any updated secrets. Fastest iteration loop.

```bash
make refresh
make refresh ENV=prod
```

### `make retry ENV=<env>`
Repair a failed deploy or refresh. Detects deployments that aren't fully available (ready < desired replicas) and restarts them, then re-runs the seed job if it failed. Useful after a flaky deploy where some pods crash-looped or the seed timed out.

```bash
make retry           # repair dev
make retry ENV=prod  # repair prod
```

### `make migrate ENV=<env>`
Restart the backend pod to re-run DB migrations. Migrations run automatically on every backend startup — this forces a restart to apply schema changes immediately.

```bash
make migrate
make migrate ENV=prod
```

### `make build [ENV=<env>] [CONTAINER=<target>]`
Build Docker images and load them into the cluster (without redeploying).

```bash
make build                      # build all images (dev)
make build ENV=prod             # build all images (prod)
make build CONTAINER=backend    # build backend only
make build CONTAINER=frontend   # build frontend only
```

For additional granularity:
```bash
make build-backend
make build-frontend
```

---

## Dev Workflow

```bash
make setup            # install deps (once)
make deploy           # full deploy to dev cluster
make refresh          # rebuild + redeploy after code changes
make migrate          # re-run migrations
make status           # show pods/svc/ingress
make teardown         # ⚠ delete namespace (prompts)
make cluster-delete   # delete the k3d cluster
```

URLs: `http://localhost` (frontend + CMS) · `http://localhost/api` (backend)

---

## Test Workflow

```bash
make deploy ENV=test
make refresh ENV=test
make status ENV=test
make teardown ENV=test
```

URL: `http://localhost:8080`

---

## Production Workflow

### From the VPS (recommended)

SSH into the VPS and run commands directly:

```bash
ssh kumbi
cd ~/kumbike.org
make deploy ENV=prod    # full clean-slate deploy
make refresh ENV=prod   # rebuild + redeploy
make migrate ENV=prod   # re-run migrations
make status ENV=prod    # show pods/svc/ingress
```

### From your local machine

Use `make remote` to sync source and run a command on the VPS:

```bash
make remote CMD=deploy          # sync + make deploy ENV=prod on VPS
make remote CMD=refresh         # sync + make refresh ENV=prod on VPS
make remote CMD=migrate         # sync + make migrate ENV=prod on VPS
make sync                       # sync source only (no command)
```

`make remote` always runs `make sync` first, so the VPS always has the latest source.

---

## Scaling (prod)

Production runs 3 replicas of backend and 3 of frontend by default (set in `overlays/prod/kustomization.yaml`).

Scale live without redeploying:

```bash
make scale-up   ENV=prod                              # backend=3, frontend=3
make scale-down ENV=prod                              # backend=1, frontend=1
make scale      ENV=prod BACKEND_REPLICAS=5 FRONTEND_REPLICAS=2
```

---

## Secrets

Secrets are never committed. Each environment has its own secrets file.

| ENV | File |
|-----|------|
| dev | `infra/k8s/overlays/dev/secrets.yaml` |
| test | `infra/k8s/overlays/test/secrets.yaml` |
| staging | `infra/k8s/overlays/staging/secrets.yaml` |
| prod | `infra/k8s/overlays/prod/secrets.yaml` |

Copy from the `.example` file and fill in values. Key constraints:
- `DATABASE_URL` is **computed automatically** from `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD` by `scripts/generate-secrets.sh` (runs as a Makefile prerequisite before every deploy)
- `JWT_SECRET` must be at least 32 characters
- `ALLOW_ORIGIN` must match the environment URL

The prod `secrets.yaml` is excluded from `make sync` — manage it directly on the VPS.

---

## User Management

```bash
make seed                                                        # seed/reset default admin
make create-user NAME="Jane Doe" EMAIL=jane@example.com PASS=secret ROLE=admin
```

The `seed` command runs a k8s Job using the overlay secrets. The `create-user` command reads the PG vars from the environment (`.env`) — it is idempotent, re-running with the same email updates the existing user.

Available roles: `admin`, `editor`, `viewer`

---

## Make Reference

| Command | Description |
|---------|-------------|
| `make setup` | Install frontend (bun) and backend (go mod) dependencies |
| `make test` | Run backend Go tests + frontend tests |
| `make lint` | `go vet` + `bun run lint` |
| `make build [ENV=..] [CONTAINER=backend\|frontend\|all]` | Build + load images |
| `make build-backend [ENV=..]` | Build backend only |
| `make build-frontend [ENV=..]` | Build frontend only |
| `make deploy [ENV=..]` | Full clean-slate deploy |
| `make deploy-backend [ENV=..]` | Restart backend only |
| `make deploy-frontend [ENV=..]` | Restart frontend only |
| `make deploy-postgres [ENV=..]` | Restart postgres only |
| `make refresh [ENV=..]` | Rebuild images + redeploy (restarts pods) |
| `make retry [ENV=..]` | Restart failing pods and re-run failed seed job |
| `make migrate [ENV=..]` | Restart backend to re-run migrations |
| `make status [ENV=..]` | Show pods/svc/ingress |
| `make logs [ENV=..] [CONTAINER=backend]` | Follow pod logs |
| `make describe [ENV=..] [CONTAINER=]` | Describe deployment |
| `make cluster-create [ENV=..]` | Create k3d cluster |
| `make cluster-delete [ENV=..]` | Delete k3d cluster |
| `make teardown [ENV=..]` | ⚠ Delete namespace (prompts) |
| `make sync` | Rsync prod code to VPS |
| `make remote CMD=<cmd>` | Sync + run command on VPS |
| `make scale-up [ENV=..]` | Scale to 3 replicas |
| `make scale-down [ENV=..]` | Scale to 1 replica |
| `make scale ENV=.. BACKEND_REPLICAS=N FRONTEND_REPLICAS=N` | Custom scale |
| `make seed` | Seed/reset admin user (runs k8s job) |
| `make create-user NAME=.. EMAIL=.. PASS=.. ROLE=..` | Create/update user |
| `make check-config [ENV=..]` | Validate secrets.yaml (auto-runs before deploy/seed/refresh) |
| `make generate-secrets [ENV=..]` | Compute DATABASE_URL from POSTGRES_* vars |
| `make save-logs [ENV=..]` | Dump docker/k3d/k8s state to logs/ |
| `make logs-cleanup` | Remove logs older than 30 days |
| `make images [ENV=..]` | List locally built Docker images |

---

## Infra Layout

```
infra/
├── k3d/
│   ├── dev-cluster.yaml      # port 80, Traefik
│   ├── test-cluster.yaml     # port 8080, Traefik
│   ├── staging-cluster.yaml  # ports 8081+8444, Traefik
│   └── prod-cluster.yaml     # ports 80+443, Traefik disabled (NGINX)
└── k8s/
    ├── base/               # shared manifests (all environments)
    └── overlays/
        ├── dev/            # imagePullPolicy: IfNotPresent, ENV=development
        ├── test/           # imagePullPolicy: IfNotPresent, ENV=test
        ├── staging/        # imagePullPolicy: IfNotPresent, ENV=staging
        └── prod/           # NGINX ingress, TLS, cert-manager, imagePullPolicy: IfNotPresent
```

---

## CI/CD

```
feature/* ──► main ──► tag vX.Y.Z ──► prod deploy
                │
                └──► CI: test → build → deploy-staging → deploy-prod (manual approval)
```

Pushing a `v*` tag triggers the release pipeline. Production deploy requires manual approval in GitHub Actions.

### `DATABASE_URL` — back to a single env var, with Kustomize-adjacent generation

The backend reads `DATABASE_URL` as a single env var (the standard convention). It falls back to compiling from PG vars for local dev / docker-compose.

`DATABASE_URL` is kept in `backend-secret` alongside the `POSTGRES_*` vars in `postgres-secret`. Both are in the same `secrets.yaml` file. A generator script keeps them in sync:

```
make generate-secrets   # reads POSTGRES_* from postgres-secret,
                        # writes DATABASE_URL into backend-secret
```

This runs automatically as part of `make check-config` (which runs before every deploy). CI/CD includes `DATABASE_URL` directly when writing secrets and also runs the generator for safety.

**Why not pure Kustomize?** Kustomize's `replacements` can copy individual fields but cannot do string interpolation — you can't build `postgres://user:pass@host:port/db` from four separate fields. The generator script is the pragmatic middle ground: Kustomize applies the generated secrets as-is.

**Why not Go code compilation?** Kubernetes service injection sets `POSTGRES_PORT=tcp://<cluster-ip>:<port>` which overwrites Go defaults. `DATABASE_URL` doesn't collide with any k8s-injected var.

### Secret updates require pod restart

When `generate-secrets.sh` updates `DATABASE_URL` in `backend-secret`, running pods don't automatically pick up the change — k8s doesn't restart pods when `envFrom` Secrets change. The `refresh` target now does `rollout restart` after `apply -k` to force pods to reload secrets. The `retry` target also restarts any deployment whose ready replicas don't match desired replicas.

If you manually edit `secrets.yaml` and re-apply, run `make deploy-backend` (which does `rollout restart` + `rollout status`) or `make retry` to restart affected pods.

### No `.env` files

No Make target or workflow reads a `.env` file. All secrets come from `secrets.yaml` (local/k8s) or GitHub Secrets (CI/CD). The `godotenv.Load()` call in the Go backend is a no-op silent fallback that does nothing when no `.env` exists.

### Granular container control

All build and deploy commands accept a `CONTAINER` argument:

```bash
make build CONTAINER=backend ENV=dev    # rebuild only the backend image
make build CONTAINER=frontend           # rebuild only the frontend image
make build                              # rebuild both (default: all)
```

Dedicated shorthand targets also exist:
```bash
make build-backend
make build-frontend
make deploy-backend
make deploy-frontend
make deploy-postgres
make logs CONTAINER=postgres
make describe CONTAINER=frontend
make exec CONTAINER=backend
```

### Staging environment added

| Resource | File |
|----------|------|
| k3d cluster config | `infra/k3d/staging-cluster.yaml` (ports 8081:80, 8444:443) |
| Kustomize overlay | `infra/k8s/overlays/staging/` |
| Namespace | `kumbi-staging` |

### `imagePullPolicy` standardized to `IfNotPresent`

All overlays (dev, test, staging, prod) patch `imagePullPolicy: IfNotPresent` onto every container. The base manifests are clean (no pull policy set). Each overlay controls its own policy via kustomize patches.

### Secrets restructuring

Every overlay's `secrets.yaml` contains two Kubernetes Secret objects. The `postgres-secret` holds the three PG credential keys:

```yaml
stringData:
  POSTGRES_USER: <username>
  POSTGRES_DB: <database>
  POSTGRES_PASSWORD: <password>
```

The `backend-secret` carries `DATABASE_URL` (computed from the above by `scripts/generate-secrets.sh`) plus application-level secrets (`JWT_SECRET`, `ALLOW_ORIGIN`, `SMTP_*`, etc.). The generator runs automatically before every deploy via `check-config`'s prerequisites.

### CI/CD pipeline fixes

1. **Seed job image bug**: The prod deploy step was applying `infra/k8s/base/seed-job.yaml` directly, which has `image: kumbi/backend:latest`. CI images are tagged with the commit SHA under `ghcr.io/kumbi/backend:$TAG` — the `:latest` tag doesn't exist in the registry. Fixed by extracting the Job from the kustomized overlay (same pattern as the Makefile `_seed` target).

2. **Double `kumbi` in registry path**: `BACKEND_IMG` and `FRONTEND_IMG` were `kumbi/backend` and `kumbi/frontend`, producing registry paths like `ghcr.io/kumbi/kumbi/backend`. Changed to `backend` / `frontend`.

3. **GitHub Secrets renamed**: Deploy steps now write `POSTGRES_USER`/`POSTGRES_DB`/`POSTGRES_PASSWORD` for `postgres-secret` and `DATABASE_URL` (alongside app secrets) for `backend-secret`. The `generate-secrets.sh` script runs as a belt-and-suspenders measure to keep `DATABASE_URL` in sync.

### Image tag consistency (critical fix)

**Problem**: The dev and prod overlays patched image tags to `:latest`, but the Makefile builds images as `kumbi/backend:dev` (for ENV=dev) and `kumbi/backend:prod` (for ENV=prod). k3d containerd had `kumbi/backend:dev` but k8s looked for `kumbi/backend:latest` — causing `ErrImagePull` / `ImagePullBackOff`.

**Fix**: Every overlay now uses its environment name as the image tag:

| Overlay | Image tag | Build produces |
|---------|-----------|----------------|
| dev | `dev` | `kumbi/backend:dev`, `kumbi/frontend:dev` |
| test | `test` | `kumbi/backend:test`, `kumbi/frontend:test` |
| staging | `staging` | `kumbi/backend:staging`, `kumbi/frontend:staging` |
| prod | `prod` | `kumbi/backend:prod`, `kumbi/frontend:prod` |

The `check-config` target now validates that the overlay's `kustomization.yaml` has `newTag` matching the current `ENV`.

### Image import (k3d containerd)

The `import-image` macro uses `docker save` piped directly into the k3d server's containerd:

```makefile
docker tag $(1) docker.io/$(1) 2>/dev/null
docker save $(1) docker.io/$(1) | docker exec -i k3d-$(2)-server-0 ctr images import -
```

This approach:
- **Avoids rootless Docker issues** — `k3d image import` spawns a tools container that needs the Docker socket, which is unreachable in rootless setups. The pipe approach runs `docker save` on the host (where Docker is available) and injects directly into the server's containerd.
- **Registers both name forms** — containerd stores both `kumbi/backend:dev` and `docker.io/kumbi/backend:dev` pointing to the same content digest, ensuring kubelet finds the image regardless of how it resolves the name.

### Secret sharing validation

**Problem**: Postgres and backend both read database credentials from `postgres-secret`, but if the secret is misconfigured or only partially updated, the two can get out of sync.

**Fix**: The `check-config` target now verifies that all DB-consuming manifests (`postgres.yaml`, `backend.yaml`, `seed-job.yaml`) reference `name: postgres-secret`. If any of them miss it, the command refuses to run. Combined with the single `secrets.yaml` source of truth, this guarantees postgres and backend always share the same credentials.

### Pre-deploy validation (`check-config`)

Every command that touches the cluster now runs a comprehensive config check first:

```
check-config
  ├── _secrets-check       (instant grep: file exists? CHANGE_ME?)
  └── scripts/check-config.sh  (30s timeout, full validation)
        ├── YAML parseable
        ├── Required keys present (JWT_SECRET, POSTGRES_USER, etc.)
        ├── No CHANGE_ME / weak passwords
        ├── JWT_SECRET ≥ 32 chars
        ├── DATABASE_URL present and well-formed
        ├── postgres-secret referenced by all DB consumers
        └── Overlay image tags match ENV
```

Validation runs automatically before: `deploy`, `deploy-*`, `refresh`, `seed`, `migrate`, `create-user`.

Run it standalone: `make check-config ENV=dev`

### Required GitHub Secrets

These must be defined in your repo **Settings → Secrets and variables → Actions**.

#### Repo-level (used by both environments)

| Secret | Description |
|--------|-------------|
| `SEED_ADMIN_EMAIL` | Default admin email for seeding |
| `SEED_ADMIN_PASSWORD` | Default admin password for seeding |
| `SMTP_HOST` | SMTP server (optional, empty to disable) |
| `SMTP_USER` | SMTP username / from address (optional) |
| `SMTP_PASS` | SMTP password (optional) |
| `WHATSAPP_WEBHOOK_URL` | WhatsApp webhook URL (optional) |

#### Environment: `staging`

Create in **Settings → Environments → staging**.

| Secret | Description |
|--------|-------------|
| `STAGING_JWT_SECRET` | JWT signing key, min 32 chars |
| `STAGING_POSTGRES_USER` | PostgreSQL user name |
| `STAGING_POSTGRES_DB` | PostgreSQL database name |
| `STAGING_POSTGRES_PASSWORD` | PostgreSQL password |
| `STAGING_KUBECONFIG` | Base64-encoded kubeconfig for the staging cluster |

#### Environment: `production`

Create in **Settings → Environments → production**.

| Secret | Description |
|--------|-------------|
| `PROD_JWT_SECRET` | JWT signing key, min 32 chars |
| `PROD_POSTGRES_USER` | PostgreSQL user name |
| `PROD_POSTGRES_DB` | PostgreSQL database name |
| `PROD_POSTGRES_PASSWORD` | PostgreSQL password |
| `PROD_KUBECONFIG` | Base64-encoded kubeconfig for the prod cluster |

#### Repo-level variables (not secrets)

| Variable | Description | Default |
|----------|-------------|---------|
| `REGISTRY` | Container registry prefix | `ghcr.io/kumbi` |
| `STAGING_URL` | Staging environment URL | — |
| `PROD_URL` | Production environment URL | — |
| `VITE_API_BASE_URL_STAGING` | API base URL for staging frontend builds | `http://localhost/api` |

> **Note:** The old `STAGING_DATABASE_URL` and `PROD_DATABASE_URL` secrets should be removed from GitHub — `DATABASE_URL` is now computed by the generator script and written into `secrets.yaml` at deploy time. CI/CD writes it directly as well (alongside POSTGRES_* vars) as a belt-and-suspenders approach.
