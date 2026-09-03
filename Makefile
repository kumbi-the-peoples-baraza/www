# Kumbi — The People's Baraza
# Usage: make <command> [ENV=dev|test|staging|prod] [CONTAINER=backend|frontend|postgres|all]
# Run `make help` for a full list of commands.
#
# Targets a k3s install (systemd) with its built-in privileged containerd
# (/run/k3s/containerd/containerd.sock). Builds prefer a host buildkitd
# (systemd socket /run/buildkit/buildkitd.sock) and fall back to an
# IN-CLUSTER buildkit pod (namespace `buildkit`, service `buildkit` on port
# 1234) if the host socket is unavailable. Images are built for the
# native host architecture (aarch64/arm64 on the prod VPS, x86_64 elsewhere).
#
# All kubectl commands are strictly scoped to the "kumbi" namespace to enforce
# demarcation from other applications on the same cluster.
#
# TLS: mkcert for dev/test, cert-manager/Let's Encrypt for staging.
# On prod TLS is terminated externally — no in-cluster certs.
#
# Nothing is ever installed by the Makefile (no brew, no apt, no sudo): if a
# required tool is missing, the run aborts with instructions.
#
# The cluster is named kumbi-$ENV (kumbi-dev / kumbi-test / kumbi-staging
# / kumbi-prod), so it can coexist with other clusters on the host.

SHELL := $(shell command -v bash 2>/dev/null || echo /bin/bash)
.SHELLFLAGS := -o pipefail -c
.ONESHELL:
.DEFAULT_GOAL := help

# GNU Make 4.4+ — catch failed $(shell) calls via .SHELLSTATUS
ifeq ($(origin .SHELLSTATUS),undefined)
  $(warning GNU Make 4.0+ recommended — current version: $(MAKE_VERSION))
endif

# ══════════════════════════════════════════════════════════════════════════════
# Platform Detection
# ══════════════════════════════════════════════════════════════════════════════

# ── Ingress controller ──────────────────────────────────────────────────────────
# Default k3s stack: flannel (CNI) + servicelb (klipper-lb) + Traefik ingress.
# Traefik runs in kube-system (Service type LoadBalancer via servicelb) and
# binds 80/443 on the node. Ingress resources use ingressClassName: traefik
# (see infra/k8s/base/ingress.yaml). Host ports INGRESS_HTTP_PORT /
# INGRESS_HTTPS_PORT (default 80 / 443) are published by the Traefik
# LoadBalancer Service; optional host nginx forwarding is generally unnecessary
# (see infra/host/nginx-stream.conf for the optional passthrough).

# ── Privilege escalation ──────────────────────────────────────────────────────
# AGENTS.md forbids sudo — never prompt for a password. If nerdctl needs root,
# the user must configure passwordless sudo or run in a rootless setup.
SUDO ?=

# ── Architecture ───────────────────────────────────────────────────────────────
# Build for the native host architecture (prod VPS is aarch64). This is the
# platform k3s will run the images on, so we never cross-compile.
HOST_ARCH := $(shell uname -m 2>/dev/null || echo unknown)
BUILD_PLATFORM := linux/$(if $(filter aarch64 arm64,$(HOST_ARCH)),arm64,$(if $(filter x86_64 amd64,$(HOST_ARCH)),amd64,$(HOST_ARCH)))

# ── kubectl ───────────────────────────────────────────────────────────────────
# Try: kubectl → k3s kubectl (no sudo — the cluster is reachable via ~/.kube/config).
# Override via KUBECTL= env.
KUBECTL := $(shell \
  if command -v kubectl >/dev/null 2>&1 && timeout 3 kubectl get --raw=/readyz >/dev/null 2>&1; then echo kubectl; \
  elif command -v k3s >/dev/null 2>&1 && timeout 3 k3s kubectl get --raw=/readyz >/dev/null 2>&1; then echo "k3s kubectl"; \
  elif command -v kubectl >/dev/null 2>&1; then echo kubectl; \
  elif command -v k3s >/dev/null 2>&1; then echo "k3s kubectl"; \
  else echo kubectl; fi)

# ── In-cluster buildkit (pod) ────────────────────────────────────────────────────
# buildkitd runs as a Deployment in the `buildkit` namespace (service `buildkit`,
# port 1234) with a private `registry` (port 5000). No host-side buildkitd socket
# or systemd unit is required. buildctl reaches it directly on its ClusterIP:1234
# (kube-proxy makes the ClusterIP reachable from the node). Install with `make buildkit`.
BUILDKIT_NS   ?= buildkit
BUILDKIT_SVC  ?= buildkit
BUILDKIT_PORT ?= 1234

HELM ?= helm
# Default k3s ingress: Traefik (installed by k3s in kube-system).
# Traefik Service is type LoadBalancer; servicelb (klipper-lb) fulfills it.
TRAEFIK_NS            ?= kube-system
TRAEFIK_SVC           ?= traefik

# ── Build tool ────────────────────────────────────────────────────────────────
# Prefer host buildkitd (systemd) if available, otherwise in-cluster buildkit.
BUILDKIT_TCP_ADDR := $(shell \
  ip=$$($(KUBECTL) get svc -n $(BUILDKIT_NS) $(BUILDKIT_SVC) -o jsonpath='{.spec.clusterIP}' 2>/dev/null); \
  if [ -z "$$ip" ] || [ "$$ip" = "None" ]; then ip=$$($(KUBECTL) get svc -n $(BUILDKIT_NS) buildkitd -o jsonpath='{.spec.clusterIP}' 2>/dev/null); fi; \
  if [ -n "$$ip" ] && [ "$$ip" != "None" ] && [ "$$ip" != "" ]; then echo "tcp://$$ip:$(BUILDKIT_PORT)"; fi)

BUILD_TOOL := $(shell \
  if [ -S /run/buildkit/buildkitd.sock ] && command -v buildctl >/dev/null 2>&1 && timeout 2 buildctl --addr unix:///run/buildkit/buildkitd.sock debug workers >/dev/null 2>&1; then echo buildctl; \
  elif command -v nerdctl >/dev/null 2>&1 && [ -n "$(CONTAINERD_ADDRESS)" ]; then echo nerdctl; \
  elif [ -n "$(BUILDKIT_TCP_ADDR)" ] && command -v buildctl >/dev/null 2>&1; then echo buildctl; \
  elif command -v docker >/dev/null 2>&1; then echo docker; \
  elif command -v podman >/dev/null 2>&1; then echo podman; \
  elif command -v buildah >/dev/null 2>&1; then echo buildah; \
  else echo none; fi)

BUILDKIT_ADDR := $(shell \
  if [ -S /run/buildkit/buildkitd.sock ] && [ "$(BUILD_TOOL)" = "buildctl" ] && timeout 2 buildctl --addr unix:///run/buildkit/buildkitd.sock debug workers >/dev/null 2>&1; then echo "unix:///run/buildkit/buildkitd.sock"; \
  elif [ -n "$(BUILDKIT_TCP_ADDR)" ] && [ "$(BUILD_TOOL)" = "buildctl" ]; then echo "$(BUILDKIT_TCP_ADDR)"; \
  fi)
# Back-compat alias
BUILDKIT_SOCK := $(BUILDKIT_ADDR)

