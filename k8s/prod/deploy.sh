#!/usr/bin/env bash
# Kumbi production deployment on microk8s (containerd)
# Usage: ./deploy.sh {build|apply|rollout|status|seed|create-user|teardown|deploy}
set -euo pipefail

COMMAND="${1:-help}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
K8S_BASE="$ROOT/k8s/base"
K8S_PROD="$ROOT/k8s/prod"
SECRETS_FILE="$K8S_PROD/secrets.yaml"
REGISTRY="${REGISTRY:-localhost:32000}"
TAG="${TAG:-latest}"

log() { echo -e "\033[1;36m[k8s]\033[0m $*"; }
err() { echo -e "\033[1;31m[error]\033[0m $*" >&2; exit 1; }

command -v microk8s &>/dev/null || err "microk8s not found"
command -v podman   &>/dev/null || err "podman not found"

KUBECTL="microk8s kubectl"

check_secrets() {
  [[ -f "$SECRETS_FILE" ]] || err "Missing $SECRETS_FILE — copy secrets.yaml.example and fill in values"
  grep -q "CHANGE_ME" "$SECRETS_FILE" && err "$SECRETS_FILE still contains CHANGE_ME placeholders — fill in real values first"
}

build_and_import() {
  local name="$1" context="$2"; shift 2
  local img="${REGISTRY}/kumbi/${name}:${TAG}"
  log "Building $name..."
  podman build "$@" -t "$img" "$context"
  log "Importing $name into microk8s containerd..."
  podman save "$img" | microk8s ctr images import -
}

cmd_build() {
  build_and_import backend  "$BACKEND"
  build_and_import frontend "$FRONTEND" \
    --build-arg "VITE_API_BASE_URL=${VITE_API_BASE_URL:-}"
  log "Images built and imported"
}

cmd_apply() {
  check_secrets
  log "Applying manifests..."
  $KUBECTL apply -f "$K8S_BASE/namespace.yaml"
  $KUBECTL apply -f "$SECRETS_FILE"
  $KUBECTL apply -f "$K8S_BASE/postgres.yaml"
  $KUBECTL apply -f "$K8S_BASE/backend.yaml"
  $KUBECTL apply -f "$K8S_BASE/frontend.yaml"
  $KUBECTL apply -f "$K8S_BASE/ingress.yaml"
  log "Manifests applied"
}

cmd_rollout() {
  log "Rolling out..."
  $KUBECTL rollout restart deployment/backend  -n kumbi
  $KUBECTL rollout restart deployment/frontend -n kumbi
  $KUBECTL rollout status  deployment/backend  -n kumbi
  $KUBECTL rollout status  deployment/frontend -n kumbi
}

cmd_seed() {
  # Run the seed-admin Job (delete first if it already exists so it re-runs)
  $KUBECTL delete job seed-admin -n kumbi --ignore-not-found
  $KUBECTL apply -f "$K8S_BASE/seed-job.yaml"
  log "Waiting for seed job..."
  $KUBECTL wait --for=condition=complete job/seed-admin -n kumbi --timeout=60s
  $KUBECTL logs -n kumbi -l job-name=seed-admin
}

cmd_create_user() {
  # create-user <name> <email> <password> [role]
  [[ $# -lt 4 ]] && err "Usage: $0 create-user <name> <email> <password> [role]"
  local name="$2" email="$3" pass="$4" role="${5:-admin}"
  local pod
  pod=$($KUBECTL get pod -n kumbi -l app=backend -o jsonpath='{.items[0].metadata.name}')
  log "Creating user $email (role=$role)..."
  $KUBECTL exec -n kumbi "$pod" -- /app/seed create-user "$name" "$email" "$pass" "$role"
}

cmd_status() {
  $KUBECTL get pods,svc,ingress,jobs -n kumbi
}

cmd_teardown() {
  read -rp "Delete ALL kumbi resources from the cluster? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { log "Aborted"; exit 0; }
  $KUBECTL delete namespace kumbi
  log "Namespace kumbi deleted"
}

case "$COMMAND" in
  build)       cmd_build ;;
  apply)       cmd_apply ;;
  rollout)     cmd_rollout ;;
  status)      cmd_status ;;
  seed)        cmd_seed ;;
  create-user) cmd_create_user "$@" ;;
  teardown)    cmd_teardown ;;
  deploy)
    cmd_build
    cmd_apply
    cmd_rollout
    cmd_seed
    cmd_status
    ;;
  *)
    echo "Usage: $0 {build|apply|rollout|status|seed|create-user|teardown|deploy}"
    echo ""
    echo "  build        - Build images with podman and import into microk8s containerd"
    echo "  apply        - Apply Kubernetes manifests (validates secrets first)"
    echo "  rollout      - Restart deployments to pick up new images"
    echo "  status       - Show pods, services, ingress, and jobs"
    echo "  seed         - Run seed-admin Job (seeds admin@kumbi.local)"
    echo "  create-user  - Create a user: <name> <email> <password> [role]"
    echo "  teardown     - Delete all kumbi resources from the cluster"
    echo "  deploy       - build + apply + rollout + seed + status"
    echo ""
    echo "Environment variables:"
    echo "  REGISTRY            - Image registry (default: localhost:32000)"
    echo "  TAG                 - Image tag (default: latest)"
    echo "  VITE_API_BASE_URL   - Frontend API URL for build"
    ;;
esac
