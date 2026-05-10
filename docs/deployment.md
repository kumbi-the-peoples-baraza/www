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
make <command> ENV=dev|test|prod
```

Default is `ENV=dev`. The same Makefile runs everywhere — on your local machine for dev/test, and directly on the VPS for prod.

---

## Environments

| ENV | Cluster | Namespace | URL |
|-----|---------|-----------|-----|
| `dev` | `kumbi-dev` | `kumbi` | `http://localhost` |
| `test` | `kumbi-test` | `kumbi-test` | `http://localhost:8080` |
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
Rebuild images and redeploy without recreating the cluster. Fastest iteration loop.

```bash
make refresh
make refresh ENV=prod
```

### `make migrate ENV=<env>`
Restart the backend pod to re-run DB migrations. Migrations run automatically on every backend startup — this forces a restart to apply schema changes immediately.

```bash
make migrate
make migrate ENV=prod
```

### `make build ENV=<env>`
Build Docker images and load them into the cluster (without redeploying).

```bash
make build
make build ENV=prod
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
| prod | `infra/k8s/overlays/prod/secrets.yaml` |

Copy from the `.example` file and fill in values. Key constraints:
- `DATABASE_URL` user must be `kumbi` (matches `POSTGRES_USER` in `base/postgres.yaml`)
- `JWT_SECRET` must be at least 32 characters
- `ALLOW_ORIGIN` must match the environment URL

The prod `secrets.yaml` is excluded from `make sync` — manage it directly on the VPS.

---

## User Management

```bash
make seed                                                        # seed/reset default admin
make create-user NAME="Jane Doe" EMAIL=jane@example.com PASS=secret ROLE=admin
```

Both commands read `DATABASE_URL` from `.env`. The `create-user` command is idempotent — re-running with the same email updates the existing user.

Available roles: `admin`, `editor`, `viewer`

---

## Make Reference

| Command | Description |
|---------|-------------|
| `make setup` | Install frontend (bun) and backend (go mod) dependencies |
| `make test` | Run backend Go tests + frontend tests |
| `make lint` | `go vet` + `bun run lint` |
| `make build ENV=..` | Build + load Docker images |
| `make deploy ENV=..` | Full clean-slate deploy |
| `make refresh ENV=..` | Rebuild images + redeploy |
| `make migrate ENV=..` | Restart backend to re-run migrations |
| `make status ENV=..` | Show pods/svc/ingress |
| `make cluster-create ENV=..` | Create k3d cluster |
| `make cluster-delete ENV=..` | Delete k3d cluster |
| `make teardown ENV=..` | ⚠ Delete namespace (prompts) |
| `make sync` | Rsync source to VPS |
| `make remote CMD=<cmd>` | Sync + run command on VPS |
| `make scale-up ENV=..` | Scale to 3 replicas |
| `make scale-down ENV=..` | Scale to 1 replica |
| `make scale ENV=.. BACKEND_REPLICAS=N FRONTEND_REPLICAS=N` | Custom scale |
| `make seed` | Seed/reset admin user |
| `make create-user NAME=.. EMAIL=.. PASS=.. ROLE=..` | Create/update user |

---

## Infra Layout

```
infra/
├── k3d/
│   ├── dev-cluster.yaml    # port 80, Traefik
│   ├── test-cluster.yaml   # port 8080, Traefik
│   └── prod-cluster.yaml   # ports 80+443, Traefik disabled (NGINX)
└── k8s/
    ├── base/               # shared manifests (all environments)
    └── overlays/
        ├── dev/
        ├── test/
        └── prod/           # NGINX ingress, TLS, cert-manager, 3 replicas
```

---

## CI/CD

```
feature/* ──► main ──► tag vX.Y.Z ──► prod deploy
                │
                └──► CI: test → build → deploy-staging → deploy-prod (manual approval)
```

Pushing a `v*` tag triggers the release pipeline. Production deploy requires manual approval in GitHub Actions.