USE_HOST_BUILDKIT := $(shell [ -S /run/buildkit/buildkitd.sock ] && timeout 2 buildctl --addr unix:///run/buildkit/buildkitd.sock debug workers >/dev/null 2>&1 && echo yes || echo no)
USE_BUILDKIT := $(shell \
  if [ -S /run/buildkit/buildkitd.sock ] && timeout 2 buildctl --addr unix:///run/buildkit/buildkitd.sock debug workers >/dev/null 2>&1; then echo yes; \
  elif [ -n "$(BUILDKIT_TCP_ADDR)" ]; then echo yes; \
  else echo no; fi)

# ── Containerd socket (for direct build into k3s containerd) ───────────────
# Auto-detected by probing each candidate — prefer k3s ctr, ctr, crictl, nerdctl.
unexport CONTAINERD_ADDRESS
CONTAINERD_ADDRESS := /run/k3s/containerd/containerd.sock
# Never use rootless containerd — k3s is privileged via /run/k3s/containerd/containerd.sock
CONTAINERD_ADDRESS := $(CONTAINERD_ADDRESS)

# Can we build directly into k3s containerd? (buildctl+buildkitd or nerdctl)
CAN_DIRECT_BUILD := $(shell \
  if [ "$(BUILD_TOOL)" = "nerdctl" ] && [ -n "$(CONTAINERD_ADDRESS)" ]; then echo yes; \
  elif [ "$(BUILD_TOOL)" = "buildctl" ] && [ -n "$(CONTAINERD_ADDRESS)" ]; then echo yes; \
  else echo no; fi)

# ── Image import — unprivileged k3s only (no rootless fallback), ignore env CONTAINERD_ADDRESS
_import_cmd := env -u CONTAINERD_ADDRESS k3s ctr images import -
_prune_cmd := env -u CONTAINERD_ADDRESS k3s ctr images rm

# ══════════════════════════════════════════════════════════════════════════════
# Configuration
# ══════════════════════════════════════════════════════════════════════════════

# ENV detection: from environment, from command line, or prompted interactively.
# Priority: command line > environment variable > interactive prompt > default (dev)
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
# Cluster label (host-side only; the actual k8s context is shared).
CLUSTER   := kumbi-$(ENV)
# Per-env namespace isolation — prevents cross-env interference on shared clusters.
# dev and prod keep "kumbi" for backward compat; test/staging use kumbi-<env>.
NAMESPACE := $(if $(filter dev prod,$(ENV)),kumbi,kumbi-$(ENV))
IMG_TAG   := $(ENV)
OVERLAY   := infra/k8s/overlays/$(ENV)
SECRETS   := $(OVERLAY)/secrets.yaml

# Traefik readiness: the controller Deployment must be Ready and the
# host ports (INGRESS_HTTP_PORT/INGRESS_HTTPS_PORT) must be bound on the
# node via servicelb (klipper-lb). Hard-fails on timeout.
TRAEFIK_WAIT_TIMEOUT ?= 180
# Back-compat alias
NGINX_IC_WAIT_TIMEOUT ?= $(TRAEFIK_WAIT_TIMEOUT)

# Safety: reject any kubectl command that forgot -n $(NAMESPACE)
KUBECTL_BASE := $(KUBECTL) -n $(NAMESPACE)
NS_CHECK = @if echo "$(MAKECMDGOALS)" | grep -qvE '^(_|-)' && ! echo "$(MAKECMDGOALS)" | grep -q -- '-n '; then \
  echo "$(ERR) All kubectl commands must specify -n $(NAMESPACE). Use: $(KUBECTL_BASE) <cmd>"; exit 1; fi

BACKEND_IMG  := kumbi/backend:$(IMG_TAG)
FRONTEND_IMG := kumbi/frontend:$(IMG_TAG)

# ROLL_IMG resolves the image that will be rolled out for a given CONTAINER.
# Falls back to the default image tag if the deployment doesn't exist yet.
ROLL_IMG := $(shell \
  if [ "$(CONTAINER)" = "all" ] || [ "$(CONTAINER)" = "postgres" ]; then echo ""; \
  elif [ "$(CONTAINER)" = "backend" ]; then echo "$(BACKEND_IMG)"; \
  elif [ "$(CONTAINER)" = "frontend" ]; then echo "$(FRONTEND_IMG)"; \
  else echo ""; fi)

# ── Per-environment knobs live in the overlay's secrets.yaml ──────────────────
# Each overlay defines a `kumbi-app-config` ConfigMap holding every
# configurable setting: public DOMAIN, ingress/Envoy ports, persistent-volume
# host paths, replica counts, ACME email, API URL. The Makefile reads them
# below; the *_DEFAULT values only kick in when a key is absent.
#
# PERFORMANCE: Batch-read all secrets in ONE shell fork (yaml-batch-get.sh)
# instead of forking per key. All variables use := so they're evaluated
# once at parse time, not on every reference.
SECRET_BATCH := $(shell scripts/yaml-batch-get.sh "$(SECRETS)" 2>/dev/null)

DOMAIN := $(or $(word 1,$(SECRET_BATCH)),$(ENV_DOMAIN_$(ENV)))
# Hostname served by Traefik ingress (per-environment public host).
GATEWAY_HOST := $(DOMAIN)

# Host ingress ports published by Traefik's LoadBalancer Service via servicelb
# (klipper-lb). On stock k3s these are 80/443. Configured in kumbi-app-config.
INGRESS_HTTP_PORT  := $(or $(word 2,$(SECRET_BATCH)),80)
INGRESS_HTTPS_PORT := $(or $(word 3,$(SECRET_BATCH)),443)

# ── Persistent volume host paths (per overlay secrets.yaml) ──────────────────
# Word positions MUST match scripts/yaml-batch-get.sh output order:
#   4-POSTGRES_DATA_DIR 5-STORAGE_DATA_DIR 6-CERT_DATA_DIR
POSTGRES_DATA_DIR := $(or $(word 4,$(SECRET_BATCH)),/var/lib/kumbi/$(ENV)/postgres-data)
STORAGE_DATA_DIR  := $(or $(word 5,$(SECRET_BATCH)),/var/lib/kumbi/$(ENV)/storage)
CERT_DATA_DIR     := $(or $(word 6,$(SECRET_BATCH)),/var/lib/kumbi/$(ENV)/certs)

# ── Scale defaults (per overlay secrets.yaml) ─────────────────────────────────
#   7-BACKEND_REPLICAS 8-FRONTEND_REPLICAS 9-ACME_EMAIL(app) 10-ACME_EMAIL(be) 11-API_URL
BACKEND_REPLICAS  ?= $(or $(word 7,$(SECRET_BATCH)),3)
FRONTEND_REPLICAS ?= $(or $(word 8,$(SECRET_BATCH)),3)

ACME_EMAIL := $(or $(word 9,$(SECRET_BATCH)),$(word 10,$(SECRET_BATCH)),admin@kumbike.org)
API_URL    := $(word 11,$(SECRET_BATCH))

# ── Fallback defaults (used only when the secrets.yaml key is absent) ────────
ENV_DOMAIN_dev     := kumbi.test
ENV_DOMAIN_test    := test.kumbi.test
ENV_DOMAIN_staging := staging.kumbike.org
ENV_DOMAIN_prod    := kumbike.org

# ── Optional: open host firewall for 80/443 (off by default — destructive
# on shared hosts). Set SETUP_FIREWALL=1 to enable. ───────────────────────
SETUP_FIREWALL ?= false

# ── Infra versions ─────────────────────────────────────────────────────────────
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

# Build an image — handles buildctl (host or in-cluster), nerdctl, docker, etc.
# Usage: $(call build-image,tag,context_dir,extra_args)
define build-image
	@if [ "$(BUILD_TOOL)" = "none" ]; then \
		echo "$(ERR) No build tool available for k3s containerd."; \
		exit 1; \
	fi
	@echo "$(INFO) Building $(1) with $(BUILD_TOOL) (platform: $(BUILD_PLATFORM))..."
	@if [ "$(CAN_DIRECT_BUILD)" = "yes" ] && [ "$(BUILD_TOOL)" = "nerdctl" ]; then \
		$(SUDO) $(BUILD_TOOL) --address "$(CONTAINERD_ADDRESS)" --namespace k8s.io build --platform $(BUILD_PLATFORM) $(NOCACHE_FLAG) -t $(1) $(3) $(2); \
	elif [ "$(BUILD_TOOL)" = "buildctl" ]; then \
		echo "$(INFO) Using buildkitd at $(BUILDKIT_ADDR)..."; \
		buildctl_args=""; \
		case "$(3)" in \
		  --build-arg*) buildctl_args=$(echo $(3) | sed 's/--build-arg /--opt build-arg:/');; \
		esac; \
		img_tar=/tmp/.kumbi-build-$$$$.tar; \
		rm -f $$img_tar /tmp/.kumbi-buildctl.err; \
		if ! buildctl --addr "$(BUILDKIT_ADDR)" build --progress plain $(if $(filter true,$(NOCACHE)),--no-cache,) --frontend dockerfile.v0 \
			--local context=$(2) --local dockerfile=$(2) \
			--opt platform=$(BUILD_PLATFORM) \
			$$buildctl_args \
			--output type=docker,name=$(1) > $$img_tar 2> >(tee /tmp/.kumbi-buildctl.err >&2); then \
			echo "$(ERR) buildctl build failed for $(1)"; \
			cat /tmp/.kumbi-buildctl.err >&2; \
			rm -f $$img_tar; \
			exit 1; \
		fi; \
		echo "$(INFO) Importing $(1) into k3s containerd..."; \
		if ! cat $$img_tar | ($(_import_cmd)); then \
			echo "$(ERR) Could not import $(1) into k3s containerd — confirm k3s is running"; \
			rm -f $$img_tar; \
			exit 1; \
		fi; \
		rm -f $$img_tar /tmp/.kumbi-buildctl.err; \
	elif [ "$(BUILD_TOOL)" = "buildah" ]; then \
		$(BUILD_TOOL) bud --platform $(BUILD_PLATFORM) $(NOCACHE_FLAG) -t $(1) $(3) $(2) || \
		{ echo "$(ERR) buildah build failed" >&2; exit 1; }; \
	else \
		$(BUILD_TOOL) build --platform $(BUILD_PLATFORM) $(NOCACHE_FLAG) -t $(1) $(3) $(2) && \
		echo "$(INFO) Importing $(1) into k3s containerd..." && \
		($(BUILD_TOOL) save $(1) | ($(_import_cmd)) 2>/dev/null) || \
		{ echo "$(ERR) Could not import $(1) into k3s containerd — confirm k3s is running" >&2; exit 1; }; \
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
	@echo "    containerd: $(or $(CONTAINERD_ADDRESS),<not found>)"
	@echo "    direct build: $(CAN_DIRECT_BUILD)"
	@echo "    sudo:      $(SUDO)"
	@echo ""
	@echo "  $(BOLD)Usage$(RESET)"
	@echo "    make <command> [ENV=dev|test|staging|prod] [CONTAINER=backend|frontend|postgres|all]"
	@echo "    default: ENV=dev CONTAINER=all"
	@echo ""
	@echo "  $(BOLD)Core (build + deploy)$(RESET)"
	@echo "    make deploy   ENV=..   Build → provision → apply → wait (end-to-end)"
	@echo "    make build    ENV=.. [IMG=backend|frontend|all]  Build images"
	@echo "    make refresh  ENV=.. [IMG=backend|frontend|all]  Rebuild + rollout + wait"
	@echo "    make [build|deploy|refresh] NOCACHE=true  No cached layers"
	@echo ""
	@echo "  $(BOLD)Cluster Provisioning (k3s)$(RESET)"
	@echo "    make cluster-create  ENV=..   Create k3s cluster 'kumbi-$ENV'"
	@echo "    make cluster-delete  ENV=..   Delete k3s cluster"
	@echo "    make cluster-ensure  ENV=..   Create if missing (idempotent)"
	@echo "    make deploy ENV=.. SETUP_FIREWALL=1  Also open host 80/443"
	@echo ""
	@echo "  $(BOLD)TLS / Certificates$(RESET)"
	@echo "    make tls ENV=dev|test            mkcert (local, cert for domain in secrets.yaml)"
	@echo "    make tls ENV=staging             Let's Encrypt staging"
	@echo "    make tls ENV=prod                no-op"
	@echo "    make tls-force ENV=.. | make tls ENV=.. FORCE=true | make tls force ENV=.."
	@echo "                                     Force re-issue/overwrite the TLS secret"
	@echo "    make tls-check ENV=..            Show certificate issuance status"
	@echo ""
	@echo "  $(BOLD)Ingress (Traefik — default k3s)$(RESET)"
	@echo "    Traefik via servicelb (klipper-lb) — single front door for all envs"
	@echo "    make buildkit     Ensure systemd buildkit is responsive"
	@echo "    make k3s-check    Verify k3s default stack (flannel/servicelb/traefik)"
	@echo ""
	@echo "  $(BOLD)Management$(RESET)"
	@echo "    make rollout  ENV=.. [CONTAINER=backend|frontend|postgres|all]"
	@echo "    make seed     ENV=..   Re-seed database via backend startup"
	@echo "    make create-user ENV=.. NAME=.. EMAIL=.. PASS=.. [ROLE=admin]"
	@echo "    make status   ENV=..   Cluster + pod status"
	@echo "    make status-pods      Pods only"
	@echo "    make status-ingress   Ingress/Traefik only"
	@echo "    make status-nodes     Nodes only"
	@echo "    make status-pv        PV/PVC only"
	@echo "    make ports    ENV=..   Show ingress/egress port mappings"
	@echo "    make apply    ENV=..   kubectl apply kustomize overlay"
	@echo "    make logs     ENV=.. [CONTAINER=..]  Follow pod logs"
	@echo "    make migrate  ENV=..   Re-run DB migrations"
	@echo "    make seed     ENV=..   Re-seed database via backend startup"
	@echo "    make nuke     ENV=..   Delete all resources (keeps namespace)"
	@echo "    make nuke     ENV=.. PRESERVE=true  Spare PVCs/PVs/certs"
	@echo "    make teardown ENV=..   Delete namespace (prompts)"
	@echo ""
	@echo "  $(BOLD)Setup (k3s + buildkit + registry)$(RESET)"
	@echo "    make setup [IP=.. TOKEN=..]     Install k3s (flannel vxlan, prompts IP/token) + buildkit + registry + kubectl"
	@echo "    make setup-deps                 Install frontend/backend deps only (bun install / go mod download)"
	@echo "    make setup-k3s                  k3s install step only"
	@echo "    make setup-buildkit             buildkit install step only"
	@echo ""
	@echo "  $(BOLD)Other$(RESET)"
	@echo "    make test      Run tests"
	@echo "    make lint      Run linters"
	@echo "    make check-config   Validate secrets.yaml + generate DATABASE_URL"
	@echo "    make sync [HOST=] [DEST=]   rsync code to remote (respects .gitignore)"
	@echo ""
	@echo "  Current ENV=$(ENV)  CONTAINER=$(CONTAINER)  CLUSTER=$(CLUSTER)"
	@echo ""

