# Kumbi — The People's Baraza
# Usage: make <command> [ENV=dev|test|staging|prod] [CONTAINER=backend|frontend|postgres|all]
# Run `make help` for a full list of commands.
#
# Platform-agnostic: targets a k3s cluster (rootless/privileged), and runs
# alongside other clusters on the same host. Builds via nerdctl, docker,
# podman, or buildah. TLS handled entirely in-cluster (mkcert for dev/test,
# cert-manager/Let's Encrypt for staging/prod).
#
# The cluster is named kumbi-$ENV (kumbi-dev / kumbi-test / kumbi-staging
# / kumbi-prod), so it can coexist with other clusters on the host.

SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

# ══════════════════════════════════════════════════════════════════════════════
# Platform Detection
# ══════════════════════════════════════════════════════════════════════════════

# Privileged k3s mode (rootful instead of rootless).
# Set PRIVILEGED=true when k3s is installed with root privileges (systemd).
# Default to privileged for containerized environments.
PRIVILEGED ?= true

# ── Envoy Gateway ────────────────────────────────────────────────────────────────
# Set FRONT_DOOR=true to install Envoy Gateway (used for prod GCP Load Balancer).
# Set FRONT_DOOR=false to install ingress-nginx (dev/test clusters).
FRONT_DOOR ?= false

# ── kubectl ───────────────────────────────────────────────────────────────────
# Try: kubectl → k3s kubectl. Override via KUBECTL= env.
KUBECTL := $(shell \
  if [ "$(PRIVILEGED)" = "true" ]; then \
    if command -v kubectl >/dev/null 2>&1 && sudo kubectl cluster-info >/dev/null 2>&1; then echo "sudo kubectl"; \
    elif command -v k3s >/dev/null 2>&1 && sudo k3s kubectl cluster-info >/dev/null 2>&1; then echo "sudo k3s kubectl"; \
    elif command -v kubectl >/dev/null 2>&1; then echo kubectl; \
    elif command -v k3s >/dev/null 2>&1; then echo "sudo k3s kubectl"; \
    else echo kubectl; fi; \
  else \
    if command -v kubectl >/dev/null 2>&1 && kubectl cluster-info >/dev/null 2>&1; then echo kubectl; \
    elif command -v k3s >/dev/null 2>&1 && k3s kubectl cluster-info >/dev/null 2>&1; then echo "k3s kubectl"; \
    elif command -v kubectl >/dev/null 2>&1; then echo kubectl; \
    elif command -v k3s >/dev/null 2>&1; then echo "k3s kubectl"; \
    else echo kubectl; fi; \
  fi)

# ── Build tool ────────────────────────────────────────────────────────────────
# Try: nerdctl → docker → podman → buildah. Override via BUILD_TOOL= env.
BUILD_TOOL := $(shell \
  if command -v nerdctl >/dev/null 2>&1; then echo nerdctl; \
  elif command -v docker >/dev/null 2>&1; then echo docker; \
  elif command -v podman >/dev/null 2>&1; then echo podman; \
  elif command -v buildah >/dev/null 2>&1; then echo buildah; \
  else echo docker; fi)

# ── Containerd socket (for direct build into k3s containerd) ───────────────
CONTAINERD_SOCK := $(shell \
  if [ "$(PRIVILEGED)" = "true" ]; then \
    for sock in \
      /run/k3s/containerd/containerd.sock \
      /var/run/k3s/containerd/containerd.sock \
      /var/run/docker/containerd/containerd.sock \
      /run/containerd/containerd.sock; \
    do [ -S "$$sock" ] && echo "$$sock" && break; done 2>/dev/null; \
  else \
    for sock in \
      /run/user/$$(id -u)/k3s/containerd/containerd.sock \
      /run/k3s/containerd/containerd.sock \
      /var/run/k3s/containerd/containerd.sock \
      /run/containerd/containerd.sock; \
    do [ -S "$$sock" ] && echo "$$sock" && break; done 2>/dev/null; \
  fi)

# ── Can we build directly into k3s containerd? ──────────────────────────────
CAN_DIRECT_BUILD := $(shell \
  if [ "$(BUILD_TOOL)" = "nerdctl" ] && [ -n "$(CONTAINERD_SOCK)" ]; then echo yes; \
  else echo no; fi)

# ── Image import command (for non-nerdctl builds into k3s) ──────────────────
_import_cmd = $(shell \
  if command -v k3s >/dev/null 2>&1; then echo "k3s ctr images import -"; \
  else echo "cat >/dev/null"; fi)

_prune_cmd = $(shell \
  if command -v k3s >/dev/null 2>&1; then echo "k3s ctr images rm"; \
  else echo "true"; fi)

# ══════════════════════════════════════════════════════════════════════════════
# Configuration
# ══════════════════════════════════════════════════════════════════════════════

# ENV detection: from environment, from command line, or prompted interactively.
ifeq ($(origin ENV),undefined)
  _NEED_ENV := $(filter-out help,$(MAKECMDGOALS))
  ifneq ($(_NEED_ENV),)
    ENV := $(shell bash -c 'read -p "Environment (dev/test/staging/prod) [dev]: " e; echo $${e:-dev}')
  else
    ENV := dev
  endif
endif

# Validate ENV
ifeq ($(filter $(ENV),dev test staging prod),)
  $(error ENV must be dev, test, staging, or prod — got '$(ENV)')
endif

CONTAINER ?= all

# Validate CONTAINER
ifeq ($(filter $(CONTAINER),backend frontend postgres all),)
  $(error CONTAINER must be backend, frontend, postgres, or all — got '$(CONTAINER)')
endif

IMG ?= all

# ── Per-environment config ────────────────────────────────────────────────────
# Cluster is named kumbi-$ENV so it coexists with other clusters on the host.
CLUSTER   := kumbi-$(ENV)
NAMESPACE := kumbi-$(ENV)
IMG_TAG   := $(ENV)
OVERLAY   := infra/k8s/overlays/$(ENV)
SECRETS   := $(OVERLAY)/secrets.yaml

BACKEND_IMG  := kumbi/backend:$(IMG_TAG)
FRONTEND_IMG := kumbi/frontend:$(IMG_TAG)

# ── Public host base per environment ──────────────────────────────────────────
ENV_DOMAIN_dev     := kumbi.local
ENV_DOMAIN_test    := test.kumbi.local
ENV_DOMAIN_staging := staging.kumbike.org
ENV_DOMAIN_prod    := kumbike.org

# ── Ingress NodePort endpoints (shared scheme across all clusters) ───────────
INGRESS_HTTP_PORT  := 12080
INGRESS_HTTPS_PORT := 12443

# ── Optional: open host firewall for 80/443 (off by default — destructive
# on shared hosts). Set SETUP_FIREWALL=1 to enable. ───────────────────────
SETUP_FIREWALL ?= false

