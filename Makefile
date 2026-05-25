# Kumbi — Toe People's Baraza
# Usage: make <command> [ENV=dev|test|staging|prod] [CONTAINER=backend|frontend|postgres|all]
# Run `make help` for a full list of commands.
#
# On the VPS, run commands directly (no SSH):
#   make deploy ENV=prod
#   make refresh ENV=prod
#   make migrate ENV=prod

SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

# ── Logging ─────────────────────────────────────────────────────────────────────
LOGS_DIR  := logs
TS        := $(shell date +%Y%m%d-%H%M%S)

# Use: $(call logfile,action)  →  logs/action-env-timestamp.log
logfile = $(LOGS_DIR)/$(1)-$(ENV)-$(TS).log

# Wrap a recipe body with:  @+ bash -c '... 2>&1 | tee $$(call logfile,<name>)'
# See _with_log definition below.

# ── Environment & Container ───────────────────────────────────────────────────
ENV       ?= dev
CONTAINER ?= all

# Validate ENV
ifeq ($(filter $(ENV),dev test staging prod),)
  $(error ENV must be dev, test, staging, or prod — got '$(ENV)')
endif

# Validate CONTAINER
ifeq ($(filter $(CONTAINER),backend frontend postgres all),)
  $(error CONTAINER must be backend, frontend, postgres, or all — got '$(CONTAINER)')
endif

# ── Per-environment config ────────────────────────────────────────────────────
ifeq ($(ENV),prod)
  CLUSTER   := kumbi
  NAMESPACE := kumbi
  IMG_TAG   := prod
  OVERLAY   := infra/k8s/overlays/prod
  API_URL   ?= https://kumbike.org/api
  KUBECTL   := kubectl --context k3d-kumbi
  SECRETS   := $(OVERLAY)/secrets.yaml
else ifeq ($(ENV),test)
  CLUSTER   := kumbi-test
  NAMESPACE := kumbi-test
  IMG_TAG   := test
  OVERLAY   := infra/k8s/overlays/test
  API_URL   ?= http://localhost:8080/api
  KUBECTL   := kubectl --context k3d-kumbi-test
  SECRETS   := $(OVERLAY)/secrets.yaml
else ifeq ($(ENV),staging)
  CLUSTER   := kumbi-staging
  NAMESPACE := kumbi-staging
  IMG_TAG   := staging
  OVERLAY   := infra/k8s/overlays/staging
  API_URL   ?= http://staging.kumbike.org/api
  KUBECTL   := kubectl --context k3d-kumbi-staging
  SECRETS   := $(OVERLAY)/secrets.yaml
else
  CLUSTER   := kumbi
  NAMESPACE := kumbi
  IMG_TAG   := dev
  OVERLAY   := infra/k8s/overlays/dev
  API_URL   ?= http://localhost/api
  KUBECTL   := kubectl --context k3d-kumbi
  SECRETS   := $(OVERLAY)/secrets.yaml
endif

BACKEND_IMG  := kumbi/backend:$(IMG_TAG)
FRONTEND_IMG := kumbi/frontend:$(IMG_TAG)

# ── Remote (used only when invoking prod from local machine) ──────────────────
PROD_HOST   := kumbi
REMOTE_DEST := ~/kumbike.org