# ══════════════════════════════════════════════════════════════════════════════
# Setup / Dependencies — k3s + buildkit + registry + kubectl
# ══════════════════════════════════════════════════════════════════════════════

# make setup — interactive k3s install (flannel vxlan) + buildkit + registry + kubectl + deps
# Prompts for node IP and k3s token if not provided via IP=/TOKEN= env.
# On Linux: installs k3s via get.k3s.io, configures embedded registry (5000),
# mirrors in /etc/rancher/k3s/registries.yaml, installs buildkitd as systemd
# socket (minimal toml pointing at /run/k3s/containerd/containerd.sock),
# sets CONTAINERD_ADDRESS, installs kubectl if missing.
# On macOS: installs buildkit/kubectl/gettext via brew, OCI worker config,
# skips k3s systemd (use k3d).
# Usage:
#   make setup                          # interactive prompt IP + token
#   make setup IP=10.100.0.1 TOKEN=xxx  # non-interactive
#   IP=10.0.0.5 TOKEN=xxx make setup
.PHONY: setup setup-deps setup-k3s setup-buildkit
setup:
	@bash setup.sh

# Backwards-compat: install frontend/backend deps only (no k3s)
setup-deps:
	@$(call log,Installing frontend dependencies...)
	cd frontend && bun install
	@$(call log,Downloading backend modules...)
	cd backend && go mod download

# Granular k3s / buildkit steps (also called by `make setup`)
setup-k3s:
	@bash setup.sh 2>&1 | tail -50

setup-buildkit:
	@bash -c 'OS=$$(uname -s); if [ "$$OS" = "Darwin" ]; then echo "[setup] macOS buildkit via brew..."; brew install buildkit 2>&1 | tail -5; else echo "[setup] Linux buildkit systemd..."; bash setup.sh 2>&1 | grep -A2 buildkit; fi'

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
	@bash scripts/ensure-tools.sh \
	  $(if $(filter tls,$(MAKECMDGOALS)),--tls,) \
	  --env=$(ENV)

# ══════════════════════════════════════════════════════════════════════════════
# kubectl context check
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: _ensure-context
_ensure-context:
	@ready=0; \
	for i in 1 2 3 4 5; do \
	  if $(KUBECTL) get --raw=/readyz >/dev/null 2>&1; then ready=1; break; fi; \
	  sleep 2; \
	done; \
	if [ "$$ready" -ne 1 ]; then \
	  echo -e "$(ERR) Cannot connect to k8s cluster '$(CLUSTER)'."; \
	  echo "  Detected kubectl: $(KUBECTL)"; \
	  echo "  Raw error was: $$($(KUBECTL) get --raw=/readyz 2>&1 | head -2)"; \
	  echo "  KUBECONFIG=$$(echo "$${KUBECONFIG:-<unset>}") — file: $(if $(wildcard ~/.kube/config),$(shell ls -ld ~/.kube/config 2>/dev/null),"~/.kube/config missing")"; \
	  echo "  Run: make cluster-create ENV=$(ENV)"; \
	  exit 1; \
	fi

# ══════════════════════════════════════════════════════════════════════════════
# Dependency checks
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: _ensure-envsubst
_ensure-envsubst:
	@command -v envsubst >/dev/null 2>&1 || { \
	  echo -e "$(ERR) envsubst (gettext) is required but not installed."; \
	  echo "  The Makefile never installs packages — install 'gettext' manually, then re-run."; \
	  exit 1; \
	}

# ══════════════════════════════════════════════════════════════════════════════
# k3s cluster lifecycle
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: cluster-create cluster-delete cluster-ensure _cluster-exists _check-ports

_cluster-exists:
	@$(KUBECTL) get --raw=/readyz >/dev/null 2>&1

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
	  echo "$(INFO) Verifying k3s cluster '$(CLUSTER)' (ENV=$(ENV))..."; \
	  if command -v k3s >/dev/null 2>&1 && timeout 3 k3s kubectl get --raw=/readyz >/dev/null 2>&1; then \
	    echo "$(INFO) k3s is running (built-in containerd) — nothing to do."; \
	  elif systemctl is-active --quiet k3s 2>/dev/null || systemctl is-active --quiet k3s-agent 2>/dev/null; then \
	    echo "$(INFO) k3s systemd service is active — nothing to do."; \
	  else \
	    echo "$(ERR) k3s is not running."; \
	    echo "  This Makefile never installs or launches k3s — start the systemd service:"; \
	    echo "    sudo systemctl start k3s        (or: k3s server --cluster-init ...)"; \
	    exit 1; \
	  fi; \
	  echo "$(INFO) Cluster ready — context: $(CLUSTER) (kubeconfig: ~/.kube/config)"; \
	} $(call tee,cluster-create)

cluster-ensure: ensure-tools _ensure-context
	@true

cluster-delete: ensure-tools
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Deleting k3s cluster '$(CLUSTER)'..."; \
	  /usr/local/bin/k3s-killall.sh 2>/dev/null || pkill -f "k3s server" 2>/dev/null || true; \
	  echo "$(INFO) Cluster '$(CLUSTER)' stopped."; \
	} 2>&1 | tee $(call logfile,cluster-delete)

# ══════════════════════════════════════════════════════════════════════════════
# Ingress controller (bare-metal / NodePort)
# ══════════════════════════════════════════════════════════════════════════════

# ── Ingress controller (Traefik — default k3s, all envs)
# ═════════════════════════════════════════════════════════════════════════════

.PHONY: _ensure-ingress _ensure-deps _ensure-hostroute