# ── Read operational vars from secrets.yaml (with safe fallbacks) ─────────────
SECRET = $(shell scripts/yaml-get.sh "$(SECRETS)" "$(1)" "$(2)" 2>/dev/null)

ACME_EMAIL = $(or $(call SECRET,kumbi-app-config,ACME_EMAIL),$(call SECRET,backend-secret,ACME_EMAIL),admin@kumbike.org)
API_URL    = $(call SECRET,kumbi-app-config,API_URL)

# ── Infra versions ─────────────────────────────────────────────────────────────
INGRESS_NGINX_VERSION ?= v1.11.1
CERT_MANAGER_VERSION  ?= v1.16.3

INGRESS_NGINX_URL := https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-$(INGRESS_NGINX_VERSION)/deploy/static/provider/bare-metal/deploy.yaml
CERT_MANAGER_URL  := https://github.com/cert-manager/cert-manager/releases/download/$(CERT_MANAGER_VERSION)/cert-manager.yaml

# ── TLS flavor for prod (staging|production) ──────────────────────────────
# make tls ENV=prod FLAVOR=staging    → Let's Encrypt staging
# make tls ENV=prod FLAVOR=production → Let's Encrypt production
# Defaults to staging.
FLAVOR ?= staging

LOGS_DIR  := logs
TS        := $(shell date +%Y%m%d-%H%M%S)

logfile = $(LOGS_DIR)/$(1)-$(ENV)-$(TS).log
errfile = $(LOGS_DIR)/$(1)-$(ENV)-$(TS).err
tee     = 2> >(tee $(call errfile,$(1)) >&2) | tee $(call logfile,$(1))

