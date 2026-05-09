# Kumbi — The People's Baraza
# Usage: make <target>
# Run `make help` for a full list of targets.

SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

# ── Config ────────────────────────────────────────────────────────────────────
REGISTRY   ?= registry.localhost:5000
TAG        ?= latest
ENV_FILE   ?= .env

BACKEND_IMG  := kumbi/backend
FRONTEND_IMG := kumbi/frontend

# k3d cluster names
DEV_CLUSTER  := kumbi-dev
TEST_CLUSTER := kumbi-test

# kubectl always talks to the right cluster via --context
DEV_CTX  := k3d-$(DEV_CLUSTER)
TEST_CTX := k3d-$(TEST_CLUSTER)

KUBECTL      := kubectl
KUBECTL_DEV  := kubectl --context $(DEV_CTX)
KUBECTL_TEST := kubectl --context $(TEST_CTX)

# Load .env if it exists
-include $(ENV_FILE)
export

# ── Helpers ───────────────────────────────────────────────────────────────────
BOLD  := \033[1m
RESET := \033[0m
INFO  := \033[1;36m[kumbi]\033[0m

log = @echo -e "$(INFO) $(1)"

# ── Help ──────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  $(BOLD)Kumbi — The People's Baraza$(RESET)"
	@echo ""
	@echo "  $(BOLD)Prerequisites$(RESET)"
	@echo "    brew install k3d   (or: curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash)"
	@echo "    brew install kubectl"
	@echo ""
	@echo "  $(BOLD)Setup$(RESET)"
	@echo "    make setup          Install frontend/backend dependencies"
	@echo "    make k3d-create     Create dev k3d cluster (one-time)"
	@echo "    make k3d-delete     Delete dev k3d cluster"
	@echo ""
	@echo "  $(BOLD)Dev (k3d — identical infra to all environments)$(RESET)"
	@echo "    make dev            Build images, load into k3d, deploy dev overlay"
	@echo "    make k8s-dev-up     Same as dev"
	@echo "    make k8s-dev-down   Remove kumbi namespace from dev cluster"
	@echo "    make k8s-dev-seed   Re-run seed-admin job"
	@echo "    make k8s-status     Show pods/svc/ingress in dev cluster"
	@echo ""
	@echo "  $(BOLD)Test (separate k3d cluster)$(RESET)"
	@echo "    make k3d-test-create  Create test k3d cluster"
	@echo "    make k8s-test-up      Build, load, deploy test overlay"
	@echo "    make k8s-test-down    Remove kumbi-test namespace"
	@echo ""
	@echo "  $(BOLD)Staging / Prod (registry-based)$(RESET)"
	@echo "    make k8s-staging-build  Build + push staging images"
	@echo "    make k8s-staging-apply  Apply staging overlay"
	@echo "    make k8s-prod-deploy    Full prod deploy (build+apply+rollout+seed)"
	@echo "    make k8s-teardown       Delete kumbi namespace (destructive)"
	@echo ""
	@echo "  $(BOLD)User management$(RESET)"
	@echo "    make seed           Seed/reset admin user (native)"
	@echo "    make create-user NAME=.. EMAIL=.. PASS=.. ROLE=.."
	@echo ""
	@echo "  Variables: REGISTRY=$(REGISTRY)  TAG=$(TAG)"
	@echo "             DEV_CLUSTER=$(DEV_CLUSTER)  TEST_CLUSTER=$(TEST_CLUSTER)"
	@echo ""

# ── Dependencies ──────────────────────────────────────────────────────────────
.PHONY: setup
setup:
	$(call log,Installing frontend dependencies...)
	cd frontend && bun install
	$(call log,Downloading backend modules...)
	cd backend && go mod download

# ── k3d image import — rootless Docker compatible ─────────────────────────────
# k3d image import uses a tools container that needs /var/run/docker.sock,
# which doesn't exist in rootless Docker. Pipe via docker exec instead.
define import-image
	docker save $(1) | docker exec -i k3d-$(2)-server-0 ctr images import -
endef

# ── k3d cluster lifecycle ─────────────────────────────────────────────────────
.PHONY: k3d-create
k3d-create:
	$(call log,Creating dev k3d cluster '$(DEV_CLUSTER)'...)
	k3d cluster create --config infra/k3d/dev-cluster.yaml
	k3d kubeconfig merge $(DEV_CLUSTER) --kubeconfig-merge-default
	$(call log,Cluster ready — context: $(DEV_CTX))

.PHONY: k3d-delete
k3d-delete:
	$(call log,Deleting dev k3d cluster '$(DEV_CLUSTER)'...)
	k3d cluster delete $(DEV_CLUSTER)

.PHONY: k3d-test-create
k3d-test-create:
	$(call log,Creating test k3d cluster '$(TEST_CLUSTER)'...)
	k3d cluster create --config infra/k3d/test-cluster.yaml
	k3d kubeconfig merge $(TEST_CLUSTER) --kubeconfig-merge-default

.PHONY: k3d-test-delete
k3d-test-delete:
	k3d cluster delete $(TEST_CLUSTER)

# ── Build ─────────────────────────────────────────────────────────────────────
.PHONY: build
build:
	$(call log,Building frontend...)
	cd frontend && bun run build
	$(call log,Building backend...)
	cd backend && CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/server ./cmd/server

.PHONY: test
test:
	cd backend && go test ./... -v
	cd frontend && bun run test

.PHONY: lint
lint:
	cd backend && go vet ./...
	cd frontend && bun run lint

# ── Docker Compose (local tooling helper only) ────────────────────────────────
.PHONY: compose-up compose-down compose-logs
compose-up:   ; docker compose up --build -d
compose-down: ; docker compose down
compose-logs: ; docker compose logs -f

# ── dev = k8s-dev-up ──────────────────────────────────────────────────────────
.PHONY: dev
dev: k8s-dev-up

# ── k8s dev overlay (k3d) ─────────────────────────────────────────────────────
.PHONY: _dev-secrets-check
_dev-secrets-check:
	@[[ -f infra/k8s/overlays/dev/secrets.yaml ]] || { \
	  echo -e "\033[1;31m[error]\033[0m Missing infra/k8s/overlays/dev/secrets.yaml"; \
	  echo "  cp infra/k8s/overlays/dev/secrets.yaml.example infra/k8s/overlays/dev/secrets.yaml"; \
	  exit 1; }

.PHONY: k8s-dev-up
k8s-dev-up: _dev-secrets-check
	$(call log,Ensuring dev cluster exists...)
	@k3d cluster list | grep -q "$(DEV_CLUSTER)" || $(MAKE) k3d-create
	$(call log,Building images...)
	docker build -t $(BACKEND_IMG):dev ./backend
	docker build \
	  --build-arg VITE_API_BASE_URL=$${VITE_API_BASE_URL:-http://localhost/api} \
	  -t $(FRONTEND_IMG):dev ./frontend
	$(call log,Loading images into k3d cluster '$(DEV_CLUSTER)'...)
	$(call import-image,$(BACKEND_IMG):dev,$(DEV_CLUSTER))
	$(call import-image,$(FRONTEND_IMG):dev,$(DEV_CLUSTER))
	$(call log,Applying dev overlay...)
	$(KUBECTL_DEV) apply -k infra/k8s/overlays/dev
	$(call log,Waiting for rollout...)
	$(KUBECTL_DEV) rollout status deployment/backend  -n kumbi --timeout=120s
	$(KUBECTL_DEV) rollout status deployment/frontend -n kumbi --timeout=120s
	$(MAKE) k8s-dev-seed
	$(call log,Dev cluster ready)
	$(call log,  Frontend: http://localhost)
	$(call log,  Backend:  http://localhost/api)
	$(call log,  CMS:      http://localhost/cms)

.PHONY: k8s-dev-down
k8s-dev-down:
	$(KUBECTL_DEV) delete namespace kumbi --ignore-not-found

.PHONY: k8s-dev-seed
k8s-dev-seed:
	$(KUBECTL_DEV) delete job seed-admin -n kumbi --ignore-not-found
	$(KUBECTL_DEV) apply -f infra/k8s/base/seed-job.yaml
	$(KUBECTL_DEV) wait --for=condition=complete job/seed-admin -n kumbi --timeout=60s
	$(KUBECTL_DEV) logs -n kumbi -l job-name=seed-admin

.PHONY: k8s-status
k8s-status:
	$(KUBECTL_DEV) get pods,svc,ingress,jobs -n kumbi

# ── k8s test overlay (separate k3d cluster) ───────────────────────────────────
.PHONY: _test-secrets-check
_test-secrets-check:
	@[[ -f infra/k8s/overlays/test/secrets.yaml ]] || { \
	  echo -e "\033[1;31m[error]\033[0m Missing infra/k8s/overlays/test/secrets.yaml"; \
	  echo "  cp infra/k8s/overlays/test/secrets.yaml.example infra/k8s/overlays/test/secrets.yaml"; \
	  exit 1; }

.PHONY: k8s-test-up
k8s-test-up: _test-secrets-check
	@k3d cluster list | grep -q "$(TEST_CLUSTER)" || $(MAKE) k3d-test-create
	docker build -t $(BACKEND_IMG):test ./backend
	docker build \
	  --build-arg VITE_API_BASE_URL=$${VITE_API_BASE_URL:-http://localhost:8080/api} \
	  -t $(FRONTEND_IMG):test ./frontend
	$(call import-image,$(BACKEND_IMG):test,$(TEST_CLUSTER))
	$(call import-image,$(FRONTEND_IMG):test,$(TEST_CLUSTER))
	$(KUBECTL_TEST) apply -k infra/k8s/overlays/test
	$(KUBECTL_TEST) rollout status deployment/backend  -n kumbi-test --timeout=120s
	$(KUBECTL_TEST) rollout status deployment/frontend -n kumbi-test --timeout=120s
	$(call log,Test cluster ready — http://localhost:8080)

.PHONY: k8s-test-down
k8s-test-down:
	$(KUBECTL_TEST) delete namespace kumbi-test --ignore-not-found

# ── k8s staging overlay ───────────────────────────────────────────────────────
.PHONY: _staging-secrets-check
_staging-secrets-check:
	@[[ -f infra/k8s/overlays/staging/secrets.yaml ]] || { \
	  echo -e "\033[1;31m[error]\033[0m Missing infra/k8s/overlays/staging/secrets.yaml"; \
	  exit 1; }
	@grep -q "CHANGE_ME" infra/k8s/overlays/staging/secrets.yaml && { \
	  echo -e "\033[1;31m[error]\033[0m staging secrets.yaml still has CHANGE_ME values"; exit 1; } || true

.PHONY: k8s-staging-build
k8s-staging-build:
	docker build -t $(REGISTRY)/$(BACKEND_IMG):$(TAG) ./backend
	docker push $(REGISTRY)/$(BACKEND_IMG):$(TAG)
	docker build --build-arg VITE_API_BASE_URL=$(VITE_API_BASE_URL) \
	  -t $(REGISTRY)/$(FRONTEND_IMG):$(TAG) ./frontend
	docker push $(REGISTRY)/$(FRONTEND_IMG):$(TAG)

.PHONY: k8s-staging-apply
k8s-staging-apply: _staging-secrets-check
	$(KUBECTL) apply -k infra/k8s/overlays/staging

# ── k8s prod overlay ──────────────────────────────────────────────────────────
.PHONY: _prod-secrets-check
_prod-secrets-check:
	@[[ -f infra/k8s/overlays/prod/secrets.yaml ]] || { \
	  echo -e "\033[1;31m[error]\033[0m Missing infra/k8s/overlays/prod/secrets.yaml"; \
	  exit 1; }
	@grep -q "CHANGE_ME" infra/k8s/overlays/prod/secrets.yaml && { \
	  echo -e "\033[1;31m[error]\033[0m prod secrets.yaml still has CHANGE_ME values"; exit 1; } || true

.PHONY: k8s-prod-build
k8s-prod-build:
	docker build -t $(REGISTRY)/$(BACKEND_IMG):$(TAG) ./backend
	docker push $(REGISTRY)/$(BACKEND_IMG):$(TAG)
	docker build --build-arg VITE_API_BASE_URL=$(VITE_API_BASE_URL) \
	  -t $(REGISTRY)/$(FRONTEND_IMG):$(TAG) ./frontend
	docker push $(REGISTRY)/$(FRONTEND_IMG):$(TAG)

.PHONY: k8s-prod-apply
k8s-prod-apply: _prod-secrets-check
	$(KUBECTL) apply -k infra/k8s/overlays/prod

.PHONY: k8s-prod-rollout
k8s-prod-rollout:
	$(KUBECTL) rollout restart deployment/backend  -n kumbi
	$(KUBECTL) rollout restart deployment/frontend -n kumbi
	$(KUBECTL) rollout status  deployment/backend  -n kumbi
	$(KUBECTL) rollout status  deployment/frontend -n kumbi

.PHONY: k8s-prod-seed
k8s-prod-seed:
	$(KUBECTL) delete job seed-admin -n kumbi --ignore-not-found
	$(KUBECTL) apply -f infra/k8s/base/seed-job.yaml
	$(KUBECTL) wait --for=condition=complete job/seed-admin -n kumbi --timeout=60s
	$(KUBECTL) logs -n kumbi -l job-name=seed-admin

.PHONY: k8s-prod-deploy
k8s-prod-deploy: k8s-prod-build k8s-prod-apply k8s-prod-rollout k8s-prod-seed k8s-status

.PHONY: k8s-teardown
k8s-teardown:
	@read -rp "Delete ALL kumbi resources from the cluster? [y/N] " confirm; \
	  [[ "$$confirm" =~ ^[Yy]$$ ]] || { echo "Aborted"; exit 0; }; \
	  $(KUBECTL) delete namespace kumbi --ignore-not-found; \
	  echo -e "$(INFO) Namespace kumbi deleted"

# ── User management ───────────────────────────────────────────────────────────
.PHONY: seed
seed: _check-env
	cd backend && go run ./cmd/seed admin "$(SEED_ADMIN_EMAIL)" "$(SEED_ADMIN_PASSWORD)"

.PHONY: create-user
create-user: _check-env
	@[[ -n "$(NAME)" && -n "$(EMAIL)" && -n "$(PASS)" ]] || { \
	  echo "Usage: make create-user NAME='Jane Doe' EMAIL=jane@example.com PASS=secret ROLE=admin"; \
	  exit 1; }
	cd backend && go run ./cmd/seed create-user "$(NAME)" "$(EMAIL)" "$(PASS)" "$(or $(ROLE),admin)"

# ── Internal ──────────────────────────────────────────────────────────────────
.PHONY: _check-env
_check-env:
	@[[ -f "$(ENV_FILE)" ]] || { \
	  echo -e "\033[1;31m[error]\033[0m Missing $(ENV_FILE) — cp .env.example .env"; \
	  exit 1; }

# Load .env if it exists (for native dev targets)
-include $(ENV_FILE)
export

# ── Helpers ───────────────────────────────────────────────────────────────────
BOLD  := \033[1m
RESET := \033[0m
INFO  := \033[1;36m[kumbi]\033[0m

log = @echo -e "$(INFO) $(1)"

# ── Help ──────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  $(BOLD)Kumbi — The People's Baraza$(RESET)"
	@echo ""
	@echo "  $(BOLD)Local dev (k8s — identical to all environments)$(RESET)"
	@echo "    make setup          Install all dependencies"
	@echo "    make dev            Build images and deploy to local k8s (dev overlay)"
	@echo "    make build          Build frontend and backend binaries"
	@echo "    make test           Run all tests"
	@echo "    make lint           Lint all code"
	@echo ""
	@echo "  $(BOLD)Docker Compose (postgres-only helper)$(RESET)"
	@echo "    make compose-up     Build and start all services"
	@echo "    make compose-down   Stop and remove containers"
	@echo "    make compose-logs   Tail all service logs"
	@echo ""
	@echo "  $(BOLD)Kubernetes — dev$(RESET)"
	@echo "    make k8s-dev-up     Build images, import into k3s, apply dev overlay"
	@echo "    make k8s-dev-down   Delete all kumbi resources from cluster"
	@echo "    make k8s-dev-seed   Run seed-admin job"
	@echo "    make k8s-status     Show pods, services, ingress"
	@echo ""
	@echo "  $(BOLD)Kubernetes — test$(RESET)"
	@echo "    make k8s-test-up    Build images, import into k3s, apply test overlay"
	@echo "    make k8s-test-down  Delete kumbi-test namespace"
	@echo ""
	@echo "  $(BOLD)Kubernetes — staging$(RESET)"
	@echo "    make k8s-staging-build  Build and push staging images"
	@echo "    make k8s-staging-apply  Apply staging overlay"
	@echo ""
	@echo "  $(BOLD)Kubernetes — prod$(RESET)"
	@echo "    make k8s-prod-build Push images to registry"
	@echo "    make k8s-prod-apply Apply prod overlay"
	@echo "    make k8s-prod-rollout Restart deployments"
	@echo "    make k8s-prod-seed  Run seed-admin job"
	@echo "    make k8s-prod-deploy Full prod deploy (build + apply + rollout + seed)"
	@echo "    make k8s-teardown   Delete kumbi namespace (destructive)"
	@echo ""
	@echo "  $(BOLD)User management$(RESET)"
	@echo "    make seed           Seed/reset admin user"
	@echo "    make create-user NAME=.. EMAIL=.. PASS=.. ROLE=.."
	@echo ""
	@echo "  Variables: REGISTRY=$(REGISTRY)  TAG=$(TAG)  KUBECTL=$(KUBECTL)"
	@echo ""

# ── Dependencies ──────────────────────────────────────────────────────────────
.PHONY: setup
setup:
	$(call log,Installing frontend dependencies...)
	cd frontend && bun install
	$(call log,Downloading backend modules...)
	cd backend && go mod download

# ── dev = k8s dev (identical infra to all environments) ───────────────────────
.PHONY: dev
dev: k8s-dev-up

.PHONY: build
build:
	$(call log,Building frontend...)
	cd frontend && bun run build
	$(call log,Building backend...)
	cd backend && CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/server ./cmd/server
	$(call log,Build complete)

.PHONY: test
test:
	$(call log,Testing backend...)
	cd backend && go test ./... -v
	$(call log,Testing frontend...)
	cd frontend && bun run test

.PHONY: lint
lint:
	$(call log,Linting backend...)
	cd backend && go vet ./...
	$(call log,Linting frontend...)
	cd frontend && bun run lint

# ── Docker Compose (postgres-only helper for local tooling) ───────────────────
.PHONY: compose-up
compose-up:
	docker compose up --build -d

.PHONY: compose-down
compose-down:
	docker compose down