# Helm deps: not required for default k3s (Traefik is bundled). Keep as no-op
# for backwards compatibility; cert-manager if used is installed separately.
_ensure-deps: _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Default k3s — no extra helm repos required (Traefik bundled)."; \
	} $(call tee,ensure-deps)

# Ensure front-door ingress controller (Traefik via servicelb).
# Default k3s ships Traefik in kube-system as a LoadBalancer Service fulfilled
# by servicelb (klipper-lb). This target is idempotent and never installs
# Cilium/Gateway API/F5 NGINX — it only verifies Traefik is present.
_ensure-ingress: _ensure-context _ensure-deps
	@mkdir -p $(LOGS_DIR) && { \
	  if $(KUBECTL) -n $(TRAEFIK_NS) get svc $(TRAEFIK_SVC) >/dev/null 2>&1; then \
	    echo "$(INFO) Traefik detected ($(TRAEFIK_NS)/$(TRAEFIK_SVC)) — servicelb will publish 80/443"; \
	    _r=$$($(KUBECTL) -n $(TRAEFIK_NS) get deploy traefik -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0); \
	    _r=$${_r:-0}; \
	    if [ "$$_r" -ge 1 ] 2>/dev/null; then echo "$(INFO) Traefik Deployment ready ($$_r replicas)"; else echo "$(INFO) Traefik Deployment not yet ready (replicas: $$_r) — will wait in _wait-ingress"; fi; \
	  elif $(KUBECTL) -n kube-system get svc traefik >/dev/null 2>&1; then \
	    echo "$(INFO) Traefik Service found in kube-system — using default k3s ingress"; \
	  else \
	    echo "$(WARN) Traefik Service not found in $(TRAEFIK_NS)/$(TRAEFIK_SVC)"; \
	    echo "$(WARN) Default k3s should provide Traefik. If missing, re-install k3s without --disable=traefik"; \
	    echo "$(WARN) or install Traefik via helm: helm upgrade --install traefik traefik/traefik -n kube-system --create-namespace"; \
	  fi; \
	  echo "$(INFO) IngressClass traefik should be present:"; \
	  $(KUBECTL) get ingressclass traefik -o wide 2>/dev/null || echo "  (IngressClass traefik not yet available)"; \
	} $(call tee,ensure-ingress)

# Wait for front door (Traefik) to be ready.
.PHONY: _wait-nginx-ingress _wait-ingress _wait-traefik
_wait-nginx-ingress: _wait-ingress
_wait-traefik: _wait-ingress
_wait-ingress: _ensure-context
	@echo "$(INFO) Waiting up to $(TRAEFIK_WAIT_TIMEOUT)s for Traefik ingress..."
	@_ready=0; _deadline=$$(( $$(date +%s) + $(TRAEFIK_WAIT_TIMEOUT) )); \
	while [ $$(date +%s) -lt $$_deadline ]; do \
	  _r=$$($(KUBECTL) -n $(TRAEFIK_NS) get deploy traefik -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0); \
	  _r=$${_r:-0}; \
	  if [ "$$_r" -ge 1 ] 2>/dev/null; then _ready=1; break; fi; \
	  _r2=$$($(KUBECTL) -n kube-system get deploy traefik -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0); \
	  _r2=$${_r2:-0}; \
	  if [ "$$_r2" -ge 1 ] 2>/dev/null; then _ready=1; break; fi; \
	  sleep 3; \
	done; \
	if [ "$$_ready" = "1" ]; then echo "$(INFO) Traefik is ready"; else echo "$(WARN) Traefik not ready within $(TRAEFIK_WAIT_TIMEOUT)s — check: kubectl -n kube-system get pods,svc -l app.kubernetes.io/name=traefik"; fi

# Wire an optional host-side nginx to forward 80/443 to the front-door host ports.
# With default k3s + servicelb, Traefik already binds 80/443 via its LoadBalancer
# Service, so this is rarely needed. Kept for users who run an extra host nginx.
_ensure-hostroute: _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  export INGRESS_HTTP_PORT=$(INGRESS_HTTP_PORT); \
	  export INGRESS_HTTPS_PORT=$(INGRESS_HTTPS_PORT); \
	  if ! command -v nginx >/dev/null 2>&1; then \
	    echo "$(INFO) Host nginx not found — Traefik via servicelb binds directly to 80/443."; \
	  elif ! systemctl is-active --quiet nginx 2>/dev/null; then \
	    echo "$(INFO) Host nginx present but not active — optional (Traefik already on 80/443)."; \
	  else \
	    echo "$(INFO) Host nginx detected — optional passthrough 80→$(INGRESS_HTTP_PORT) / 443→$(INGRESS_HTTPS_PORT)..."; \
	    mkdir -p /etc/nginx/conf.d 2>/dev/null && \
	    envsubst < infra/host/nginx-stream.conf > /etc/nginx/conf.d/kumbi-$(ENV).conf 2>/dev/null && \
	    nginx -t >/dev/null 2>&1 && \
	    nginx -s reload >/dev/null 2>&1 && \
	      echo "$(INFO) Host nginx reloaded with kumbi-$(ENV).conf" || \
	      echo "$(WARN) Could not write /etc/nginx/conf.d/kumbi-$(ENV).conf (no sudo). Configure host nginx manually."; \
	  fi; \
	  if [ "$(SETUP_FIREWALL)" = "true" ]; then \
	    echo "$(INFO) SETUP_FIREWALL=true requires root — run firewall commands manually."; \
	  else \
	    echo "$(INFO) Firewall unchanged (SETUP_FIREWALL!=true). Ensure $(INGRESS_HTTP_PORT)/$(INGRESS_HTTPS_PORT) (and 80/443) are open."; \
	  fi; \
	} $(call tee,ensure-hostroute)

# ══════════════════════════════════════════════════════════════════════════════
# In-cluster buildkit (build pod) + registry
# ══════════════════════════════════════════════════════════════════════════════

# Verify buildkitd is available (host systemd or in-cluster)
.PHONY: buildkit
buildkit: _ensure-context
	@if [ "$(USE_BUILDKIT)" = "yes" ]; then \
	  if [ "$(USE_HOST_BUILDKIT)" = "yes" ]; then \
	    echo "$(INFO) Host buildkitd socket responsive — using host systemd service at $(BUILDKIT_ADDR)"; \
	  else \
	    echo "$(INFO) In-cluster buildkit responsive — using $(BUILDKIT_ADDR)"; \
	  fi; \
	else \
	  echo "$(ERR) No buildkitd available (host: /run/buildkit/buildkitd.sock or in-cluster: $(BUILDKIT_NS)/$(BUILDKIT_SVC):$(BUILDKIT_PORT))"; \
	  echo "  Host fix: sudo systemctl restart buildkit && journalctl -u buildkit -f"; \
	  echo "  In-cluster fix: kubectl -n $(BUILDKIT_NS) get pods,svc"; \
	  exit 1; \
	fi

# ══════════════════════════════════════════════════════════════════════════════
# k3s config compliance
# ══════════════════════════════════════════════════════════════════════════════

# Verify the cluster is compliant with Kumbi setup (default k3s: flannel/servicelb/traefik):
.PHONY: k3s-check
k3s-check: _ensure-context
	@echo "$(BOLD)═══ k3s config compliance — $(ENV) ═══$(RESET)"; \
	_fail=0; \
	echo "$(BOLD)CNI / LB / Ingress (default k3s):$(RESET)"; \
	if $(KUBECTL) -n kube-system get pods -l app=flannel 2>/dev/null | grep -q flannel; then \
	  echo "  ✓ flannel CNI present (kube-system)"; \
	elif $(KUBECTL) -n kube-system get pods 2>/dev/null | grep -q flannel; then \
	  echo "  ✓ flannel CNI present"; \
	else \
	  echo "  $(WARN) flannel not detected — expected default k3s CNI (check: kubectl -n kube-system get pods -l app=flannel)"; \
	fi; \
	if $(KUBECTL) -n kube-system get pods -l app=svclb-traefik 2>/dev/null | grep -q svclb || $(KUBECTL) -n kube-system get pods 2>/dev/null | grep -q svclb; then \
	  echo "  ✓ servicelb (klipper-lb) present (svclb-traefik)"; \
	else \
	  echo "  $(WARN) servicelb not detected — expected default k3s LoadBalancer (check: kubectl -n kube-system get pods | grep svclb)"; \
	fi; \
	if $(KUBECTL) -n $(TRAEFIK_NS) get svc $(TRAEFIK_SVC) >/dev/null 2>&1 || $(KUBECTL) -n kube-system get svc traefik >/dev/null 2>&1; then \
	  echo "  ✓ Traefik Service present ($(TRAEFIK_NS)/$(TRAEFIK_SVC))"; \
	else \
	  echo "  $(WARN) Traefik Service not detected — expected default k3s ingress"; \
	fi; \
	if $(KUBECTL) get ingressclass traefik >/dev/null 2>&1; then \
	  echo "  ✓ IngressClass traefik present"; \
	else \
	  echo "  $(WARN) IngressClass traefik missing — check k3s install (should not have --disable=traefik)"; \
	fi; \
	if $(KUBECTL) -n kube-system get pods -l app.kubernetes.io/name=traefik 2>/dev/null | grep -q traefik || $(KUBECTL) -n kube-system get pods -l app=traefik 2>/dev/null | grep -q traefik; then \
	  echo "  ✓ Traefik pods running"; \
	else \
	  echo "  $(WARN) Traefik pods not detected — check: kubectl -n kube-system get pods -l app.kubernetes.io/name=traefik"; \
	fi; \
	if [ -S /run/buildkit/buildkitd.sock ]; then \
	  echo "  ✓ Host buildkitd systemd socket (/run/buildkit/buildkitd.sock) present (kept)"; \
	elif $(KUBECTL) get ns $(BUILDKIT_NS) >/dev/null 2>&1; then \
	  echo "  ✓ In-cluster $(BUILDKIT_NS) present"; \
	else \
	  echo "  $(WARN) buildkit not detected (host socket or namespace) — systemd buildkit remains expected"; \
	fi; \
	if $(KUBECTL) get gatewayclasses >/dev/null 2>&1; then \
	  echo "  $(WARN) Gateway API CRDs still present — not needed for default k3s (Traefik Ingress used)"; \
	fi; \
	if $(KUBECTL) get ns cilium-gateway >/dev/null 2>&1 || $(KUBECTL) get ns nginx-ingress >/dev/null 2>&1; then \
	  echo "  $(WARN) Legacy ingress namespace (cilium-gateway/nginx-ingress) still exists — clean up if reverting fully"; \
	fi; \
	echo "$(INFO) k3s check completed — expected: flannel + servicelb + traefik."

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