BOLD  := \033[1m
RESET := \033[0m
RED   := \033[1;31m
GOLD  := \033[1;33m
AZURE := \033[1;34m
INFO  := $(AZURE)[kumbi]$(RESET)
WARN  := $(GOLD)[!]$(RESET)
ERR   := $(RED)[error]$(RESET)

log = echo -e "$(INFO) $(1)"

define _with_log
  mkdir -p $(LOGS_DIR) && { $(2) $(call tee,$(1)); }
endef

NOCACHE ?= false
NOCACHE_FLAG := $(if $(filter true,$(NOCACHE)),--no-cache,)

# Build an image — handles nerdctl (direct into k3s), docker, podman, buildah
# Usage: $(call build-image,tag,context_dir,extra_args)
define build-image
	@echo "$(INFO) Building $(1) with $(BUILD_TOOL)..."
	@if [ "$(CAN_DIRECT_BUILD)" = "yes" ]; then \
		$(BUILD_TOOL) --address "$(CONTAINERD_SOCK)" --namespace k8s.io build $(NOCACHE_FLAG) -t $(1) $(3) $(2); \
	elif [ "$(BUILD_TOOL)" = "buildah" ]; then \
		$(BUILD_TOOL) bud $(NOCACHE_FLAG) -t $(1) $(3) $(2); \
	else \
		$(BUILD_TOOL) build $(NOCACHE_FLAG) -t $(1) $(3) $(2) && \
		echo "$(INFO) Importing $(1) into k3s containerd..." && \
		($(BUILD_TOOL) save $(1) | ($(_import_cmd)) 2>/dev/null) || \
		(echo "$(WARN) Import failed — pruning old image and retrying..." && \
		 $(_prune_cmd) $(1) 2>/dev/null; \
		 $(BUILD_TOOL) save $(1) | ($(_import_cmd)) 2>/dev/null) || \
		echo "$(WARN) Could not import into k3s containerd — confirm k3s is running"; \
	fi
endef

export

# ══════════════════════════════════════════════════════════════════════════════
# Help
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: help
help:
	@echo ""
	@echo "  $(BOLD)Kumbi — The People's Baraza$(RESET)"
	@echo ""
	@echo "  $(BOLD)Detected$(RESET)"
	@echo "    kubectl:   $(KUBECTL)"
	@echo "    build:     $(BUILD_TOOL)"
	@echo "    containerd: $(or $(CONTAINERD_SOCK),<not found>)"
	@echo "    direct build: $(CAN_DIRECT_BUILD)"
	@echo "    privileged: $(PRIVILEGED)"
	@echo ""
	@echo "  $(BOLD)Usage$(RESET)"
	@echo "    make <command> [ENV=dev|test|staging|prod] [CONTAINER=backend|frontend|postgres|all]"
	@echo "    default: ENV=dev CONTAINER=all"
	@echo ""
	@echo "  $(BOLD)Core (build + deploy)$(RESET)"
	@echo "    make deploy   ENV=..   Build → provision → apply → wait (end-to-end)"
	@echo "    make build    ENV=..   Build images (all/backend/frontend)"
	@echo "    make refresh  ENV=..   Rebuild + rollout + wait"
	@echo "    make [build|deploy|refresh] NOCACHE=true  No cached layers"
	@echo ""
	@echo "  $(BOLD)Cluster Provisioning (k3s)$(RESET)"
	@echo "    make cluster-create  ENV=..   Create k3s cluster 'kumbi-$ENV'"
	@echo "    make cluster-delete  ENV=..   Delete k3s cluster"
	@echo "    make cluster-ensure  ENV=..   Create if missing (idempotent)"
	@echo "    make deploy ENV=.. SETUP_FIREWALL=1  Also open host 80/443"
	@echo ""
	@echo "  $(BOLD)TLS / Certificates$(RESET)"
	@echo "    make tls ENV=dev|test            mkcert (local)"
	@echo "    make tls ENV=staging             Let's Encrypt staging"
	@echo "    make tls ENV=prod FLAVOR=staging     Let's Encrypt staging"
	@echo "    make tls ENV=prod FLAVOR=production  Let's Encrypt production"
	@echo "    make tls-check ENV=..            Show certificate issuance status"
	@echo ""
	@echo "  $(BOLD)Management$(RESET)"
	@echo "    make rollout  ENV=.. [CONTAINER=..]  Selective restart"
	@echo "    make status   ENV=..   Cluster + pod status"
	@echo "    make logs     ENV=.. [CONTAINER=..]  Follow pod logs"
	@echo "    make migrate  ENV=..   Re-run DB migrations"
	@echo "    make seed     ENV=..   Seed/reset admin user"
	@echo "    make teardown ENV=..   Delete namespace (prompts)"
	@echo ""
	@echo "  $(BOLD)Other$(RESET)"
	@echo "    make setup     Install frontend/backend dependencies"
	@echo "    make test      Run tests"
	@echo "    make lint      Run linters"
	@echo "    make check-config   Validate secrets.yaml + generate DATABASE_URL"
	@echo "    make sync [HOST=] [DEST=]   rsync code to remote (respects .gitignore)"
	@echo ""
	@echo "  Current ENV=$(ENV)  CONTAINER=$(CONTAINER)  CLUSTER=$(CLUSTER)"
	@echo ""

# ══════════════════════════════════════════════════════════════════════════════
# Setup / Dependencies
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: setup
setup:
	@$(call log,Installing frontend dependencies...)
	cd frontend && bun install
	@$(call log,Downloading backend modules...)
	cd backend && go mod download

.PHONY: test
test:
	cd backend && go test ./... -v
	cd frontend && bun run test

.PHONY: lint
lint:
	cd backend && go vet ./...
	cd frontend && bun run lint

# ══════════════════════════════════════════════════════════════════════════════
# Secrets / Config
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: check-config _secrets-check

check-config: _secrets-check generate-secrets
	@mkdir -p $(LOGS_DIR) && { scripts/check-config.sh "$(SECRETS)" "$(ENV)" "$(OVERLAY)" $(call tee,check-config); }

_secrets-check:
	@[[ -f "$(SECRETS)" ]] || { \
	  echo -e "$(ERR) Missing $(SECRETS)"; \
	  echo "  cp $(SECRETS).example $(SECRETS)"; \
	  exit 1; }
	@grep -q "CHANGE_ME" "$(SECRETS)" && { \
	  echo -e "$(ERR) $(SECRETS) still has CHANGE_ME values"; exit 1; } || true

.PHONY: generate-secrets
generate-secrets:
	@scripts/generate-secrets.sh "$(SECRETS)"

# ══════════════════════════════════════════════════════════════════════════════
# Tooling / pre-flight checks
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: ensure-tools
ensure-tools:
	@bash scripts/ensure-tools.sh $(if $(filter tls,$(MAKECMDGOALS)),--tls,) $(if $(filter --yes,$(MAKECMDGOALS)),--yes,)

# ══════════════════════════════════════════════════════════════════════════════
# kubectl context check
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: _ensure-context
_ensure-context:
	@if ! $(KUBECTL) cluster-info >/dev/null 2>&1; then \
	  echo -e "$(ERR) Cannot connect to k8s cluster '$(CLUSTER)'."; \
	  echo "  Detected kubectl: $(KUBECTL)"; \
	  echo "  Run: make cluster-create ENV=$(ENV)"; \
	  exit 1; \
	fi

# ══════════════════════════════════════════════════════════════════════════════
# Dependency checks
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: _ensure-envsubst
_ensure-envsubst:
	@if ! command -v envsubst >/dev/null 2>&1; then \
	  echo "$(INFO) envsubst not found — attempting install..."; \
	  if command -v brew >/dev/null 2>&1; then brew install gettext; \
	  elif command -v apt-get >/dev/null 2>&1; then \
	    echo "$(ERR) envsubst (gettext) not found. Run: sudo apt-get install -y gettext"; exit 1; \
	  else \
	    echo -e "$(ERR) envsubst (gettext) not found."; exit 1; \
	  fi; \
	fi

# ══════════════════════════════════════════════════════════════════════════════
# k3s cluster lifecycle
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: cluster-create cluster-delete cluster-ensure _cluster-exists _check-ports

_cluster-exists:
	@$(KUBECTL) cluster-info >/dev/null 2>&1

# Verify the shared ingress NodePorts (30101/30100) are free on the host
# so this cluster can coexist with other clusters' ingress controllers.
_check-ports:
	@echo "$(INFO) Checking host ports for ingress NodePorts (http:$(INGRESS_HTTP_PORT) https:$(INGRESS_HTTPS_PORT))..."
	@busy=0; \
	for p in $(INGRESS_HTTP_PORT) $(INGRESS_HTTPS_PORT); do \
	  if command -v ss >/dev/null 2>&1; then \
	    ss -tuln 2>/dev/null | grep -q ":$$p " && { echo "$(WARN) Port $$p already in use on the host."; busy=1; }; \
	  elif command -v lsof >/dev/null 2>&1; then \
	    lsof -iTCP:$$p -sTCP:LISTEN >/dev/null 2>&1 && { echo "$(WARN) Port $$p already in use on the host."; busy=1; }; \
	  fi; \
	done; \
	if [ "$$busy" = "1" ]; then \
	  echo "$(ERR) Required ports are occupied. Free them or change INGRESS_HTTP_PORT/INGRESS_HTTPS_PORT."; \
	  echo "$(ERR) Other k3s clusters may already claim these NodePorts."; \
	  exit 1; \
	fi; \
	echo "$(INFO) Ports $(INGRESS_HTTP_PORT)/$(INGRESS_HTTPS_PORT) are available."

cluster-create: ensure-tools _check-ports
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Creating k3s cluster '$(CLUSTER)' (ENV=$(ENV))..."; \
	  if [ "$(PRIVILEGED)" = "true" ]; then \
	    sudo k3s server --cluster-init --disable traefik \
	      --kube-proxy-arg conntrack-max-per-core=0 \
	      --write-kubeconfig-mode 644 \
	      --write-kubeconfig ~/.kube/config 2>&1 | tee $(call logfile,cluster-create) & \
	    echo "$(INFO) Waiting for k3s (privileged) to come up..."; \
	    for i in $$(seq 1 30); do sudo k3s kubectl cluster-info >/dev/null 2>&1 && break; sleep 2; done; \
	  else \
	    k3s server --cluster-init --disable traefik \
	      --kube-proxy-arg conntrack-max-per-core=0 \
	      --kubelet-arg feature-gates=KubeletInUserNamespace=true \
	      --write-kubeconfig-mode 644 \
	      --write-kubeconfig ~/.kube/config 2>&1 | tee $(call logfile,cluster-create) & \
	    echo "$(INFO) Waiting for k3s (rootless) to come up..."; \
	    for i in $$(seq 1 30); do k3s kubectl cluster-info >/dev/null 2>&1 && break; sleep 2; done; \
	  fi; \
	  echo "$(INFO) Cluster ready — context: $(CLUSTER) (kubeconfig: ~/.kube/config)"; \
	} $(call tee,cluster-create)

cluster-ensure: ensure-tools _ensure-context
	@true

cluster-delete: ensure-tools
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Deleting k3s cluster '$(CLUSTER)'..."; \
	  if [ "$(PRIVILEGED)" = "true" ]; then \
	    sudo k3s-uninstall.sh 2>/dev/null || true; \
	  else \
	    /usr/local/bin/k3s-killall.sh 2>/dev/null || k3s server --disable traefik >/dev/null 2>&1 || true; \
	    pkill -f "k3s server" 2>/dev/null || true; \
	  fi; \
	  echo "$(INFO) Cluster '$(CLUSTER)' stopped."; \
	} 2>&1 | tee $(call logfile,cluster-delete)

# ══════════════════════════════════════════════════════════════════════════════
# Ingress controller (bare-metal / NodePort)
# ══════════════════════════════════════════════════════════════════════════════

# ── Ingress controller (Envoy Gateway for prod, ingress-nginx for dev/test)
# ══════════════════════════════════════════════════════════════════════════════

.PHOONY: _ensure-ingress _ensure-hostroute

_ensure-ingress: _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  if [ "$(FRONT_DOOR)" = "true" ]; then \
	    echo "$(INFO) Ensuring Envoy Gateway (bare-metal)..."; \
	    if ! $(KUBECTL) get ns envoy-system >/dev/null 2>&1; then \
	      echo "$(INFO) Installing Envoy Gateway..."; \
	      $(KUBECTL) apply -f https://github.com/envoyproxy/gateway/releases/download/v1.2.0/gateway-v1.2.0.yaml; \
	      $(KUBECTL) wait --for=condition=ready pod -l app=gateway -n envoy-system --timeout=120s; \
	      echo "$(INFO) Envoy Gateway installed"; \
	    else \
	      echo "$(INFO) Envoy Gateway already installed"; \
	    fi; \
	  else \
	    echo "$(INFO) Ensuring nginx ingress controller (bare-metal)..."; \
	    if ! $(KUBECTL) get ns ingress-nginx >/dev/null 2>&1; then \
	      echo "$(INFO) Installing ingress-nginx $(INGRESS_NGINX_VERSION)..."; \
	      $(KUBECTL) apply -f $(INGRESS_NGINX_URL); \
	      $(KUBECTL) wait --for=condition=ready pod -l app.kubernetes.io/component=controller -n ingress-nginx --timeout=120s; \
	      echo "$(INFO) nginx ingress controller installed"; \
	    else \
	      echo "$(INFO) nginx ingress controller already installed"; \
	    fi; \
	  fi; \
	} $(call tee,ensure-ingress)

# Detect whether host nginx is the public front door, or k3s LoadBalancer.
# Installs nginx if missing, wires the kumbi endpoints (http:30101 /
# https:30100), and optionally opens the host firewall (SETUP_FIREWALL=1).
_ensure-hostroute: _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  if [ "$(FRONT_DOOR)" = "true" ]; then \
	    echo "$(INFO) No host nginx needed — using Envoy Gateway (ClusterIP)."; \
	  else \
	    export INGRESS_HTTP_NODEPORT=$(INGRESS_HTTP_PORT); \
	    export INGRESS_HTTPS_NODEPORT=$(INGRESS_HTTPS_PORT); \
	    if ! command -v nginx >/dev/null 2>&1; then \
	      echo "$(INFO) nginx not found — installing..."; \
	      if command -v apt-get >/dev/null 2>&1; then \
	        sudo apt-get update -y >/dev/null 2>&1 && sudo apt-get install -y nginx >/dev/null 2>&1; \
	      elif command -v dnf >/dev/null 2>&1; then sudo dnf install -y nginx >/dev/null 2>&1; \
	      elif command -v yum >/dev/null 2>&1; then sudo yum install -y nginx >/dev/null 2>&1; \
	      elif command -v brew >/dev/null 2>&1; then brew install nginx >/dev/null 2>&1; \
	      else echo "$(WARN) No supported package manager — install nginx manually."; fi; \
	      if command -v nginx >/dev/null 2>&1; then sudo systemctl enable --now nginx >/dev/null 2>&1 || true; fi; \
	    fi; \
	    if command -v nginx >/dev/null 2>&1 && systemctl is-active --quiet nginx 2>/dev/null; then \
	      echo "$(INFO) Host nginx detected — adding stream routing for $(INGRESS_HTTP_PORT)/$(INGRESS_HTTPS_PORT)..."; \
	      sudo mkdir -p /etc/nginx/conf.d; \
	      sudo envsubst < infra/host/nginx-stream.conf | sudo tee /etc/nginx/conf.d/kumbi-$(ENV).conf >/dev/null; \
	      if sudo nginx -t >/dev/null 2>&1; then \
	        sudo systemctl reload nginx 2>/dev/null || true; \
	        echo "$(INFO) Host nginx reloaded with kumbi-$(ENV).conf"; \
	      else \
	        echo "$(WARN) nginx -t failed — review /etc/nginx/conf.d/kumbi-$(ENV).conf"; \
	      fi; \
	    else \
	      echo "$(INFO) No host nginx — relying on k3s LoadBalancer (ingress-nginx NodePort $(INGRESS_HTTP_PORT)/$(INGRESS_HTTPS_PORT))."; \
	    fi; \
	    if [ "$(SETUP_FIREWALL)" = "true" ]; then \
	      echo "$(INFO) Opening host firewall for 80/443..."; \
	      if command -v ufw >/dev/null 2>&1; then \
	        sudo ufw allow 80/tcp >/dev/null 2>&1; sudo ufw allow 443/tcp >/dev/null 2>&1; \
	        echo "$(INFO) ufw: allowed 80/tcp, 443/tcp"; \
	      elif command -v firewall-cmd >/dev/null 2>&1; then \
	        sudo firewall-cmd --permanent --add-port=80/tcp >/dev/null 2>&1; \
	        sudo firewall-cmd --permanent --add-port=443/tcp >/dev/null 2>&1; \
	        sudo firewall-cmd --reload >/dev/null 2>&1; \
	        echo "$(INFO) firewalld: allowed 80/tcp, 443/tcp"; \
	      elif command -v iptables >/dev/null 2>&1; then \
	        sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT >/dev/null 2>&1; \
	        sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT >/dev/null 2>&1; \
	        echo "$(INFO) iptables: allowed 80/tcp, 443/tcp (not persisted — save rules separately)"; \
	      else \
	        echo "$(WARN) No supported firewall tool — open 80/443 manually."; \
	      fi; \
	    else \
	      echo "$(INFO) Firewall unchanged (SETUP_FIREWALL!=true). Ensure 80/443 are open to the Internet."; \
	    fi; \
	  fi; \
	} $(call tee,ensure-hostroute)

# ══════════════════════════════════════════════════════════════════════════════
# Persistent storage
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: _ensure-pvs _ensure-pstorage

# Create host directories for persistent data + certificates (pre-check for deploy).
_ensure-pstorage: _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Creating persistent storage directories for $(ENV)..."; \
	  bash scripts/setup-persistent-storage.sh "$(ENV)"; \
	} $(call tee,ensure-pstorage)

# Apply PVCs. Certs PVC is created read-only-protected so `make deploy`
# can never overwrite the issued certificate.
_ensure-pvs: _ensure-context _ensure-envsubst _ensure-pstorage
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Applying PersistentVolumeClaims from template..."; \
	  export POSTGRES_DATA_DIR=$$(scripts/yaml-get.sh "$(SECRETS)" "kumbi-app-config" "POSTGRES_DATA_DIR" 2>/dev/null); \
	  export STORAGE_DATA_DIR=$$(scripts/yaml-get.sh "$(SECRETS)" "kumbi-app-config" "STORAGE_DATA_DIR" 2>/dev/null); \
	  export CERT_DATA_DIR=$$(scripts/yaml-get.sh "$(SECRETS)" "kumbi-app-config" "CERT_DATA_DIR" 2>/dev/null); \
	  node_base=/var/lib/kumbi/$(ENV); \
	  POSTGRES_DATA_DIR=$${POSTGRES_DATA_DIR:-$$node_base/postgres-data}; \
	  STORAGE_DATA_DIR=$${STORAGE_DATA_DIR:-$$node_base/storage}; \
	  CERT_DATA_DIR=$${CERT_DATA_DIR:-$$node_base/certs}; \
	  echo "$(INFO)   POSTGRES_DATA_DIR=$$POSTGRES_DATA_DIR"; \
	  echo "$(INFO)   STORAGE_DATA_DIR=$$STORAGE_DATA_DIR"; \
	  echo "$(INFO)   CERT_DATA_DIR=$$CERT_DATA_DIR (certificates persist here)"; \
	  envsubst < infra/k8s/base/persistent-volumes.yaml.tpl | $(KUBECTL) apply -f - 2>/tmp/.pvs-apply-err; \
	  if [ $$? -ne 0 ]; then echo "$(WARN) PV apply failed: $$(cat /tmp/.pvs-apply-err)"; \
	  else echo "$(INFO) PersistentVolumes applied"; fi; \
	} $(call tee,ensure-pvs)

# ══════════════════════════════════════════════════════════════════════════════
# TLS / Cert-Manager
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: tls install-cert-manager _ensure-issuers tls-check

install-cert-manager:
	@mkdir -p $(LOGS_DIR) && { \
	  if $(KUBECTL) get ns cert-manager >/dev/null 2>&1; then \
	    echo "$(INFO) cert-manager already installed"; \
	  else \
	    echo "$(INFO) Installing cert-manager $(CERT_MANAGER_VERSION)..."; \
	    $(KUBECTL) apply -f $(CERT_MANAGER_URL); \
	    echo "$(INFO) Waiting for cert-manager pods (up to 180s)..."; \
	    $(KUBECTL) -n cert-manager wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager --timeout=180s 2>/dev/null || \
	      $(KUBECTL) -n cert-manager wait --for=condition=ready pod -l app.kubernetes.io/component=controller --timeout=180s; \
	    echo "$(INFO) cert-manager installed"; \
	  fi; \
	} $(call tee,install-cert-manager)

_ensure-issuers: _ensure-context _ensure-envsubst install-cert-manager
	@mkdir -p $(LOGS_DIR) && { \
	  export ACME_EMAIL=$(ACME_EMAIL); \
	  echo "$(INFO) Applying ClusterIssuers (selfsigned + staging + prod)..."; \
	  for i in 1 2 3 4 5 6 7 8 9 10; do \
	    if envsubst < infra/k8s/tls/cluster-issuer.yaml | $(KUBECTL) apply -f - 2>/tmp/.issuer-apply-err; then \
	      rm -f /tmp/.issuer-apply-err; break; \
	    fi; \
	    err=$$(cat /tmp/.issuer-apply-err); \
	    if echo "$$err" | grep -q "no endpoints available for service.*cert-manager-webhook\|connection refused"; then \
	      echo "$(WARN) cert-manager webhook not ready, retrying in 10s (attempt $$i/10)..."; sleep 10; \
	    else echo "$$err" >&2; rm -f /tmp/.issuer-apply-err; exit 1; fi; \
	  done; \
	  echo "$(INFO) ClusterIssuers ready"; \
	} $(call tee,ensure-issuers)

# Certificate status check (staging / production especially).
tls-check: _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  case "$(ENV)" in \
	    dev|test) \
	      echo "$(INFO) $(ENV) uses mkcert (locally managed). Checking secret kumbi-tls..."; \
	      bash scripts/check-tls.sh "$(NAMESPACE)" kumbi-tls ;; \
	    staging|prod) \
	      echo "$(INFO) $(ENV) uses cert-manager. Checking kumbi-tls-cert..."; \
	      bash scripts/check-tls.sh "$(NAMESPACE)" kumbi-tls-cert kumbi-tls-cert ;; \
	  esac; \
 	} $(call tee,tls-check)

