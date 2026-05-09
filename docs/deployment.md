# Kumbi — Deployment & Operations Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| `docker` (rootless) | 24+ | Build images |
| `k3d` | 5.8+ | Local Kubernetes via Docker (dev + test) |
| `kubectl` | 1.29+ | Cluster management |
| `go` | 1.23+ | Backend dev/build |
| `bun` | 1.1+ | Frontend dev/build |

Install k3d:
```bash
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
```

> **Rootless Docker note:** `k3d image import` requires `/var/run/docker.sock` and does not work with rootless Docker. The Makefile uses `docker save <img> | docker exec -i k3d-<cluster>-server-0 ctr images import -` instead. This is handled automatically by `make dev` and `make k8s-test-up`.

---

## Confirmed Working Setup (dev)

Verified 2026-05-09 on rootless Docker + k3d v5.8.3:

| Item | Value |
|------|-------|
| k3s image | `rancher/k3s:v1.33.6-k3s1` |
| Cluster name | `kumbi-dev` |
| kubectl context | `k3d-kumbi-dev` |
| Namespace | `kumbi` |
| Ingress | Traefik (k3d built-in), `ingressClassName: traefik` |
| Port mapping | `0.0.0.0:80→80`, `0.0.0.0:443→443` |
| Frontend | `http://localhost` |
| API | `http://localhost/api/v1` |
| Admin login | `root@kumbi.local` (seeded by `seed-admin` job) |

---

## Environments

| Env | Cluster | Namespace | Ingress port | Image source |
|-----|---------|-----------|-------------|--------------|
| dev | `kumbi-dev` (k3d) | `kumbi` | `localhost:80` | local Docker build |
| test | `kumbi-test` (k3d) | `kumbi-test` | `localhost:8080` | local Docker build |
| staging | external k8s | `kumbi-staging` | configured by cluster | registry push |
| prod | external k8s | `kumbi` | configured by cluster | registry push |

All environments share `infra/k8s/base/`. The `kumbi` namespace is defined in `base/namespace.yaml` and applied automatically by every overlay.

---

## Initial Setup

```bash
git clone <repo> && cd kumbi
cp .env.example .env                                          # native tooling only
cp infra/k8s/overlays/dev/secrets.yaml.example \
   infra/k8s/overlays/dev/secrets.yaml                       # edit values
make setup                                                    # install deps
```

---

## Dev Environment

```bash
make dev                  # create k3d cluster if needed, build, load, deploy
make k8s-dev-up           # same as above (explicit)
make k8s-dev-down         # remove kumbi namespace
make k8s-dev-seed         # re-run seed-admin job
make k8s-status           # pods, services, ingress
make k3d-create           # create cluster only
make k3d-delete           # delete cluster
```

URLs: `http://localhost` (frontend + CMS) · `http://localhost/api` (backend)

`make dev` is idempotent — re-running it rebuilds images, reloads them into k3d, and re-applies the overlay. The cluster is created automatically on first run.

---

## Test Environment

Runs on a separate k3d cluster so dev and test can coexist.

```bash
cp infra/k8s/overlays/test/secrets.yaml.example \
   infra/k8s/overlays/test/secrets.yaml                      # edit values
make k8s-test-up          # create cluster, build, load, deploy
make k8s-test-down        # remove kumbi-test namespace
make k3d-test-create      # create cluster only
make k3d-test-delete      # delete cluster
```

URL: `http://localhost:8080`

---

## Staging Environment

Staging uses a registry-pushed image and an external Kubernetes cluster (your staging kubeconfig context must be active, or set `KUBECONFIG`).

```bash
cp infra/k8s/overlays/staging/secrets.yaml.example \
   infra/k8s/overlays/staging/secrets.yaml                   # fill in CHANGE_ME values

# Build and push
REGISTRY=registry.example.com TAG=v1.2.0-rc1 \
  VITE_API_BASE_URL=https://staging-api.example.com \
  make k8s-staging-build

# Apply overlay
make k8s-staging-apply
```

---

## Production Environment

```bash
cp infra/k8s/overlays/prod/secrets.yaml.example \
   infra/k8s/overlays/prod/secrets.yaml                      # fill in CHANGE_ME values

# Full deploy (build → push → apply → rollout → seed)
REGISTRY=registry.example.com TAG=v1.2.0 \
  VITE_API_BASE_URL=https://api.example.com \
  make k8s-prod-deploy

# Individual steps
make k8s-prod-build       # docker build + push to registry
make k8s-prod-apply       # kubectl apply -k overlays/prod
make k8s-prod-rollout     # restart deployments, wait for rollout
make k8s-prod-seed        # run seed-admin job
make k8s-teardown         # ⚠ delete kumbi namespace (destructive)
```

---

## Release Cycle

```
feature/* ──► main ──► tag vX.Y.Z ──► prod deploy
                │
                └──► CI runs on every push/PR:
                       test-backend
                       test-frontend
                       build-images (main only)
                       push-images  (tags only)
                       deploy-staging (tags only, auto)
                       deploy-prod    (tags only, manual approval)
```

### Branching strategy

| Branch | Purpose |
|--------|---------|
| `main` | Always deployable. CI builds + pushes images on every merge. |
| `feature/*` | Feature branches. PR → main. |
| `hotfix/*` | Emergency fixes. PR → main, then tag immediately. |
| `release/vX.Y.Z` | Optional release prep branch for larger releases. |