# Apply PVs. PVs are immutable after creation — skip existing, warn on path mismatch.
_ensure-pvs: _ensure-context _ensure-envsubst _ensure-pstorage
	@mkdir -p $(LOGS_DIR) && { \
	  envsubst < infra/k8s/base/persistent-volumes.yaml.tpl > /tmp/.pvs-rendered.yaml; \
	  any_missing=false; \
	  for pv in kumbi-postgres-pv kumbi-storage-pv; do \
	    rendered_path=$$(awk "/name: $$pv/{f=1} f && /path:/{print \$$2; exit}" /tmp/.pvs-rendered.yaml); \
	    existing_path=$$($(KUBECTL) get pv "$$pv" -o jsonpath='{.spec.hostPath.path}' 2>/dev/null || true); \
	    if [ -n "$$existing_path" ]; then \
	      if [ "$$existing_path" != "$$rendered_path" ]; then \
	        echo "$(WARN) $$pv: path mismatch (live=$$existing_path, config=$$rendered_path). Delete and recreate to change."; \
	      fi; \
	    else \
	      any_missing=true; \
	    fi; \
	  done; \
	  if [ "$$any_missing" = "true" ]; then \
	    $(KUBECTL) apply -f /tmp/.pvs-rendered.yaml 2>/tmp/.pv-apply-err || \
	      echo "$(WARN) PV apply failed: $$(cat /tmp/.pv-apply-err)"; \
	  fi; \
	} $(call tee,ensure-pvs)

# Validate PVCs are bound and writable
.PHONY: _validate-pvcs
_validate-pvcs: _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Validating PVCs in $(NAMESPACE)..."; \
	  for pvc in postgres-pvc storage-pvc; do \
	    echo "$(INFO) Waiting for PVC $$pvc to be Bound..."; \
	    _bound=0; \
	    for i in 1 2 3 4 5 6; do \
	      phase=$$($(KUBECTL_BASE) get pvc "$$pvc" -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound"); \
	      if [ "$$phase" = "Bound" ]; then _bound=1; break; fi; \
	      echo "$(INFO) PVC $$pvc phase: $$phase — waiting 5s..."; \
	      sleep 5; \
	    done; \
	    if [ "$$_bound" != "1" ]; then \
	      echo "$(ERR) PVC $$pvc is not Bound (phase: $$phase)"; \
	      $(KUBECTL_BASE) get pvc "$$pvc" 2>&1 || true; \
	      $(KUBECTL_BASE) describe pvc "$$pvc" 2>&1 | tail -20 || true; \
	      exit 1; \
	    fi; \
	    echo "$(INFO) PVC $$pvc is Bound"; \
	  done; \
  echo "$(INFO) Testing /app/storage writability..."; \
  $(KUBECTL_BASE) delete pod storage-test --ignore-not-found 2>/dev/null || true; \
  $(KUBECTL_BASE) run storage-test --restart=Never --image=busybox:1.36 \
    --overrides='{"spec":{"volumes":[{"name":"storage","persistentVolumeClaim":{"claimName":"storage-pvc"}}],"containers":[{"name":"test","image":"busybox:1.36","command":["sh","-c","echo test > /mnt/test.txt && cat /mnt/test.txt && rm /mnt/test.txt && echo ok"],"volumeMounts":[{"name":"storage","mountPath":"/mnt"}]}]}}' >/dev/null 2>&1; \
  _ok=0; \
  for i in 1 2 3 4 5 6 7 8 9 10; do \
    _phase=$$($(KUBECTL_BASE) get pod storage-test -o jsonpath='{.status.phase}' 2>/dev/null || echo ""); \
    if [ "$$_phase" = "Succeeded" ] || [ "$$_phase" = "Completed" ]; then _ok=1; break; fi; \
    if [ "$$_phase" = "Failed" ]; then break; fi; \
    sleep 1; \
  done; \
  if [ "$$_ok" != "1" ] || ! $(KUBECTL_BASE) logs storage-test 2>&1 | grep -q ok; then \
    echo "$(ERR) /app/storage writability test failed"; \
    $(KUBECTL_BASE) logs storage-test 2>&1 || true; \
    $(KUBECTL_BASE) describe pod storage-test 2>&1 | tail -30 || true; \
    $(KUBECTL_BASE) delete pod storage-test --ignore-not-found 2>/dev/null || true; \
    exit 1; \
  fi; \
  $(KUBECTL_BASE) delete pod storage-test --ignore-not-found 2>/dev/null || true; \
	  echo "$(INFO) /app/storage writability OK"; \
	} $(call tee,validate-pvcs)

# Validate PostgreSQL is reachable and writable
.PHONY: _validate-postgres
_validate-postgres: _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Validating PostgreSQL connectivity..."; \
	  PGPASS=$$($(KUBECTL_BASE) get secret postgres-secret -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d); \
	  PGUSER=$$($(KUBECTL_BASE) get secret postgres-secret -o jsonpath='{.data.POSTGRES_USER}' | base64 -d); \
	  PGDB=$$($(KUBECTL_BASE) get secret postgres-secret -o jsonpath='{.data.POSTGRES_DB}' | base64 -d); \
	  $(KUBECTL_BASE) run pg-test --rm -i --restart=Never --image=postgres:16-alpine -- \
	    sh -c "PGPASSWORD=$$PGPASS psql -h postgres -U $$PGUSER -d $$PGDB -c 'CREATE TABLE IF NOT EXISTS _kumbi_test (id serial PRIMARY KEY, created_at timestamptz DEFAULT now()); INSERT INTO _kumbi_test DEFAULT VALUES; SELECT count(*) FROM _kumbi_test; DROP TABLE _kumbi_test;'" \
	    2>/dev/null || { echo "$(ERR) PostgreSQL read/write test failed"; exit 1; }; \
	  echo "$(INFO) PostgreSQL connectivity OK"; \
	} $(call tee,validate-postgres)

# ════════════════════════════════════════════════════════════════════════════
# TLS — mkcert for dev/test, explicit external for staging/prod
# ═══════════════════════════════════════════════════════════════════════════

.PHONY: tls tls-check

# Certificate status check.
tls-check: _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  case "$(ENV)" in \
	    prod) \
	      echo "$(INFO) TLS: handled externally (no in-cluster certificates)."; \
	      ;; \
	    dev|test) \
	      echo "$(INFO) $(ENV) uses mkcert (locally managed). Checking secret kumbi-tls..."; \
	      bash scripts/check-tls.sh "$(NAMESPACE)" kumbi-tls ;; \
	    staging) \
	      echo "$(INFO) staging uses external TLS (no cert-manager). Checking secret kumbi-tls..."; \
	      bash scripts/check-tls.sh "$(NAMESPACE)" kumbi-tls ;; \
	  esac; \
  	} $(call tee,tls-check)

FORCE ?= false