.PHONY: tls certs
tls: _ensure-context _ensure-envsubst ensure-tools
	@mkdir -p $(LOGS_DIR) && { \
	  cert_secret=$$( [ "$(ENV)" = "dev" ] || [ "$(ENV)" = "test" ] && echo kumbi-tls || echo kumbi-tls-cert ); \
	  if $(KUBECTL) get secret $$cert_secret -n $(NAMESPACE) >/dev/null 2>&1; then \
	    echo "$(WARN) Secret $$cert_secret already exists in $(NAMESPACE) — NOT overwriting."; \
	    echo "$(WARN) Delete it first (or run 'make tls-check') to re-issue."; \
	    echo "$(INFO) Applying ingress-nginx ConfigMap..."; \
	    $(KUBECTL) apply -f infra/k8s/ingress-nginx-configmap.yaml 2>/dev/null || true; \
	    exit 0; \
	  fi; \
	  echo "$(INFO) Provisioning TLS certificate for $(ENV)..."; \
	  case "$(ENV)" in \
	    dev|test) \
	      echo "$(INFO) Using mkcert for local $(ENV) certificate..."; \
	      scripts/generate-mkcert.sh "$(ENV)" "$(NAMESPACE)"; \
	      ;; \
	    staging) \
	      echo "$(INFO) Ensuring cert-manager + issuers for ACME (staging)..."; \
	      $(MAKE) install-cert-manager _ensure-issuers ENV=$(ENV); \
	      echo "$(INFO) Creating Certificate resource for staging..."; \
	      envsubst < infra/k8s/tls/certificate-$(ENV).yaml.tpl | $(KUBECTL) apply -f -; \
	      echo "$(INFO) Waiting for Let's Encrypt (staging) certificate..."; \
	      $(KUBECTL) wait --for=condition=Ready certificate/kumbi-tls-cert -n $(NAMESPACE) --timeout=300s; \
	      ;; \
	    prod) \
	      ISSUER=letsencrypt-$(FLAVOR); \
	      echo "$(INFO) Using Let's Encrypt issuer: $$ISSUER ($(FLAVOR))"; \
	      $(MAKE) install-cert-manager _ensure-issuers ENV=$(ENV); \
	      echo "$(INFO) Creating Certificate resource for prod ($$ISSUER)..."; \
	      FLAVOR=$(FLAVOR) envsubst < infra/k8s/tls/certificate-prod.yaml.tpl | $(KUBECTL) apply -f -; \
	      echo "$(INFO) Waiting for Let's Encrypt ($(FLAVOR)) certificate..."; \
	      $(KUBECTL) wait --for=condition=Ready certificate/kumbi-tls-cert -n $(NAMESPACE) --timeout=300s; \
	      ;; \
	    *) \
	      echo "$(WARN) Unknown environment: $(ENV). Skipping TLS provisioning."; exit 1 ;; \
	  esac; \
	  echo "$(INFO) Applying ingress-nginx ConfigMap..."; \
	  $(KUBECTL) apply -f infra/k8s/ingress-nginx-configmap.yaml 2>/dev/null || true; \
	  echo "$(INFO) TLS provisioning complete for $(ENV)."; \
	} $(call tee,tls)

