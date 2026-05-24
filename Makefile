# Kumbi — The People's Baraza
# Usage: make <command> [ENV=dev|test|prod]
# Run `make help` for a full list of commands.
#
# On the VPS, run commands directly (no SSH):
#   make deploy ENV=prod
#   make refresh ENV=prod
#   make migrate ENV=prod

SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

# ── Environment ───────────────────────────────────────────────────────────────
ENV ?= dev

# Validate ENV
ifeq ($(filter $(ENV),dev test prod),)
  $(error ENV must be dev, test, or prod — got '$(ENV)')
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
else
  CLUSTER   := kumbi-dev
  NAMESPACE := kumbi
  IMG_TAG   := dev
  OVERLAY   := infra/k8s/overlays/dev
  API_URL   ?= http://localhost/api
  KUBECTL   := kubectl --context k3d-kumbi-dev
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

ENV_FILE ?= .env
-include $(ENV_FILE)
export

# ── Help ──────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  $(BOLD)Kumbi — The People's Baraza$(RESET)"
	@echo ""
	@echo "  $(BOLD)Usage$(RESET)"
	@echo "    make <command> [ENV=dev|test|prod]   default ENV=dev"
	@echo ""
	@echo "  $(BOLD)Core commands$(RESET)"
	@echo "    make build    ENV=..   Build Docker images"
	@echo "    make deploy   ENV=..   Full clean-slate deploy (cluster + infra + app + seed)"
	@echo "    make refresh  ENV=..   Rebuild images and redeploy (no cluster recreate)"
	@echo "    make migrate  ENV=..   Re-run DB migrations (restarts backend)"
	@echo ""
	@echo "  $(BOLD)Cluster$(RESET)"
	@echo "    make cluster-create  ENV=..   Create k3d cluster"
	@echo "    make cluster-delete  ENV=..   Delete k3d cluster"
	@echo "    make status          ENV=..   Show pods/svc/ingress"
	@echo "    make teardown        ENV=..   ⚠ Delete namespace (prompts)"
	@echo ""
	@echo "  $(BOLD)Prod extras (run from local machine)$(RESET)"
	@echo "    make sync                     Rsync source to VPS"
	@echo "    make remote CMD=<command>     Run any make command on VPS"
	@echo "    make scale-up                 Scale backend+frontend to 3 replicas"
	@echo "    make scale-down               Scale backend+frontend to 1 replica"
	@echo "    make scale BACKEND=N FRONTEND=N"
	@echo ""
	@echo "  $(BOLD)Other$(RESET)"
	@echo "    make setup            Install frontend/backend dependencies"
	@echo "    make test             Run tests"
	@echo "    make lint             Run linters"
	@echo "    make seed             Seed/reset admin user"
	@echo "    make create-user NAME=.. EMAIL=.. PASS=.. ROLE=.."
	@echo ""
	@echo "  Current ENV=$(ENV)  CLUSTER=$(CLUSTER)  NAMESPACE=$(NAMESPACE)"
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
.PHONY: _secrets-check
_secrets-check:
	@[[ -f "$(SECRETS)" ]] || { \
	  echo -e "\033[1;31m[error]\033[0m Missing $(SECRETS)"; \
	  echo "  cp $(SECRETS).example $(SECRETS)"; \
	  exit 1; }
	@grep -q "CHANGE_ME" "$(SECRETS)" && { \
	  echo -e "\033[1;31m[error]\033[0m $(SECRETS) still has CHANGE_ME values"; exit 1; } || true

# ── k3d image import — rootless Docker compatible ─────────────────────────────
define import-image
	docker save $(1) | docker exec -i k3d-$(2)-server-0 ctr images import -
endef

# ── Cluster lifecycle ─────────────────────────────────────────────────────────
.PHONY: cluster-create
cluster-create:
	$(call log,Creating $(ENV) cluster '$(CLUSTER)'...)
	k3d cluster create --config infra/k3d/$(ENV)-cluster.yaml
	k3d kubeconfig merge $(CLUSTER) --kubeconfig-merge-default
	$(call log,Cluster ready — context: k3d-$(CLUSTER))

.PHONY: cluster-delete
cluster-delete:
	$(call log,Deleting $(ENV) cluster '$(CLUSTER)'...)
	k3d cluster delete $(CLUSTER)

.PHONY: status
status:
	$(KUBECTL) get pods,svc,ingress,jobs -n $(NAMESPACE)

.PHONY: teardown
teardown:
	@read -rp "Delete namespace $(NAMESPACE) from $(ENV) cluster? [y/N] " confirm; \
	  [[ "$$confirm" =~ ^[Yy]$$ ]] || { echo "Aborted"; exit 0; }; \
	  $(KUBECTL) delete namespace $(NAMESPACE) --ignore-not-found
	$(call log,Namespace $(NAMESPACE) deleted)