.PHONY: tls certs tls-force force
tls: _ensure-context _ensure-envsubst ensure-tools
	@mkdir -p $(LOGS_DIR) && { \
	  case "$(ENV)" in \
	    prod) \
	      echo "$(INFO) TLS: handled externally (no in-cluster certificates)."; \
	      echo "$(INFO) Run your external certificate provisioning (e.g., cert-manager, Let's Encrypt, cloud provider) and ensure secret 'kumbi-tls' exists in namespace $(NAMESPACE)."; \
	      exit 0; \
	      ;; \
	    staging) \
	      echo "$(INFO) Staging uses external TLS. Ensure secret 'kumbi-tls' exists in $(NAMESPACE)."; \
	      exit 0; \
	      ;; \
	    dev|test) \
	      echo "$(INFO) Provisioning TLS certificate for $(DOMAIN) (ENV=$(ENV)) via mkcert..."; \
	      cert_secret=kumbi-tls; \
	      if [ "$(FORCE)" = "true" ]; then \
	        echo "$(INFO) FORCE: removing existing secret $$cert_secret (if any)..."; \
	        $(KUBECTL_BASE) delete secret $$cert_secret --ignore-not-found; \
	      elif $(KUBECTL_BASE) get secret $$cert_secret >/dev/null 2>&1; then \
	        _regen=0; \
	        if command -v openssl >/dev/null 2>&1; then \
	          _san=$$( $(KUBECTL_BASE) get secret $$cert_secret -o jsonpath='{.data.tls\.crt}' 2>/dev/null \
	                    | base64 -d 2>/dev/null | openssl x509 -noout -ext subjectAltName 2>/dev/null || true ); \
	          if printf '%s' "$$_san" | grep -q "DNS:$(DOMAIN)" && printf '%s' "$$_san" | grep -q "DNS:api.$(DOMAIN)"; then \
	            echo "$(WARN) Secret $$cert_secret already exists for $(DOMAIN) — NOT overwriting."; \
	            echo "$(WARN) Run 'make tls FORCE=true' to re-issue."; \
	            exit 0; \
	          else \
	            echo "$(WARN) Secret $$cert_secret exists but is NOT for $(DOMAIN) — regenerating..."; \
	            _regen=1; \
	          fi; \
	        else \
	          echo "$(WARN) Secret $$cert_secret already exists in $(NAMESPACE) — NOT overwriting (openssl unavailable to verify)."; \
	          echo "$(WARN) Run 'make tls FORCE=true' to re-issue."; \
	          exit 0; \
	        fi; \
	        if [ "$$_regen" = "1" ]; then \
	          $(KUBECTL_BASE) delete secret $$cert_secret --ignore-not-found; \
	        fi; \
	      fi; \
	      echo "$(INFO) Provisioning TLS certificate for $(DOMAIN) (ENV=$(ENV)) via mkcert..."; \
	      scripts/generate-mkcert.sh "$(ENV)" "$(NAMESPACE)"; \
	      ;; \
	    *) \
	      echo "$(WARN) Unknown environment: $(ENV). Skipping TLS provisioning."; exit 1 ;; \
	  esac; \
	  echo "$(INFO) TLS provisioning complete for $(ENV)."; \
	} $(call tee,tls)

tls-force:
	@$(MAKE) tls FORCE=true

force:
	@$(MAKE) tls FORCE=true

.PHONY: certs
certs: tls
	@true
# ══════════════════════════════════════════════════════════════════════════════
# Build
# ══════════════════════════════════════════════════════════════════════════════

_build-backend:
	@$(call build-image,$(BACKEND_IMG),./backend,)

API_BUILD_ARG := $(if $(API_URL),--build-arg VITE_API_BASE_URL=$(API_URL),)

_build-frontend:
	@$(call build-image,$(FRONTEND_IMG),./frontend,$(API_BUILD_ARG))

.PHONY: buildkit-clean build
build:
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Building images for ENV=$(ENV) IMG=$(IMG)..."; \
	 echo "$(INFO) Build tool: $(BUILD_TOOL) | Buildkit: $(BUILDKIT_ADDR) (host: $(USE_HOST_BUILDKIT), in-cluster: $(if $(BUILDKIT_TCP_ADDR),yes,no))"; \
	  if [ "$(USE_BUILDKIT)" != "yes" ]; then \
	    echo "$(ERR) No buildkitd available (host: /run/buildkit/buildkitd.sock or in-cluster: $(BUILDKIT_NS)/$(BUILDKIT_SVC):$(BUILDKIT_PORT))"; \
	    echo "  Host fix: sudo systemctl restart buildkit && journalctl -u buildkit -f"; \
	    echo "  In-cluster fix: kubectl -n $(BUILDKIT_NS) get pods,svc"; \
	    exit 1; \
	  fi; \
	  case "$(IMG)" in \
	    all) \
	      echo "$(INFO) Building backend..."; \
	      $(MAKE) _build-backend IMG=all NOCACHE=$(NOCACHE); \
	      echo "$(INFO) Building frontend..."; \
	      $(MAKE) _build-frontend IMG=all NOCACHE=$(NOCACHE) ;; \
	    backend) $(MAKE) _build-backend IMG=backend NOCACHE=$(NOCACHE) ;; \
	    frontend) $(MAKE) _build-frontend IMG=frontend NOCACHE=$(NOCACHE) ;; \
	    *) echo "$(WARN) Unknown IMG=$(IMG). Use: all, backend, frontend"; exit 1 ;; \
	  esac; \
} $(call tee,build)

# ══════════════════════════════════════════════════════════════════════════════
# Deploy — nuke → provision → build → apply kustomize → wait
# ═════════════════════════════════════════════════════════════════════════════

# Render the kustomized overlay, resolving ${DOMAIN} (kubectl kustomize output is
# piped through envsubst before apply). The public hostname comes from the
# overlay's secrets.yaml (kumbi-app-config) via the Makefile config block, so the
# Ingress hostname is configured in secrets.yaml. envsubst is given an explicit
# variable list so secret values (which may contain '$') are never touched.
_kustomize = DOMAIN="$(DOMAIN)" $(KUBECTL) kustomize $(OVERLAY) 2>/dev/null | envsubst '$${DOMAIN}'

# PRESERVE=true spares PVCs, PVs, and TLS certificates during deploy nuke.
PRESERVE ?= false

.PHONY: deploy
deploy: check-config ensure-tools _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Deploying ENV=$(ENV) PRESERVE=$(PRESERVE)..."; \
	  if [ "$(PRESERVE)" != "true" ]; then \
	    echo "$(INFO) Nuking existing resources in $(NAMESPACE)..."; \
	    $(MAKE) nuke ENV=$(ENV); \
	    $(MAKE) _ensure-pstorage ENV=$(ENV); \
	    echo "$(INFO) Ensuring namespace $(NAMESPACE)..."; \
	    $(KUBECTL) create namespace $(NAMESPACE) --dry-run=client -o yaml | $(KUBECTL) apply -f - >/dev/null 2>&1; \
	    if [ "$(ENV)" != "prod" ]; then \
	      $(MAKE) tls ENV=$(ENV) || echo "$(WARN) TLS provisioning skipped/failed — run 'make tls ENV=$(ENV)' after deploy"; \
	    fi; \
	  else \
	    echo "$(INFO) PRESERVE=true — skipping nuke and storage/TLS provisioning"; \
	  fi; \
$(MAKE) _ensure-ingress ENV=$(ENV); \
  $(MAKE) _ensure-hostroute ENV=$(ENV); \
  if [ "$(PRESERVE)" != "true" ]; then \
    $(MAKE) _ensure-pvs ENV=$(ENV); \
  fi; \
  $(MAKE) buildkit ENV=$(ENV) || { echo "$(ERR) Buildkit unavailable — aborting deploy" >&2; exit 1; }; \
  $(MAKE) build ENV=$(ENV) || { echo "$(ERR) Image build failed — aborting deploy" >&2; exit 1; }; \
  echo "$(INFO) Ensuring namespace $(NAMESPACE)..."; \
  $(KUBECTL_BASE) create namespace $(NAMESPACE) --dry-run=client -o yaml | $(KUBECTL) apply -f - >/dev/null 2>&1; \
  echo "$(INFO) Applying kustomize overlay..."; \
  $(_kustomize) | $(KUBECTL_BASE) apply -f -; \
  $(MAKE) _validate-pvcs ENV=$(ENV) || { echo "$(ERR) PVC validation failed — aborting deploy" >&2; exit 1; }; \
  echo "$(INFO) === Front door: waiting for Traefik (up to $(TRAEFIK_WAIT_TIMEOUT)s)..."; \
  $(MAKE) _wait-ingress ENV=$(ENV) || { echo "$(ERR) Traefik not ready — aborting deploy" >&2; exit 1; }; \
  echo "$(INFO) === Step 1/3: Force-replacing Postgres..."; \
  $(call force-rollout,postgres,30s); \
  echo "$(INFO) === Step 2/3: Force-replacing Backend..."; \
  $(call force-rollout,backend,60s); \
  echo "$(INFO) === Step 3/3: Force-replacing Frontend..."; \
  $(call force-rollout,frontend,45s); \
  $(MAKE) _validate-postgres ENV=$(ENV) || { echo "$(ERR) PostgreSQL validation failed" >&2; exit 1; }; \
  echo "$(INFO) Deploy complete — ENV=$(ENV)."; \
  $(MAKE) _report-ports ENV=$(ENV); \
  $(MAKE) status ENV=$(ENV); \
	} $(call tee,deploy)

# ══════════════════════════════════════════════════════════════════════════════
# Refresh — rebuild → apply kustomize (no waiting)
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: refresh
refresh: check-config _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Refreshing ENV=$(ENV) IMG=$(IMG)..."; \
	  $(MAKE) buildkit ENV=$(ENV) || { echo "$(ERR) Host buildkitd required" >&2; exit 1; }; \
	  $(MAKE) build ENV=$(ENV) IMG=$(IMG) NOCACHE=$(NOCACHE); \
	  echo "$(INFO) Ensuring namespace $(NAMESPACE)..."; \
	  $(KUBECTL) create namespace $(NAMESPACE) --dry-run=client -o yaml | $(KUBECTL) apply -f - >/dev/null 2>&1; \
	  echo "$(INFO) Applying kustomize overlay..."; \
	  $(_kustomize) | $(KUBECTL) apply -f -; \
	  echo "$(INFO) Front door: waiting for Traefik (up to $(TRAEFIK_WAIT_TIMEOUT)s)..."; \
	  $(MAKE) _wait-ingress ENV=$(ENV) || { echo "$(ERR) Traefik not ready — aborting refresh" >&2; exit 1; }; \
	  echo "$(INFO) Rolling out for IMG=$(IMG)..."; \
	  case "$(IMG)" in \
	    all|backend) $(call force-rollout,backend,60s) ;; \
	  esac; \
	  case "$(IMG)" in \
	    all|frontend) $(call force-rollout,frontend,45s) ;; \
	  esac; \
	  echo "$(INFO) Refresh complete — ENV=$(ENV) IMG=$(IMG)."; \
	  $(MAKE) _report-ports ENV=$(ENV); \
	} $(call tee,refresh)