.PHONY: certs
certs: tls
	@true

# ══════════════════════════════════════════════════════════════════════════════
# Build
# ══════════════════════════════════════════════════════════════════════════════

_build-backend:
	@$(call build-image,$(BACKEND_IMG),./backend,)

_build-frontend:
	@API=$$( [ -n "$(API_URL)" ] && echo "--build-arg VITE_API_BASE_URL=$(API_URL)" || echo "" ); \
	$(call build-image,$(FRONTEND_IMG),./frontend,$$API)

.PHONY: build
build:
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Building images for ENV=$(ENV) IMG=$(IMG)..."; \
	  echo "$(INFO) Build tool: $(BUILD_TOOL) | Direct build: $(CAN_DIRECT_BUILD)"; \
	  case "$(IMG)" in \
	    all) $(MAKE) _build-backend _build-frontend IMG=all NOCACHE=$(NOCACHE) ;; \
	    backend) $(MAKE) _build-backend IMG=backend NOCACHE=$(NOCACHE) ;; \
	    frontend) $(MAKE) _build-frontend IMG=frontend NOCACHE=$(NOCACHE) ;; \
	    *) echo "$(WARN) Unknown IMG=$(IMG). Use: all, backend, frontend"; exit 1 ;; \
	  esac; \
	} $(call tee,build)