### Tagging a release

```bash
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0
```

Pushing a `v*` tag triggers the CI release pipeline:
1. Tests run
2. Images built and pushed as `registry/kumbi/backend:v1.2.0` and `registry/kumbi/frontend:v1.2.0`
3. Staging deployed automatically
4. Production deploy requires manual approval in GitHub Actions

---

## Make Reference

### Setup & build

| Command | Description |
|---------|-------------|
| `make setup` | Install frontend (bun) and backend (go mod) dependencies |
| `make build` | Build frontend bundle + backend binary |
| `make test` | Run backend Go tests + frontend build check |
| `make lint` | `go vet` + `bun run lint` |

### Dev (k3d)

| Command | Description |
|---------|-------------|
| `make dev` | Full dev deploy (alias for `k8s-dev-up`) |
| `make k3d-create` | Create `kumbi-dev` k3d cluster |
| `make k3d-delete` | Delete `kumbi-dev` k3d cluster |
| `make k8s-dev-up` | Build images, load into k3d, apply dev overlay |
| `make k8s-dev-down` | Delete `kumbi` namespace from dev cluster |
| `make k8s-dev-seed` | Re-run seed-admin job in dev |
| `make k8s-status` | Show pods/svc/ingress in dev cluster |

### Test (k3d)

| Command | Description |
|---------|-------------|
| `make k3d-test-create` | Create `kumbi-test` k3d cluster |
| `make k3d-test-delete` | Delete `kumbi-test` k3d cluster |
| `make k8s-test-up` | Build images, load into k3d, apply test overlay |
| `make k8s-test-down` | Delete `kumbi-test` namespace |

### Staging

| Command | Description |
|---------|-------------|
| `make k8s-staging-build` | Build + push staging images to registry |
| `make k8s-staging-apply` | Apply staging overlay to current kubectl context |

### Production

| Command | Description |
|---------|-------------|
| `make k8s-prod-build` | Build + push prod images to registry |
| `make k8s-prod-apply` | Apply prod overlay |
| `make k8s-prod-rollout` | Restart deployments + wait |
| `make k8s-prod-seed` | Run seed-admin job |
| `make k8s-prod-deploy` | Full deploy: build + apply + rollout + seed |
| `make k8s-teardown` | ⚠ Delete `kumbi` namespace (destructive, prompts) |

### Docker Compose (local tooling helper)

| Command | Description |
|---------|-------------|
| `make compose-up` | Start all services via Compose |
| `make compose-down` | Stop and remove containers |
| `make compose-logs` | Tail all service logs |

### User management

| Command | Description |
|---------|-------------|
| `make seed` | Seed/reset default admin (reads `SEED_ADMIN_*` from `.env`) |
| `make create-user NAME=.. EMAIL=.. PASS=.. ROLE=..` | Create any user |

Available roles: `admin`, `editor`, `viewer`

---

## Secrets Management

Secrets are never committed. Each environment has its own secrets file.

| Environment | Location |
|-------------|----------|
| Native dev / Compose | `.env` (copy from `.env.example`) |
| k3d dev | `infra/k8s/overlays/dev/secrets.yaml` |
| k3d test | `infra/k8s/overlays/test/secrets.yaml` |
| Staging | `infra/k8s/overlays/staging/secrets.yaml` |
| Production | `infra/k8s/overlays/prod/secrets.yaml` |

All `secrets.yaml` files are gitignored. Copy from the `.example` file and fill in values.

**CI/CD secret injection** — never store real secrets in the repo. Instead:
- GitHub Actions: store as repository secrets, write `secrets.yaml` at deploy time (see CI workflow)
- AWS: use Secrets Manager + `aws secretsmanager get-secret-value` in the deploy step
- HashiCorp Vault: use `vault kv get` in the deploy step

Minimum required secrets: `DATABASE_URL`, `JWT_SECRET`, `POSTGRES_PASSWORD`.

---

## Infra Layout

```
infra/
├── k3d/
│   ├── dev-cluster.yaml       # k3d cluster config — dev (port 80)
│   └── test-cluster.yaml      # k3d cluster config — test (port 8080)
└── k8s/
    ├── base/                  # Shared manifests (all environments)
    │   ├── kustomization.yaml
    │   ├── namespace.yaml
    │   ├── postgres.yaml
    │   ├── backend.yaml
    │   ├── frontend.yaml
    │   ├── ingress.yaml       # ingressClassName: traefik (k3d default)
    │   └── seed-job.yaml
    └── overlays/
        ├── dev/               # k3d dev — IfNotPresent, dev tags, ENV=development
        ├── test/              # k3d test — IfNotPresent, test tags, ENV=test, ns=kumbi-test
        ├── staging/           # registry images, ENV=staging, ns=kumbi-staging
        └── prod/              # registry images, ENV=production, ns=kumbi
```

---

## Dockerfiles

- **Backend**: multi-stage Go build → distroless final image, runs as UID `65534` (nobody)
- **Frontend**: Bun builder → `nginx:1.27-alpine`, nginx proxies `/api/` and `/storage/` to backend

Both are OCI-compliant and work with rootless Docker and containerd.