_wait-backend:
	@$(KUBECTL_BASE) rollout status deployment/backend --timeout=45s

_wait-frontend:
	@$(KUBECTL_BASE) rollout status deployment/frontend --timeout=30s

# Force-replace a deployment's pods: terminate the existing pods so the
# ReplicaSet schedules brand-new ones. This guarantees the freshly-built image
# is used even when the tag is unchanged (e.g. :dev). Usage:
#   $(call force-rollout,<app>,<timeout>)
define force-rollout
	echo "$(INFO) Force-replacing $(1) pods..."; \
	$(KUBECTL_BASE) delete pods -l app=$(1) --ignore-not-found --force --grace-period=0 2>/dev/null || true; \
	$(KUBECTL_BASE) wait --for=condition=Ready pod -l app=$(1) --timeout=$(2) 2>/dev/null || echo "$(WARN) $(1) pods not ready within $(2)"
endef

# ══════════════════════════════════════════════════════════════════════════════
# Granular deploy targets
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: deploy-backend deploy-frontend deploy-postgres

deploy-backend: check-config _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Deploying backend for ENV=$(ENV)..."; \
	  $(call force-rollout,backend,180s); \
	  echo "$(INFO) Backend deployed"; \
	} 2>&1 | tee $(call logfile,deploy-backend)

deploy-frontend: check-config _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Deploying frontend for ENV=$(ENV)..."; \
	  $(call force-rollout,frontend,180s); \
	  echo "$(INFO) Frontend deployed"; \
	} 2>&1 | tee $(call logfile,deploy-frontend)

deploy-postgres: check-config _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Deploying postgres for ENV=$(ENV)..."; \
	  $(call force-rollout,postgres,180s); \
	  echo "$(INFO) Postgres deployed"; \
	} 2>&1 | tee $(call logfile,deploy-postgres)

# ══════════════════════════════════════════════════════════════════════════════
# Retry — restart failing pods
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: retry
retry: check-config _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Retrying failed resources for ENV=$(ENV)..."; \
	  echo "$(INFO) Step 1: Restarting deployments that are not fully available..."; \
	  for dep in backend frontend postgres; do \
	    ready=$$($(KUBECTL_BASE) get deployment/$$dep -o jsonpath='{.status.readyReplicas}' 2>/dev/null); \
	    desired=$$($(KUBECTL_BASE) get deployment/$$dep -o jsonpath='{.status.replicas}' 2>/dev/null); \
	    if [ "$$ready" != "$$desired" ] 2>/dev/null; then \
	      echo "  → $$dep: $${ready:-0}/$${desired:-0} ready — restarting..."; \
	      $(call force-rollout,$$dep,60s); \
	    else echo "  ✓ $$dep: $${ready:-0}/$${desired:-0} ready"; fi; \
	  done; \
	  echo "$(INFO) Step 2: Final status..."; \
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
	  $(call force-rollout,backend,180s); \
	  echo "$(INFO) Migrations complete"; \
	} 2>&1 | tee $(call logfile,migrate)

seed: check-config _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Seeding database via backend startup (migration + seed)..."; \
	  $(call force-rollout,backend,60s); \
	  echo "$(INFO) Seeding complete — check logs: $(KUBECTL_BASE) logs -l app=backend --tail=20"; \
	} 2>&1 | tee $(call logfile,seed)

# ══════════════════════════════════════════════════════════════════════════════
# Rollout — selective restart by container name
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: rollout restart
restart: rollout
rollout: _ensure-context
	@mkdir -p $(LOGS_DIR) && { \
	  echo "$(INFO) Rolling out CONTAINER=$(or $(CONTAINER),all) for ENV=$(ENV)..."; \
	  if [ -n "$(ROLL_IMG)" ]; then \
	    echo "$(INFO) Image: $(ROLL_IMG)"; \
	  fi; \
	  case "$(CONTAINER)" in \
	    backend|postgres|frontend) \
	      echo "$(INFO) Force-replacing $(CONTAINER)..."; \
	      $(call force-rollout,$(CONTAINER),60s); \
	    ;; \
	    all) \
	      for app in backend frontend postgres; do \
	        if $(KUBECTL_BASE) get deployment/$$app &>/dev/null; then \
	          echo "  → $$app"; \
	          $(call force-rollout,$$app,60s); \
	        fi; \
	      done ;; \
	    *) echo "$(WARN) Unknown container: $(CONTAINER)"; exit 1 ;; \
	  esac; \
	  echo "$(INFO) Rollout complete — ENV=$(ENV)"; \
	  $(MAKE) _report-ports ENV=$(ENV); \
	} $(call tee,rollout)

# ══════════════════════════════════════════════════════════════════════════════
# Ingress ports — how host traffic reaches the services
# ══════════════════════════════════════════════════════════════════════════════

# Report the front-door mapping: Traefik (kube-system, LoadBalancer via servicelb)
# host ports 80/443 → Ingress (traefik) → services.
.PHONY: _report-ports
_report-ports: _ensure-context
	@echo "$(BOLD)═══ Ingress front-door (Traefik + servicelb) — $(ENV) ═══$(RESET)"; \
	echo "  Public host : $(GATEWAY_HOST)"; \
	echo "  Traefik     : namespace $(TRAEFIK_NS), service $(TRAEFIK_SVC) (LoadBalancer via servicelb) ports http=$(INGRESS_HTTP_PORT) https=$(INGRESS_HTTPS_PORT)"; \
	echo "  CNI / LB    : flannel + servicelb (klipper-lb) — default k3s"; \
	echo ""; \
	echo "  https://$(GATEWAY_HOST)/        → $(INGRESS_HTTPS_PORT) → frontend:80"; \
	echo "  https://$(GATEWAY_HOST)/api     → $(INGRESS_HTTPS_PORT) → backend:8080"; \
	echo "  https://api.$(GATEWAY_HOST)/     → $(INGRESS_HTTPS_PORT) → backend:8080"

# ══════════════════════════════════════════════════════════════════════════════
# Ports — show all ingress/egress configuration for the namespace
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: ports
ports: _ensure-context
	@echo "$(BOLD)═══ Ingress / Egress — $(ENV) / $(NAMESPACE) ═══$(RESET)"; \
	echo ""; \
	echo "$(BOLD)Traefik (kube-system, LoadBalancer via servicelb):$(RESET)"; \
	$(KUBECTL) -n $(TRAEFIK_NS) get pods,svc -o wide 2>/dev/null || echo "  (none)"; \
	$(KUBECTL) -n kube-system get svc traefik -o wide 2>/dev/null || true; \
	echo ""; \
	echo "$(BOLD)Host ingress ports (kumbi-app-config — Traefik LB):$(RESET)"; \
	echo "  HTTP  → $(INGRESS_HTTP_PORT)"; \
	echo "  HTTPS → $(INGRESS_HTTPS_PORT)"; \
	echo ""; \
	echo "$(BOLD)Ingress routes (ingressClass: traefik):$(RESET)"; \
	$(KUBECTL_BASE) get ingress -o wide 2>/dev/null || echo "  (none)"; \
	echo ""; \
	echo "$(BOLD)IngressClasses:$(RESET)"; \
	$(KUBECTL) get ingressclass -o wide 2>/dev/null || echo "  (none)"; \
	echo ""; \
	echo "$(BOLD)Services (ClusterIP):$(RESET)"; \
	$(KUBECTL_BASE) get services -o wide 2>/dev/null || echo "  (none)"; \
	echo ""; \
	echo "$(BOLD)Endpoints:$(RESET)"; \
	$(KUBECTL_BASE) get endpoints -o wide 2>/dev/null || echo "  (none)"; \
	echo ""

# ══════════════════════════════════════════════════════════════════════════════
# Apply — render and apply the kustomize overlay
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: apply
apply: _ensure-context _ensure-envsubst
	@echo "$(INFO) Applying kustomize overlay $(OVERLAY) to $(NAMESPACE)..."; \
	$(KUBECTL_BASE) create namespace $(NAMESPACE) --dry-run=client -o yaml | $(KUBECTL) apply -f - >/dev/null 2>&1; \
	$(_kustomize) | $(KUBECTL_BASE) apply -f -; \
	echo "$(INFO) Apply complete."

# ══════════════════════════════════════════════════════════════════════════════
# Logs / Describe / Exec
# ══════════════════════════════════════════════════════════════════════════════

CTL_TARGET = $(if $(filter all,$(CONTAINER)),backend,$(CONTAINER))

.PHONY: logs
logs: _ensure-context
	$(KUBECTL_BASE) logs -l app=$(CTL_TARGET) --tail=100 -f

.PHONY: describe
describe: _ensure-context
	$(KUBECTL_BASE) describe deployment/$(CTL_TARGET)