# ══════════════════════════════════════════════════════════════════════════════
# Deploy — provision → build → apply kustomize → wait
# ══════════════════════════════════════════════════════════════════════════════

PRESERVE ?= false

.PHONY: deploy
deploy: check-config ensure-tools _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Deploying ENV=$(ENV) PRESERVE=$(PRESERVE)..."; \
	  if [ "$(PRESERVE)" != "true" ]; then \
	    $(MAKE) _ensure-pstorage ENV=$(ENV); \
	    $(MAKE) _ensure-ingress ENV=$(ENV); \
	    $(MAKE) _ensure-hostroute ENV=$(ENV); \
	    $(MAKE) _ensure-pvs ENV=$(ENV); \
	    $(MAKE) tls ENV=$(ENV) || echo "$(WARN) TLS provisioning skipped/failed — run 'make tls ENV=$(ENV)' after deploy"; \
	  else \
	    echo "$(INFO) PRESERVE=true — skipping provisioning"; \
	  fi; \
	  $(MAKE) build ENV=$(ENV); \
	  echo "$(INFO) Ensuring namespace $(NAMESPACE)..."; \
	  $(KUBECTL) create namespace $(NAMESPACE) --dry-run=client -o yaml | $(KUBECTL) apply -f - >/dev/null 2>&1; \
	  echo "$(INFO) Applying kustomize overlay..."; \
	  $(KUBECTL) apply -k $(OVERLAY); \
	  echo "$(INFO) Rolling out new images..."; \
	  $(KUBECTL) rollout restart deployment/backend -n $(NAMESPACE) 2>/dev/null; \
	  $(KUBECTL) rollout restart deployment/frontend -n $(NAMESPACE) 2>/dev/null; \
	  echo "$(INFO) Waiting for Database..."; \
	  $(KUBECTL) wait --for=condition=ready pod -l app=postgres -n $(NAMESPACE) --timeout=120s 2>/dev/null; \
	  echo "$(INFO) Waiting for Backend..."; \
	  $(KUBECTL) rollout status deployment/backend -n $(NAMESPACE) --timeout=180s 2>/dev/null; \
	  $(KUBECTL) wait --for=condition=ready pod -l app=backend -n $(NAMESPACE) --timeout=60s 2>/dev/null; \
	  echo "$(INFO) Waiting for Frontend..."; \
	  $(KUBECTL) rollout status deployment/frontend -n $(NAMESPACE) --timeout=180s 2>/dev/null; \
	  $(KUBECTL) wait --for=condition=ready pod -l app=frontend -n $(NAMESPACE) --timeout=60s 2>/dev/null; \
	  echo "$(INFO) Seeding admin user..."; \
	  $(KUBECTL) delete job seed-admin -n $(NAMESPACE) --ignore-not-found 2>/dev/null || true; \
	  $(KUBECTL) kustomize $(OVERLAY) | awk '/^---/{p=0} /kind: Job/{p=1} p' | $(KUBECTL) apply -f -; \
	  echo "$(INFO) Deploy complete — ENV=$(ENV)."; \
	  $(MAKE) status ENV=$(ENV); \
	} $(call tee,deploy)

# ══════════════════════════════════════════════════════════════════════════════
# Refresh — rebuild → apply kustomize (no waiting)
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: refresh
refresh: check-config _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Refreshing ENV=$(ENV) IMG=$(IMG)..."; \
	  $(MAKE) build ENV=$(ENV) IMG=$(IMG) NOCACHE=$(NOCACHE); \
	  echo "$(INFO) Ensuring namespace $(NAMESPACE)..."; \
	  $(KUBECTL) create namespace $(NAMESPACE) --dry-run=client -o yaml | $(KUBECTL) apply -f - >/dev/null 2>&1; \
	  echo "$(INFO) Applying kustomize overlay..."; \
	  $(KUBECTL) apply -k $(OVERLAY); \
	  echo "$(INFO) Rolling out for IMG=$(IMG)..."; \
	  case "$(IMG)" in \
	    all|backend) $(KUBECTL) rollout restart deployment/backend -n $(NAMESPACE) 2>/dev/null; $(MAKE) _wait-backend ;; \
	  esac; \
	  case "$(IMG)" in \
	    all|frontend) $(KUBECTL) rollout restart deployment/frontend -n $(NAMESPACE) 2>/dev/null; $(MAKE) _wait-frontend ;; \
	  esac; \
	  echo "$(INFO) Refresh complete — ENV=$(ENV) IMG=$(IMG)."; \
	} $(call tee,refresh)

_wait-backend:
	@$(KUBECTL) rollout status deployment/backend -n $(NAMESPACE) --timeout=120s

_wait-frontend:
	@$(KUBECTL) rollout status deployment/frontend -n $(NAMESPACE) --timeout=120s

# ══════════════════════════════════════════════════════════════════════════════
# Granular deploy targets
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: deploy-backend deploy-frontend deploy-postgres