# ── Build ─────────────────────────────────────────────────────────────────────
.PHONY: build
build:
	$(call log,Building images for ENV=$(ENV)...)
	docker build -t $(BACKEND_IMG) ./backend
	docker build --build-arg VITE_API_BASE_URL=$(API_URL) \
	  -t $(FRONTEND_IMG) ./frontend
	$(call log,Loading images into cluster '$(CLUSTER)'...)
	$(call import-image,$(BACKEND_IMG),$(CLUSTER))
	$(call import-image,$(FRONTEND_IMG),$(CLUSTER))

# ── Deploy — full clean-slate ─────────────────────────────────────────────────
.PHONY: deploy
deploy: _secrets-check
	$(call log,Starting clean-slate deploy for ENV=$(ENV)...)
	# Wipe existing cluster and Docker state
	k3d cluster stop $(CLUSTER) 2>/dev/null || true
	k3d cluster delete $(CLUSTER) 2>/dev/null || true
	#docker system prune -af --volumes 2>/dev/null || true
	# Fresh cluster
	$(MAKE) cluster-create ENV=$(ENV)
ifeq ($(ENV),prod)
	# Install NGINX ingress
	$(MAKE) _install-ingress
	# Install cert-manager + ClusterIssuer
	$(MAKE) _install-cert-manager
endif
	# Build and load images
	$(MAKE) build ENV=$(ENV)
	# Apply overlay
	$(KUBECTL) apply -k $(OVERLAY)
	# Wait for rollout
	$(KUBECTL) rollout status deployment/backend  -n $(NAMESPACE) --timeout=180s
	$(KUBECTL) rollout status deployment/frontend -n $(NAMESPACE) --timeout=180s
	# Seed admin
	$(MAKE) _seed ENV=$(ENV)
	$(call log,Deploy complete — ENV=$(ENV))
	$(MAKE) status ENV=$(ENV)

# ── Refresh — rebuild + redeploy, no cluster recreate ────────────────────────
.PHONY: refresh
refresh:
	$(call log,Refreshing ENV=$(ENV)...)
	$(MAKE) build ENV=$(ENV)
	$(KUBECTL) rollout restart deployment/backend deployment/frontend -n $(NAMESPACE)
	$(KUBECTL) rollout status  deployment/backend deployment/frontend -n $(NAMESPACE) --timeout=120s
	$(call log,Refresh complete)

# ── Migrate — restart backend to re-run migrations ───────────────────────────
.PHONY: migrate
migrate:
	$(call log,Running migrations for ENV=$(ENV)...)
	$(KUBECTL) rollout restart deployment/backend -n $(NAMESPACE)
	$(KUBECTL) rollout status  deployment/backend -n $(NAMESPACE) --timeout=60s
	$(call log,Migrations complete)

# ── Seed ──────────────────────────────────────────────────────────────────────
.PHONY: _seed
_seed:
	$(KUBECTL) delete job seed-admin -n $(NAMESPACE) --ignore-not-found
	$(KUBECTL) apply -k $(OVERLAY)
	$(KUBECTL) wait --for=condition=complete job/seed-admin -n $(NAMESPACE) --timeout=60s
	$(KUBECTL) logs -n $(NAMESPACE) -l job-name=seed-admin

# ── Prod infra helpers (run locally on VPS) ───────────────────────────────────
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
#        make remote CMD=deploy ENV=prod
#        make remote CMD=refresh ENV=prod
#        make remote CMD=migrate ENV=prod
.PHONY: sync
sync:
	$(call log,Syncing source to $(PROD_HOST):$(REMOTE_DEST)...)
	rsync -avz --exclude='.git' --exclude='node_modules' --exclude='backend/bin' \
	  --exclude='infra/k8s/overlays/prod/secrets.yaml' \
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
.PHONY: _check-env-file
_check-env-file:
	@[[ -f "$(ENV_FILE)" ]] || { \
	  echo -e "\033[1;31m[error]\033[0m Missing $(ENV_FILE) — cp .env.example .env"; \
	  exit 1; }

.PHONY: seed
seed: _check-env-file
	cd backend && go run ./cmd/seed admin "$(SEED_ADMIN_EMAIL)" "$(SEED_ADMIN_PASSWORD)"

.PHONY: create-user
create-user: _check-env-file
	@[[ -n "$(NAME)" && -n "$(EMAIL)" && -n "$(PASS)" ]] || { \
	  echo "Usage: make create-user NAME='Jane Doe' EMAIL=jane@example.com PASS=secret ROLE=admin"; \
	  exit 1; }
	cd backend && go run ./cmd/seed create-user "$(NAME)" "$(EMAIL)" "$(PASS)" "$(or $(ROLE),admin)"

# ── Docker Compose (local tooling helper) ─────────────────────────────────────
.PHONY: compose-up compose-down compose-logs
compose-up:   ; docker compose up --build -d
compose-down: ; docker compose down
compose-logs: ; docker compose logs -f