.PHONY: exec
exec: _ensure-context
	$(KUBECTL_BASE) exec -it deployment/$(CTL_TARGET) -- /bin/sh

# ══════════════════════════════════════════════════════════════════════════════
# Cluster status — sub-targets: status-pods, status-ingress, etc.
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: status status-nodes status-pods status-pv status-deployments status-services \
        status-jobs status-configmaps status-secrets status-ingress status-all \
        nodes ingress

status: _ensure-context status-all

status-all: status-nodes status-pv status-deployments status-services status-jobs \
            status-configmaps status-secrets status-ingress status-pods ingress
	@true

status-nodes: _ensure-context
	@echo "$(BOLD)Nodes:$(RESET)"
	@$(KUBECTL) get nodes -o wide 2>&1 || true
	@echo ""

status-pods: _ensure-context
	@echo "$(BOLD)Pods:$(RESET)"
	@$(KUBECTL_BASE) get pods -o wide 2>&1 || true
	@echo ""

status-pv: _ensure-context
	@echo "$(BOLD)Persistent Volumes & Claims:$(RESET)"
	@$(KUBECTL) get pv -o wide 2>&1 || true
	@$(KUBECTL_BASE) get pvc -o wide 2>&1 || true
	@echo ""

status-deployments: _ensure-context
	@echo "$(BOLD)Deployments:$(RESET)"
	@$(KUBECTL_BASE) get deployments -o wide 2>&1 || true
	@echo ""

status-services: _ensure-context
	@echo "$(BOLD)Services:$(RESET)"
	@$(KUBECTL_BASE) get services -o wide 2>&1 || true
	@echo ""

status-jobs: _ensure-context
	@echo "$(BOLD)Jobs & CronJobs:$(RESET)"
	@$(KUBECTL_BASE) get jobs,cronjobs -o wide 2>&1 || true
	@echo ""

status-configmaps: _ensure-context
	@echo "$(BOLD)ConfigMaps:$(RESET)"
	@$(KUBECTL_BASE) get configmaps 2>&1 || true
	@echo ""

status-secrets: _ensure-context
	@echo "$(BOLD)Secrets:$(RESET)"
	@$(KUBECTL_BASE) get secrets 2>&1 || true
	@echo ""

status-ingress: _ensure-context
	@echo "$(BOLD)Traefik (kube-system):$(RESET)"
	@$(KUBECTL) -n $(TRAEFIK_NS) get pods,deploy,svc -o wide 2>&1 || true
	@echo ""
	@echo "$(BOLD)Ingress / IngressClass (traefik):$(RESET)"
	@$(KUBECTL_BASE) get ingress -o wide 2>&1 || true
	@$(KUBECTL) get ingressclass -o wide 2>&1 || true
	@echo ""

nodes: _ensure-context
	@$(call log,Kubernetes nodes:)
	@$(KUBECTL) get nodes -o wide

ingress: _ensure-context
	@$(KUBECTL) -n $(TRAEFIK_NS) get pods,svc -o wide 2>&1 || true
	@$(KUBECTL_BASE) get ingress -o wide 2>&1 || true
	@$(KUBECTL) get ingressclass traefik -o wide 2>&1 || true

.PHONY: nuke teardown
nuke: _ensure-context
	@echo "$(INFO) Wiping namespace $(NAMESPACE) (PRESERVE=$(PRESERVE))..."; \
	$(KUBECTL_BASE) get ingresses -o name 2>/dev/null | \
	  xargs -r $(KUBECTL_BASE) patch -p '{"metadata":{"finalizers":null}}' --type=merge 2>/dev/null || true; \
	if [ "$(PRESERVE)" != "true" ]; then \
	  $(KUBECTL_BASE) get pvc -o name 2>/dev/null | \
	    xargs -r $(KUBECTL_BASE) patch -p '{"metadata":{"finalizers":null}}' --type=merge 2>/dev/null || true; \
	fi; \
	$(KUBECTL_BASE) delete ingresses --all --ignore-not-found --timeout=10s 2>/dev/null || true; \
	$(KUBECTL_BASE) delete deployments,services,configmaps,jobs,cronjobs,endpoints,serviceaccounts,roles,rolebindings --all --ignore-not-found --timeout=10s 2>/dev/null || true; \
	if [ "$(PRESERVE)" != "true" ]; then \
	  $(KUBECTL_BASE) delete secrets --all --ignore-not-found --timeout=10s 2>/dev/null || true; \
	  $(KUBECTL_BASE) delete pvc --all --force --grace-period=0 --timeout=10s 2>/dev/null || true; \
	  $(KUBECTL_BASE) delete pv kumbi-postgres-pv kumbi-storage-pv --ignore-not-found --timeout=10s 2>/dev/null || true; \
	  echo "$(INFO) PVCs, PVs, and secrets deleted (host data dirs kept, PVs recreated by next deploy)."; \
	else \
	  $(KUBECTL_BASE) delete secrets --field-selector type!=kubernetes.io/tls --all --ignore-not-found --timeout=10s 2>/dev/null || true; \
	  echo "$(INFO) PVCs, PVs, and TLS certificates preserved."; \
	fi; \
	$(KUBECTL_BASE) delete pods --all --force --grace-period=0 --timeout=10s 2>/dev/null || true; \
	echo "$(INFO) Waiting for pods to terminate..."; \
	for i in 1 2 3 4 5; do \
	  count=$$($(KUBECTL_BASE) get pods --no-headers 2>/dev/null | wc -l); \
	  if [ "$$count" = "0" ]; then break; fi; \
	  echo "  $(WARN) $$count pods remaining..."; \
	  sleep 1; \
	done; \
	echo "$(INFO) Namespace $(NAMESPACE) wiped."

teardown: _ensure-context
	@read -rp "Delete namespace $(NAMESPACE) from $(ENV) cluster? [y/N] " confirm; \
	  [[ "$$confirm" =~ ^[Yy]$$ ]] || { echo "Aborted"; exit 0; }; \
	  $(KUBECTL) delete namespace $(NAMESPACE) --ignore-not-found; \
	  $(KUBECTL) delete pv kumbi-postgres-pv kumbi-storage-pv --ignore-not-found 2>/dev/null || true; \
	  echo "PVs removed — host data dirs kept on disk (delete /home/ndiku/code/volumes/kumbi manually to free space)."
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
	  echo "--- k8s all resources ---"; $(KUBECTL_BASE) get all 2>&1; \
	  echo ""; \
	  echo "--- k8s configmaps ---"; $(KUBECTL_BASE) get configmap -o yaml 2>&1; \
	  echo ""; \
	  echo "--- k8s events (recent) ---"; $(KUBECTL_BASE) get events --sort-by='.lastTimestamp' 2>&1 | tail -30; \
	  echo ""; \
	  echo "--- Backend describe ---"; $(KUBECTL_BASE) describe deployment/backend 2>&1 | head -60; \
	  echo ""; \
	  echo "--- Backend recent logs ---"; $(KUBECTL_BASE) logs -l app=backend --tail=30 2>&1; \
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
	  --exclude='logs' \
	  ./ $(PROD_HOST):$(REMOTE_DEST)/

remote: sync
	$(call log,Running 'make $(CMD) ENV=$(or $(ENV),prod)' on $(PROD_HOST)...)
	ssh $(PROD_HOST) "cd $(REMOTE_DEST) && make $(CMD) ENV=$(or $(ENV),prod)"

# ══════════════════════════════════════════════════════════════════════════════
# Scaling
# ══════════════════════════════════════════════════════════════════════════════
# BACKEND_REPLICAS / FRONTEND_REPLICAS are read from kumbi-app-config (see above).

.PHONY: scale scale-up scale-down

scale: _ensure-context
	$(KUBECTL_BASE) scale deployment/backend  --replicas=$(BACKEND_REPLICAS)
	$(KUBECTL_BASE) scale deployment/frontend --replicas=$(FRONTEND_REPLICAS)
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
	@{ \
	  PGUSER=$$(scripts/yaml-get.sh "$(SECRETS)" postgres-secret POSTGRES_USER 2>/dev/null); \
	  PGPASS=$$(scripts/yaml-get.sh "$(SECRETS)" postgres-secret POSTGRES_PASSWORD 2>/dev/null); \
	  PGDB=$$(scripts/yaml-get.sh "$(SECRETS)" postgres-secret POSTGRES_DB 2>/dev/null); \
	  JWT=$$(scripts/yaml-get.sh "$(SECRETS)" backend-secret JWT_SECRET 2>/dev/null); \
	  HOST=$${POSTGRES_HOST:-localhost}; \
	  cd backend && \
	    POSTGRES_USER="$$PGUSER" \
	    POSTGRES_PASSWORD="$$PGPASS" \
	    POSTGRES_DB="$$PGDB" \
	    POSTGRES_HOST="$$HOST" \
	    JWT_SECRET="$$JWT" \
	    go run ./cmd/seed create-user "$(NAME)" "$(EMAIL)" "$(PASS)" "$(or $(ROLE),admin)"; \
	}

# ══════════════════════════════════════════════════════════════════════════════
# Docker Compose (local tooling helper)
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: compose-up compose-down compose-logs
compose-up:   ; $(BUILD_TOOL) compose up --build -d
compose-down: ; $(BUILD_TOOL) compose down
compose-logs: ; $(BUILD_TOOL) compose logs -f