deploy-backend: check-config _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Deploying backend for ENV=$(ENV)..."; \
	  $(KUBECTL) rollout restart deployment/backend -n $(NAMESPACE); \
	  $(KUBECTL) rollout status deployment/backend -n $(NAMESPACE) --timeout=180s; \
	  echo "$(INFO) Backend deployed"; \
	} 2>&1 | tee $(call logfile,deploy-backend)

deploy-frontend: check-config _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Deploying frontend for ENV=$(ENV)..."; \
	  $(KUBECTL) rollout restart deployment/frontend -n $(NAMESPACE); \
	  $(KUBECTL) rollout status deployment/frontend -n $(NAMESPACE) --timeout=180s; \
	  echo "$(INFO) Frontend deployed"; \
	} 2>&1 | tee $(call logfile,deploy-frontend)

deploy-postgres: check-config _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Deploying postgres for ENV=$(ENV)..."; \
	  $(KUBECTL) rollout restart deployment/postgres -n $(NAMESPACE); \
	  $(KUBECTL) rollout status deployment/postgres -n $(NAMESPACE) --timeout=180s; \
	  echo "$(INFO) Postgres deployed"; \
	} 2>&1 | tee $(call logfile,deploy-postgres)

# ══════════════════════════════════════════════════════════════════════════════
# Retry — restart failing pods and re-run failed seed job
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: retry
retry: check-config _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Retrying failed resources for ENV=$(ENV)..."; \
	  echo "$(INFO) Step 1: Restarting deployments that are not fully available..."; \
	  for dep in backend frontend postgres; do \
	    ready=$$($(KUBECTL) get deployment/$$dep -n $(NAMESPACE) -o jsonpath='{.status.readyReplicas}' 2>/dev/null); \
	    desired=$$($(KUBECTL) get deployment/$$dep -n $(NAMESPACE) -o jsonpath='{.status.replicas}' 2>/dev/null); \
	    if [ "$$ready" != "$$desired" ] 2>/dev/null; then \
	      echo "  → $$dep: $${ready:-0}/$${desired:-0} ready — restarting..."; \
	      $(KUBECTL) rollout restart deployment/$$dep -n $(NAMESPACE) 2>/dev/null || echo "  ⚠️  Could not restart $$dep"; \
	      $(KUBECTL) rollout status deployment/$$dep -n $(NAMESPACE) --timeout=180s || echo "  ⚠️  $$dep still not available"; \
	    else echo "  ✓ $$dep: $${ready:-0}/$${desired:-0} ready"; fi; \
	  done; \
	  echo "$(INFO) Step 2: Re-running any failed seed job..."; \
	  seed_status=$$($(KUBECTL) get job seed-admin -n $(NAMESPACE) -o jsonpath='{.status.conditions[?(@.type=="Failed")].status}' 2>/dev/null); \
	  if [ "$$seed_status" == "True" ]; then \
	    echo "  → seed-admin job failed — restarting..."; \
	    $(KUBECTL) delete job seed-admin -n $(NAMESPACE) --ignore-not-found 2>/dev/null; \
	    $(KUBECTL) kustomize $(OVERLAY) | awk '/^---/{p=0} /kind: Job/{p=1} p' | $(KUBECTL) apply -f - && \
	    $(KUBECTL) wait --for=condition=complete job/seed-admin -n $(NAMESPACE) --timeout=180s && \
	      echo "  ✓ seed-admin completed" || echo "  ⚠️  seed-admin still failing"; \
	  elif [ "$$seed_status" == "" ]; then \
	    echo "  → seed-admin job not found — creating..."; \
	    $(KUBECTL) kustomize $(OVERLAY) | awk '/^---/{p=0} /kind: Job/{p=1} p' | $(KUBECTL) apply -f -; \
	    $(KUBECTL) wait --for=condition=complete job/seed-admin -n $(NAMESPACE) --timeout=180s && \
	      echo "  ✓ seed-admin completed" || echo "  ⚠️  seed-admin still failing"; \
	  else echo "  ✓ seed-admin already complete"; fi; \
	  echo "$(INFO) Step 3: Final status..."; \
	  $(MAKE) status ENV=$(ENV); \
	  echo "$(INFO) Retry complete — ENV=$(ENV)"; \
	} 2>&1 | tee $(call logfile,retry)

# ══════════════════════════════════════════════════════════════════════════════
# Migrate / Seed
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: migrate seed

migrate: check-config _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Running migrations for ENV=$(ENV)..."; \
	  $(KUBECTL) rollout restart deployment/backend -n $(NAMESPACE); \
	  $(KUBECTL) rollout status deployment/backend -n $(NAMESPACE) --timeout=180s; \
	  echo "$(INFO) Migrations complete"; \
	} 2>&1 | tee $(call logfile,migrate)

seed: check-config _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Seeding admin user via k8s job..."; \
	  $(KUBECTL) delete job seed-admin -n $(NAMESPACE) --ignore-not-found 2>/dev/null || true; \
	  $(KUBECTL) kustomize $(OVERLAY) | awk '/^---/{p=0} /kind: Job/{p=1} p' | $(KUBECTL) apply -f -; \
	  $(KUBECTL) wait --for=condition=complete job/seed-admin -n $(NAMESPACE) --timeout=180s; \
	  $(KUBECTL) logs -n $(NAMESPACE) -l job-name=seed-admin; \
	} 2>&1 | tee $(call logfile,seed)

# ══════════════════════════════════════════════════════════════════════════════
# Rollout — selective restart by container name
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: rollout
rollout: _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Rolling out CONTAINER=$(or $(CONTAINER),all) for ENV=$(ENV)..."; \
	  case "$(CONTAINER)" in \
	    backend|postgres|frontend) \
	      res="deployment/$(CONTAINER)"; \
	      echo "$(INFO) Restarting $$res..."; \
	      $(KUBECTL) rollout restart $$res -n $(NAMESPACE) && \
	      $(KUBECTL) rollout status $$res -n $(NAMESPACE) --timeout=180s ;; \
	    all) \
	      for res in deployment/backend deployment/frontend deployment/postgres; do \
	        if $(KUBECTL) get $$res -n $(NAMESPACE) &>/dev/null; then \
	          echo "  → $$res"; \
	          $(KUBECTL) rollout restart $$res -n $(NAMESPACE) 2>/dev/null; \
	          $(KUBECTL) rollout status $$res -n $(NAMESPACE) --timeout=180s 2>/dev/null || true; \
	        fi; \
	      done ;; \
	    *) echo "$(WARN) Unknown container: $(CONTAINER)"; exit 1 ;; \
	  esac; \
	  echo "$(INFO) Rollout complete — ENV=$(ENV)"; \
	} $(call tee,rollout)

# ══════════════════════════════════════════════════════════════════════════════
# Logs / Describe / Exec
# ══════════════════════════════════════════════════════════════════════════════

CTL_TARGET = $(if $(filter all,$(CONTAINER)),backend,$(CONTAINER))