# ── Helpers ───────────────────────────────────────────────────────────────────
BOLD  := \033[1m
RESET := \033[0m
INFO  := \033[1;36m[kumbi]\033[0m

log = @echo -e "$(INFO) $(1)"

# _with_log: prefix a recipe line to capture its output to logs/<action>-<env>-<ts>.log
# Usage:  @$(call _with_log,<action>,<shell-command>)
define _with_log
  mkdir -p $(LOGS_DIR) && { $(2) 2>&1 | tee $(call logfile,$(1)); }
endef

export

# ── Help ──────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  $(BOLD)Kumbi — The People's Baraza$(RESET)"
	@echo ""
	@echo "  $(BOLD)Usage$(RESET)"
	@echo "    make <command> [ENV=dev|test|staging|prod] [CONTAINER=backend|frontend|postgres|all]"
	@echo "    default: ENV=dev CONTAINER=all"
	@echo ""
	@echo "  $(BOLD)Core commands$(RESET)"
	@echo "    make build    ENV=..   Build Docker images (default all, or set CONTAINER=)"
	@echo "    make build-backend  ENV=..   Build backend image only"
	@echo "    make build-frontend ENV=..   Build frontend image only"
	@echo "    make deploy   ENV=..   Full clean-slate deploy (cluster + infra + app + seed)"
	@echo "    make deploy-backend  ENV=..   Deploy backend only (restart)"
	@echo "    make deploy-frontend ENV=..   Deploy frontend only"
	@echo "    make deploy-postgres ENV=..   Deploy postgres only"
	@echo "    make refresh  ENV=..   Rebuild images and redeploy (no cluster recreate)"
	@echo "    make retry    ENV=..   Restart failing pods and re-run failed seed job"
	@echo "    make migrate  ENV=..   Re-run DB migrations (restarts backend)"
	@echo ""
	@echo "  $(BOLD)Cluster$(RESET)"
	@echo "    make cluster-create  ENV=..   Create k3d cluster"
	@echo "    make cluster-delete  ENV=..   Delete k3d cluster"
	@echo "    make status          ENV=..   Docker containers + k8s nodes + pods/svc/ingress"
	@echo "    make docker-ps       ENV=..   Show Docker containers in this cluster"
	@echo "    make docker-logs     ENV=..   Follow k3d server logs"
	@echo "    make nodes           ENV=..   Show Kubernetes nodes"
	@echo "    make logs            ENV=.. CONTAINER=   Follow pod logs (default backend)"
	@echo "    make describe        ENV=.. CONTAINER=   Describe deployment"
	@echo "    make exec            ENV=.. CONTAINER=   Open shell in pod"
	@echo "    make teardown        ENV=..   Delete namespace (prompts)"
	@echo ""
	@echo "  $(BOLD)Logging$(RESET)"
	@echo "    make save-logs       ENV=..   Dump docker/k3d/k8s state to logs/"
	@echo "    make images          ENV=..   List locally built Docker images"
	@echo "    make logs-cleanup             Remove log files older than 30 days"
	@echo ""
	@echo "  $(BOLD)Prod extras (run from local machine)$(RESET)"
	@echo "    make sync                     Rsync prod code to VPS"
	@echo "    make remote CMD=...           Run any make command on VPS"
	@echo "    make scale-up                 Scale backend+frontend to 3 replicas"
	@echo "    make scale-down               Scale backend+frontend to 1 replica"
	@echo "    make scale BACKEND=N FRONTEND=N"
	@echo ""
	@echo "  $(BOLD)Other$(RESET)"
	@echo "    make setup            Install frontend/backend dependencies"
	@echo "    make test             Run tests"
	@echo "    make lint             Run linters"
	@echo "    make check-config     Validate secrets.yaml + generate DATABASE_URL"
	@echo "    make generate-secrets Update DATABASE_URL from postgres-secret"
	@echo "    make seed             Seed/reset admin user (runs k8s job)"
	@echo "    make create-user NAME=.. EMAIL=.. PASS=.. ROLE=.."
	@echo ""
	@echo "  Current ENV=$(ENV)  CONTAINER=$(CONTAINER)  CLUSTER=$(CLUSTER)  NAMESPACE=$(NAMESPACE)"
	@echo ""

# ── Setup ─────────────────────────────────────────────────────────────────────
.PHONY: setup
setup:
	$(call log,Installing frontend dependencies...)
	cd frontend && bun install
	$(call log,Downloading backend modules...)
	cd backend && go mod download

.PHONY: test
test:
	cd backend && go test ./... -v
	cd frontend && bun run test

.PHONY: lint
lint:
	cd backend && go vet ./...
	cd frontend && bun run lint

# ── Secrets check ─────────────────────────────────────────────────────────────
.PHONY: check-config _secrets-check

check-config: _secrets-check generate-secrets
	@mkdir -p $(LOGS_DIR) && { scripts/check-config.sh "$(SECRETS)" "$(ENV)" "$(OVERLAY)" 2>&1 | tee $(call logfile,check-config); }

_secrets-check:
	@[[ -f "$(SECRETS)" ]] || { \
	  echo -e "\033[1;31m[error]\033[0m Missing $(SECRETS)"; \
	  echo "  cp $(SECRETS).example $(SECRETS)"; \
	  exit 1; }
	@grep -q "CHANGE_ME" "$(SECRETS)" && { \
	  echo -e "\033[1;31m[error]\033[0m $(SECRETS) still has CHANGE_ME values"; exit 1; } || true

.PHONY: generate-secrets
generate-secrets:
	@scripts/generate-secrets.sh "$(SECRETS)"

# ── k3d image import ──────────────────────────────────────────────────────────
# Pipes the image directly into the k3d server's containerd (avoids rootless
# Docker socket issues with k3d image import tools container).
# Tags with docker.io/ prefix so containerd names match what kubelet resolves.
define import-image
	docker tag $(1) docker.io/$(1) 2>/dev/null; \
	docker save $(1) docker.io/$(1) | docker exec -i k3d-$(2)-server-0 ctr images import -
endef

# ── Cluster lifecycle ─────────────────────────────────────────────────────────
.PHONY: cluster-create
cluster-create:
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Creating $(ENV) cluster '$(CLUSTER)'..."; \
	  k3d cluster create --config infra/k3d/$(ENV)-cluster.yaml && \
	  k3d kubeconfig merge $(CLUSTER) --kubeconfig-merge-default && \
	  echo "$(INFO) Cluster ready — context: k3d-$(CLUSTER)"; \
	} 2>&1 | tee $(call logfile,cluster-create)

.PHONY: cluster-delete
cluster-delete:
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Deleting $(ENV) cluster '$(CLUSTER)'..."; \
	  k3d cluster delete $(CLUSTER); \
	} 2>&1 | tee $(call logfile,cluster-delete)

.PHONY: status
status: docker-ps nodes
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Kubernetes resources in $(NAMESPACE):"; \
	  $(KUBECTL) get pods,svc,ingress,jobs -n $(NAMESPACE); \
	} 2>&1 | tee $(call logfile,status)

.PHONY: docker-ps
docker-ps:
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Docker containers in $(CLUSTER) cluster:"; \
	  docker ps --filter "name=k3d-$(CLUSTER)" \
	    --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'; \
	} 2>&1 | tee $(call logfile,docker-ps)

.PHONY: docker-logs
docker-logs:
	$(call log,Following k3d server logs for $(CLUSTER)...)
	@docker logs -f k3d-$(CLUSTER)-server-0

.PHONY: nodes
nodes:
	$(call log,Kubernetes nodes:)
	$(KUBECTL) get nodes -o wide

.PHONY: teardown
teardown:
	@read -rp "Delete namespace $(NAMESPACE) from $(ENV) cluster? [y/N] " confirm; \
	  [[ "$$confirm" =~ ^[Yy]$$ ]] || { echo "Aborted"; exit 0; }; \
	  $(KUBECTL) delete namespace $(NAMESPACE) --ignore-not-found
	$(call log,Namespace $(NAMESPACE) deleted)

# ── Logs / Describe / Exec ───────────────────────────────────────────────────
CTL_TARGET = $(if $(filter all,$(CONTAINER)),backend,$(CONTAINER))

.PHONY: logs
logs:
	$(KUBECTL) logs -n $(NAMESPACE) -l app=$(CTL_TARGET) --tail=100 -f

.PHONY: describe
describe:
	$(KUBECTL) describe deployment/$(CTL_TARGET) -n $(NAMESPACE)

.PHONY: exec
exec:
	$(KUBECTL) exec -n $(NAMESPACE) -it deployment/$(CTL_TARGET) -- /bin/sh

# ── Build ─────────────────────────────────────────────────────────────────────
.PHONY: build
build:
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Building images for ENV=$(ENV) CONTAINER=$(CONTAINER)..."; \
	  if [ "$(CONTAINER)" = "backend" ] || [ "$(CONTAINER)" = "all" ]; then \
	    echo "$(INFO) Building backend..."; \
	    docker build -t $(BACKEND_IMG) ./backend && \
	    $(call import-image,$(BACKEND_IMG),$(CLUSTER)); \
	  fi; \
	  if [ "$(CONTAINER)" = "frontend" ] || [ "$(CONTAINER)" = "all" ]; then \
	    echo "$(INFO) Building frontend..."; \
	    docker build --build-arg VITE_API_BASE_URL=$(API_URL) -t $(FRONTEND_IMG) ./frontend && \
	    $(call import-image,$(FRONTEND_IMG),$(CLUSTER)); \
	  fi; \
	} 2>&1 | tee $(call logfile,build)

.PHONY: build-backend
build-backend:
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Building backend image for ENV=$(ENV)..."; \
	  docker build -t $(BACKEND_IMG) ./backend && \
	  echo "$(INFO) Loading backend image into cluster '$(CLUSTER)'..."; \
	  $(call import-image,$(BACKEND_IMG),$(CLUSTER)); \
	} 2>&1 | tee $(call logfile,build-backend)

.PHONY: build-frontend
build-frontend:
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Building frontend image for ENV=$(ENV)..."; \
	  docker build --build-arg VITE_API_BASE_URL=$(API_URL) -t $(FRONTEND_IMG) ./frontend && \
	  echo "$(INFO) Loading frontend image into cluster '$(CLUSTER)'..."; \
	  $(call import-image,$(FRONTEND_IMG),$(CLUSTER)); \
	} 2>&1 | tee $(call logfile,build-frontend)

# Granular deploy targets
.PHONY: deploy-backend
deploy-backend: check-config
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Deploying backend for ENV=$(ENV)..."; \
	  $(KUBECTL) rollout restart deployment/backend -n $(NAMESPACE); \
	  $(KUBECTL) rollout status deployment/backend -n $(NAMESPACE) --timeout=180s; \
	  echo "$(INFO) Backend deployed"; \
	} 2>&1 | tee $(call logfile,deploy-backend)

.PHONY: deploy-frontend
deploy-frontend: check-config
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Deploying frontend for ENV=$(ENV)..."; \
	  $(KUBECTL) rollout restart deployment/frontend -n $(NAMESPACE); \
	  $(KUBECTL) rollout status deployment/frontend -n $(NAMESPACE) --timeout=180s; \
	  echo "$(INFO) Frontend deployed"; \
	} 2>&1 | tee $(call logfile,deploy-frontend)

.PHONY: deploy-postgres
deploy-postgres: check-config
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Deploying postgres for ENV=$(ENV)..."; \
	  $(KUBECTL) rollout restart deployment/postgres -n $(NAMESPACE); \
	  $(KUBECTL) rollout status deployment/postgres -n $(NAMESPACE) --timeout=180s; \
	  echo "$(INFO) Postgres deployed"; \
	} 2>&1 | tee $(call logfile,deploy-postgres)

# ── Deploy — full clean-slate ─────────────────────────────────────────────────
.PHONY: deploy
deploy: check-config
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Starting clean-slate deploy for ENV=$(ENV)..."; \
	  k3d cluster stop $(CLUSTER) 2>/dev/null || true; \
	  k3d cluster delete $(CLUSTER) 2>/dev/null || true; \
	  $(MAKE) cluster-create ENV=$(ENV); \
	  if [ "$(ENV)" = "prod" ]; then \
	    $(MAKE) _install-ingress; \
	  fi; \
	  $(MAKE) build ENV=$(ENV); \
	  $(KUBECTL) apply -k $(OVERLAY); \
	  $(KUBECTL) rollout status deployment/backend  -n $(NAMESPACE) --timeout=180s; \
	  $(KUBECTL) rollout status deployment/frontend -n $(NAMESPACE) --timeout=180s; \
	  $(MAKE) _seed ENV=$(ENV); \
	  echo "$(INFO) Deploy complete — ENV=$(ENV)"; \
	  $(MAKE) status ENV=$(ENV); \
	  if [ "$(ENV)" = "prod" ]; then \
	    echo "$(INFO) TLS not yet configured. Run 'make tls' once the cluster is healthy."; \
	  fi; \
	} 2>&1 | tee $(call logfile,deploy)

# ── Refresh — rebuild + redeploy, no cluster recreate ────────────────────────
.PHONY: refresh
refresh: check-config
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Refreshing ENV=$(ENV)..."; \
	  $(MAKE) build ENV=$(ENV); \
	  $(KUBECTL) apply -k $(OVERLAY); \
	  $(KUBECTL) rollout restart deployment/backend  -n $(NAMESPACE); \
	  $(KUBECTL) rollout restart deployment/frontend -n $(NAMESPACE); \
	  $(KUBECTL) rollout status deployment/backend  -n $(NAMESPACE) --timeout=180s; \
	  $(KUBECTL) rollout status deployment/frontend -n $(NAMESPACE) --timeout=180s; \
	  echo "$(INFO) Deploy complete — ENV=$(ENV)"; \
	  $(MAKE) status ENV=$(ENV); \
	  echo "$(INFO) Refresh complete"; \
	} 2>&1 | tee $(call logfile,refresh)

# ── Retry — restart failing pods and re-run failed seed job ──────────────────
# Detects deployments that aren't fully available and the seed job if it failed,
# then restarts them and waits for readiness. Useful after a flaky deploy/refresh.
.PHONY: retry
retry: check-config
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Retrying failed resources for ENV=$(ENV)..."; \
	  \
	  echo "$(INFO) Step 1: Restarting deployments that are not fully available..."; \
	  for dep in backend frontend postgres; do \
	    ready=$$($(KUBECTL) get deployment/$$dep -n $(NAMESPACE) -o jsonpath='{.status.readyReplicas}' 2>/dev/null); \
	    desired=$$($(KUBECTL) get deployment/$$dep -n $(NAMESPACE) -o jsonpath='{.status.replicas}' 2>/dev/null); \
	    if [ "$$ready" != "$$desired" ] 2>/dev/null; then \
	      echo "  → $$dep: $${ready:-0}/$${desired:-0} ready — restarting..."; \
	      $(KUBECTL) rollout restart deployment/$$dep -n $(NAMESPACE) 2>/dev/null || \
	        echo "  ⚠️  Could not restart $$dep"; \
	      $(KUBECTL) rollout status deployment/$$dep -n $(NAMESPACE) --timeout=180s || \
	        echo "  ⚠️  $$dep still not available after restart"; \
	    else \
	      echo "  ✓ $$dep: $${ready:-0}/$${desired:-0} ready"; \
	    fi; \
	  done; \
	  \
	  echo "$(INFO) Step 2: Re-running any failed seed job..."; \
	  seed_status=$$($(KUBECTL) get job seed-admin -n $(NAMESPACE) -o jsonpath='{.status.conditions[?(@.type=="Failed")].status}' 2>/dev/null); \
	  if [ "$$seed_status" == "True" ]; then \
	    echo "  → seed-admin job failed — restarting..."; \
	    $(KUBECTL) delete job seed-admin -n $(NAMESPACE) --ignore-not-found 2>/dev/null; \
	    $(KUBECTL) kustomize $(OVERLAY) | awk '/^---/{p=0} /kind: Job/{p=1} p' | $(KUBECTL) apply -f - && \
	    $(KUBECTL) wait --for=condition=complete job/seed-admin -n $(NAMESPACE) --timeout=180s && \
	      echo "  ✓ seed-admin completed" || \
	      echo "  ⚠️  seed-admin still failing — check logs with: $(KUBECTL) logs -n $(NAMESPACE) -l job-name=seed-admin"; \
	  elif [ "$$seed_status" == "" ]; then \
	    echo "  → seed-admin job not found — creating..."; \
	    $(KUBECTL) kustomize $(OVERLAY) | awk '/^---/{p=0} /kind: Job/{p=1} p' | $(KUBECTL) apply -f -; \
	    $(KUBECTL) wait --for=condition=complete job/seed-admin -n $(NAMESPACE) --timeout=180s && \
	      echo "  ✓ seed-admin completed" || \
	      echo "  ⚠️  seed-admin still failing — check logs with: $(KUBECTL) logs -n $(NAMESPACE) -l job-name=seed-admin"; \
	  else \
	    echo "  ✓ seed-admin already complete"; \
	  fi; \
	  \
	  echo "$(INFO) Step 3: Final status..."; \
	  $(MAKE) status ENV=$(ENV); \
	  echo "$(INFO) Retry complete — ENV=$(ENV)"; \
	} 2>&1 | tee $(call logfile,retry)

# ── Migrate — restart backend to re-run migrations ───────────────────────────
.PHONY: migrate
migrate: check-config
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Running migrations for ENV=$(ENV)..."; \
	  $(KUBECTL) rollout restart deployment/backend -n $(NAMESPACE); \
	  $(KUBECTL) rollout status  deployment/backend -n $(NAMESPACE) --timeout=180s; \
	  echo "$(INFO) Migrations complete"; \
	} 2>&1 | tee $(call logfile,migrate)

# ── Seed ──────────────────────────────────────────────────────────────────────
.PHONY: _seed
_seed:
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Seeding admin user via k8s job..."; \
	  $(KUBECTL) delete job seed-admin -n $(NAMESPACE) --ignore-not-found 2>/dev/null || true; \
	  $(KUBECTL) kustomize $(OVERLAY) | awk '/^---/{p=0} /kind: Job/{p=1} p' | $(KUBECTL) apply -f -; \
	  $(KUBECTL) wait --for=condition=complete job/seed-admin -n $(NAMESPACE) --timeout=180s; \
	  $(KUBECTL) logs -n $(NAMESPACE) -l job-name=seed-admin; \
	} 2>&1 | tee $(call logfile,seed)

.PHONY: seed
seed: check-config
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Seeding admin user via k8s job..."; \
	  $(KUBECTL) delete job seed-admin -n $(NAMESPACE) --ignore-not-found 2>/dev/null || true; \
	  $(KUBECTL) kustomize $(OVERLAY) | awk '/^---/{p=0} /kind: Job/{p=1} p' | $(KUBECTL) apply -f -; \
	  $(KUBECTL) wait --for=condition=complete job/seed-admin -n $(NAMESPACE) --timeout=180s; \
	  $(KUBECTL) logs -n $(NAMESPACE) -l job-name=seed-admin; \
	} 2>&1 | tee $(call logfile,seed)

# ── Comprehensive log dump ─────────────────────────────────────────────────────
.PHONY: save-logs
save-logs:
	@mkdir -p $(LOGS_DIR) && { \
	  echo "========== SAVE-LOGS $(ENV) $(TS) =========="; \
	  echo ""; \
	  echo "--- Docker containers ---"; \
	  docker ps --filter "name=k3d-$(CLUSTER)" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' 2>&1; \
	  echo ""; \
	  echo "--- Docker images (custom) ---"; \
	  docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}' | grep -E '(kumbi|none)' 2>&1 || echo "(none)"; \
	  echo ""; \
	  echo "--- k3d clusters ---"; \
	  k3d cluster list 2>&1; \
	  echo ""; \
	  echo "--- k8s nodes ---"; \
	  $(KUBECTL) get nodes -o wide 2>&1; \
	  echo ""; \
	  echo "--- k8s all resources ---"; \
	  $(KUBECTL) get all -n $(NAMESPACE) 2>&1; \
	  echo ""; \
	  echo "--- k8s configmaps ---"; \
	  $(KUBECTL) get configmap -n $(NAMESPACE) -o yaml 2>&1; \
	  echo ""; \
	  echo "--- k8s events (recent) ---"; \
	  $(KUBECTL) get events -n $(NAMESPACE) --sort-by='.lastTimestamp' 2>&1 | tail -30; \
	  echo ""; \
	  echo "--- Backend describe ---"; \
	  $(KUBECTL) describe deployment/backend -n $(NAMESPACE) 2>&1 | head -60; \
	  echo ""; \
	  echo "--- Backend recent logs ---"; \
	  $(KUBECTL) logs -n $(NAMESPACE) -l app=backend --tail=30 2>&1; \
	  echo ""; \
	  echo "========== END SAVE-LOGS =========="; \
	} 2>&1 | tee $(call logfile,save-logs)

# ── List built images ─────────────────────────────────────────────────────────
.PHONY: images
images:
	@docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}' | grep -E '(kumbi|^REPOSITORY)'

# ── Log rotation ──────────────────────────────────────────────────────────────
.PHONY: logs-cleanup
logs-cleanup:
	@echo "$(INFO) Removing logs older than 30 days..."; \
	find $(LOGS_DIR) -name '*.log' -type f -mtime +30 -delete; \
	find $(LOGS_DIR) -name '*.log' -type f | wc -l | xargs echo "$(INFO) Remaining log files:"
.PHONY: _install-ingress
_install-ingress:
	$(call log,Installing NGINX Ingress Controller...)
	kubectl --context k3d-$(CLUSTER) apply -f \
	  https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml
	kubectl --context k3d-$(CLUSTER) wait --namespace ingress-nginx \
	  --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=180s

.PHONY: _install-cert-manager
_install-cert-manager:
	$(call log,Installing cert-manager...)
	kubectl --context k3d-$(CLUSTER) apply -f \
	  https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml
	$(call log,Waiting for cert-manager...)
	kubectl --context k3d-$(CLUSTER) wait --for=condition=Available \
	  deployment --all -n cert-manager --timeout=180s
	$(call log,Applying ClusterIssuer...)
	kubectl --context k3d-$(CLUSTER) apply -f $(OVERLAY)/issuer.yaml

# ── Remote helpers (invoke prod commands from local machine via SSH) ───────────
# Usage: make sync
#        make remote CMD=build ENV=prod
#        make remote CMD=deploy ENV=prod
#        make remote CMD=refresh ENV=prod
#        make remote CMD=migrate ENV=prod
.PHONY: sync
sync:
	$(call log,Syncing prod code to $(PROD_HOST):$(REMOTE_DEST)...)
	rsync -avz --delete \
	  --exclude='.git' \
	  --exclude='.github' \
	  --exclude='.opencode' \
	  --exclude='.env' \
	  --exclude='.env.example' \
	  --exclude='node_modules' \
	  --exclude='backend/bin' \
	  --exclude='infra/k3d' \
	  --exclude='infra/k8s/overlays/dev' \
	  --exclude='infra/k8s/overlays/test' \
	  --exclude='infra/k8s/overlays/staging' \
	  --exclude='infra/k8s/overlays/prod/secrets.yaml' \
	  --exclude='logs' \
	  ./ $(PROD_HOST):$(REMOTE_DEST)/

.PHONY: remote
remote: sync
	$(call log,Running 'make $(CMD) ENV=$(or $(ENV),prod)' on $(PROD_HOST)...)
	ssh $(PROD_HOST) "cd $(REMOTE_DEST) && make $(CMD) ENV=$(or $(ENV),prod)"

# ── Scaling (prod only) ───────────────────────────────────────────────────────
BACKEND_REPLICAS  ?= 3
FRONTEND_REPLICAS ?= 3

.PHONY: scale
scale:
	$(KUBECTL) scale deployment/backend  --replicas=$(BACKEND_REPLICAS)  -n $(NAMESPACE)
	$(KUBECTL) scale deployment/frontend --replicas=$(FRONTEND_REPLICAS) -n $(NAMESPACE)
	$(call log,backend=$(BACKEND_REPLICAS) frontend=$(FRONTEND_REPLICAS))

.PHONY: scale-up
scale-up:
	$(MAKE) scale ENV=$(ENV) BACKEND_REPLICAS=3 FRONTEND_REPLICAS=3

.PHONY: scale-down
scale-down:
	$(MAKE) scale ENV=$(ENV) BACKEND_REPLICAS=1 FRONTEND_REPLICAS=1

# ── User management ───────────────────────────────────────────────────────────
.PHONY: create-user
create-user: check-config
	@[[ -n "$(NAME)" && -n "$(EMAIL)" && -n "$(PASS)" ]] || { \
	  echo "Usage: make create-user NAME='Jane Doe' EMAIL=jane@example.com PASS=secret ROLE=admin"; \
	  exit 1; }
	$(eval PGUSER := $(shell grep 'POSTGRES_USER' $(SECRETS) | awk '{print $$2}'))
	$(eval PGPASS := $(shell grep 'POSTGRES_PASSWORD' $(SECRETS) | awk '{print $$2}'))
	$(eval PGDB   := $(shell grep 'POSTGRES_DB' $(SECRETS) | awk '{print $$2}'))
	$(eval JWT    := $(shell grep 'JWT_SECRET' $(SECRETS) | awk '{print $$2}'))
	$(eval HOST   := $(or $(POSTGRES_HOST),localhost))
	cd backend && \
	  POSTGRES_USER=$(PGUSER) \
	  POSTGRES_PASSWORD=$(PGPASS) \
	  POSTGRES_DB=$(PGDB) \
	  POSTGRES_HOST=$(HOST) \
	  JWT_SECRET=$(JWT) \
	  go run ./cmd/seed create-user "$(NAME)" "$(EMAIL)" "$(PASS)" "$(or $(ROLE),admin)"

# ── Docker Compose (local tooling helper) ─────────────────────────────────────
.PHONY: compose-up compose-down compose-logs
compose-up:   ; docker compose up --build -d
compose-down: ; docker compose down
compose-logs: ; docker compose logs -f