.PHONY: logs
logs: _ensure-context
	$(KUBECTL) logs -n $(NAMESPACE) -l app=$(CTL_TARGET) --tail=100 -f

.PHONY: describe
describe: _ensure-context
	$(KUBECTL) describe deployment/$(CTL_TARGET) -n $(NAMESPACE)

.PHONY: exec
exec: _ensure-context
	$(KUBECTL) exec -n $(NAMESPACE) -it deployment/$(CTL_TARGET) -- /bin/sh

# ══════════════════════════════════════════════════════════════════════════════
# Cluster status
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: status nodes teardown

status: _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo ""; \
	  echo "$(BOLD)$(INFO) ═══════════════════════════════════════════════$(RESET)"; \
	  echo "$(BOLD)$(INFO)  k8s cluster | Env: $(ENV) | Namespace: $(NAMESPACE)$(RESET)"; \
	  echo "$(BOLD)$(INFO) ═══════════════════════════════════════════════$(RESET)"; \
	  echo ""; \
	  echo "$(BOLD)$(INFO) ▸ Nodes$(RESET)"; \
	  $(KUBECTL) get nodes -o wide 2>&1; \
	  echo ""; \
	  echo "$(BOLD)$(INFO) ▸ Deployments, Services & Infrastructure$(RESET)"; \
	  $(KUBECTL) get deployments,services,ingress,pvc,configmap,secret -n $(NAMESPACE) 2>&1; \
	  echo ""; \
	  echo "$(BOLD)$(INFO) ▸ Pods (sorted by status)$(RESET)"; \
	  $(KUBECTL) get pods -n $(NAMESPACE) --sort-by='.status.phase' -o wide 2>&1; \
	  echo ""; \
	} $(call tee,status)

nodes: _ensure-context
	@$(call log,Kubernetes nodes:)
	$(KUBECTL) get nodes -o wide

teardown: _ensure-context
	@read -rp "Delete namespace $(NAMESPACE) from $(ENV) cluster? [y/N] " confirm; \
	  [[ "$$confirm" =~ ^[Yy]$$ ]] || { echo "Aborted"; exit 0; }; \
	  $(KUBECTL) delete namespace $(NAMESPACE) --ignore-not-found
	@$(call log,Namespace $(NAMESPACE) deleted)

# ══════════════════════════════════════════════════════════════════════════════
# Comprehensive log dump
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: save-logs images logs-cleanup

save-logs: _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "========== SAVE-LOGS $(ENV) $(TS) =========="; \
	  echo ""; \
	  echo "--- k8s nodes ---"; $(KUBECTL) get nodes -o wide 2>&1; \
	  echo ""; \
	  echo "--- k8s all resources ---"; $(KUBECTL) get all -n $(NAMESPACE) 2>&1; \
	  echo ""; \
	  echo "--- k8s configmaps ---"; $(KUBECTL) get configmap -n $(NAMESPACE) -o yaml 2>&1; \
	  echo ""; \
	  echo "--- k8s events (recent) ---"; $(KUBECTL) get events -n $(NAMESPACE) --sort-by='.lastTimestamp' 2>&1 | tail -30; \
	  echo ""; \
	  echo "--- Backend describe ---"; $(KUBECTL) describe deployment/backend -n $(NAMESPACE) 2>&1 | head -60; \
	  echo ""; \
	  echo "--- Backend recent logs ---"; $(KUBECTL) logs -n $(NAMESPACE) -l app=backend --tail=30 2>&1; \
	  echo ""; \
	  echo "========== END SAVE-LOGS =========="; \
	} 2>&1 | tee $(call logfile,save-logs)

images:
	@$(BUILD_TOOL) images --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}' 2>/dev/null | grep -E '(kumbi|^REPOSITORY)' || true

logs-cleanup:
	@echo "$(INFO) Removing logs older than 30 days..."; \
	find $(LOGS_DIR) -name '*.log' -type f -mtime +30 -delete; \
	find $(LOGS_DIR) -name '*.log' -type f | wc -l | xargs echo "$(INFO) Remaining log files:"

# ══════════════════════════════════════════════════════════════════════════════
# Remote helpers (invoke prod commands from local machine via SSH / rsync)
# Usage: make sync
#        make remote CMD=build ENV=prod
#        make remote CMD=deploy ENV=prod
# ══════════════════════════════════════════════════════════════════════════════

PROD_HOST   ?= yox1
REMOTE_DEST ?= ~/kumbi

.PHONY: sync remote
sync:
	$(call log,Syncing code to $(PROD_HOST):$(REMOTE_DEST)...)
	rsync -avz --delete \
	  --exclude='.git' \
	  --exclude='.github' \
	  --exclude='.opencode' \
	  --exclude='.env' \
	  --exclude='.env.example' \
	  --exclude='node_modules' \
	  --exclude='backend/bin' \
	  --exclude='infra/k8s/overlays/dev' \
	  --exclude='infra/k8s/overlays/test' \
	  --exclude='infra/k8s/overlays/staging' \
	  --exclude='infra/k8s/overlays/prod/secrets.yaml' \
	  --exclude='logs' \
	  ./ $(PROD_HOST):$(REMOTE_DEST)/

remote: sync
	$(call log,Running 'make $(CMD) ENV=$(or $(ENV),prod)' on $(PROD_HOST)...)
	ssh $(PROD_HOST) "cd $(REMOTE_DEST) && make $(CMD) ENV=$(or $(ENV),prod)"

# ══════════════════════════════════════════════════════════════════════════════
# Scaling
# ══════════════════════════════════════════════════════════════════════════════

BACKEND_REPLICAS  ?= 3
FRONTEND_REPLICAS ?= 3

.PHONY: scale scale-up scale-down

scale: _ensure-context
	$(KUBECTL) scale deployment/backend  --replicas=$(BACKEND_REPLICAS)  -n $(NAMESPACE)
	$(KUBECTL) scale deployment/frontend --replicas=$(FRONTEND_REPLICAS) -n $(NAMESPACE)
	$(call log,backend=$(BACKEND_REPLICAS) frontend=$(FRONTEND_REPLICAS))

scale-up:
	$(MAKE) scale ENV=$(ENV) BACKEND_REPLICAS=3 FRONTEND_REPLICAS=3

scale-down:
	$(MAKE) scale ENV=$(ENV) BACKEND_REPLICAS=1 FRONTEND_REPLICAS=1

# ══════════════════════════════════════════════════════════════════════════════
# User management
# ══════════════════════════════════════════════════════════════════════════════

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

# ══════════════════════════════════════════════════════════════════════════════
# Docker Compose (local tooling helper)
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: compose-up compose-down compose-logs
compose-up:   ; $(BUILD_TOOL) compose up --build -d
compose-down: ; $(BUILD_TOOL) compose down
compose-logs: ; $(BUILD_TOOL) compose logs -f
