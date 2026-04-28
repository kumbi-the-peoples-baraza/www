#!/usr/bin/env bash
# Kumbi dev/test environment using podman pods
# Usage: ./pod.sh {up|down|logs|status|seed|create-user}
set -euo pipefail

COMMAND="${1:-help}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
SECRETS_FILE="$(dirname "$0")/secrets.env"
POD_NAME="kumbi-dev"

log() { echo -e "\033[1;36m[pod]\033[0m $*"; }
err() { echo -e "\033[1;31m[error]\033[0m $*" >&2; exit 1; }

command -v podman &>/dev/null || err "podman not found"

# Load secrets.env — abort if missing
[[ -f "$SECRETS_FILE" ]] || err "Missing $SECRETS_FILE — copy secrets.env.example and fill in values"
# shellcheck source=/dev/null
set -a; source "$SECRETS_FILE"; set +a

# Validate required vars
for v in POSTGRES_PASSWORD DATABASE_URL JWT_SECRET PORT ENV VITE_API_BASE_URL; do
  [[ -n "${!v:-}" ]] || err "$v is not set in secrets.env"
done

pod_up() {
  log "Creating pod $POD_NAME..."
  podman pod exists "$POD_NAME" 2>/dev/null && podman pod rm -f "$POD_NAME"

  podman pod create \
    --name "$POD_NAME" \
    -p 5432:5432 \
    -p 8080:8080 \
    -p 5173:80

  # Postgres
  log "Starting postgres..."
  podman run -d \
    --pod "$POD_NAME" \
    --name "${POD_NAME}-postgres" \
    -e POSTGRES_DB=kumbi \
    -e POSTGRES_USER=kumbi \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -v kumbi-pgdata:/var/lib/postgresql/data \
    postgres:16-alpine

  # Wait for postgres
  log "Waiting for postgres..."
  for i in $(seq 1 20); do
    podman exec "${POD_NAME}-postgres" pg_isready -U kumbi &>/dev/null && break
    sleep 1
    [[ $i -eq 20 ]] && err "Postgres did not become ready"
  done

  # Build and run backend
  log "Building backend..."
  podman build -t kumbi/backend:dev "$BACKEND"

  log "Starting backend..."
  podman run -d \
    --pod "$POD_NAME" \
    --name "${POD_NAME}-backend" \
    -e DATABASE_URL="$DATABASE_URL" \
    -e JWT_SECRET="$JWT_SECRET" \
    -e PORT="${PORT:-8080}" \
    -e ENV="${ENV:-development}" \
    -e ALLOW_ORIGIN="${ALLOW_ORIGIN:-http://localhost:5173}" \
    -e STORAGE_PATH="${STORAGE_PATH:-/app/storage}" \
    ${SMTP_HOST:+-e SMTP_HOST="$SMTP_HOST"} \
    ${SMTP_PORT:+-e SMTP_PORT="$SMTP_PORT"} \
    ${SMTP_USER:+-e SMTP_USER="$SMTP_USER"} \
    ${SMTP_PASS:+-e SMTP_PASS="$SMTP_PASS"} \
    ${WHATSAPP_WEBHOOK_URL:+-e WHATSAPP_WEBHOOK_URL="$WHATSAPP_WEBHOOK_URL"} \
    -v kumbi-storage:"${STORAGE_PATH:-/app/storage}" \
    kumbi/backend:dev

  # Build and run frontend
  log "Building frontend..."
  podman build \
    --build-arg VITE_API_BASE_URL="${VITE_API_BASE_URL:-http://localhost:8080}" \
    -t kumbi/frontend:dev "$FRONTEND"

  log "Starting frontend..."
  podman run -d \
    --pod "$POD_NAME" \
    --name "${POD_NAME}-frontend" \
    kumbi/frontend:dev

  # Seed default admin
  log "Seeding default admin..."
  _seed_wait_backend
  podman exec "${POD_NAME}-backend" /app/seed admin \
    "${SEED_ADMIN_EMAIL:-admin@kumbi.local}" \
    "${SEED_ADMIN_PASSWORD:-K@r@k0r@m#}"

  log "Dev environment ready"
  log "  Frontend: http://localhost:5173"
  log "  Backend:  http://localhost:8080"
  log "  CMS:      http://localhost:5173/cms"
  log "  Admin:    ${SEED_ADMIN_EMAIL:-admin@kumbi.local}"
}

_seed_wait_backend() {
  for i in $(seq 1 20); do
    podman exec "${POD_NAME}-backend" /app/seed admin dummy@x.invalid skip 2>/dev/null | grep -q "upserted" && return || true
    # just check the process is up
    podman exec "${POD_NAME}-backend" true 2>/dev/null && return || true
    sleep 1
  done
}

pod_down() {
  log "Stopping pod $POD_NAME..."
  podman pod exists "$POD_NAME" 2>/dev/null && podman pod rm -f "$POD_NAME" || true
  log "Pod stopped"
}

pod_logs() {
  local svc="${2:-}"
  if [[ -n "$svc" ]]; then
    podman logs -f "${POD_NAME}-${svc}"
  else
    for c in postgres backend frontend; do
      echo "=== $c ===" && podman logs "${POD_NAME}-${c}" 2>&1 | tail -20 || true
    done
  fi
}

pod_status() {
  podman pod ps --filter "name=$POD_NAME"
  podman ps --filter "pod=$POD_NAME"
}

pod_seed() {
  local email="${2:-${SEED_ADMIN_EMAIL:-admin@kumbi.local}}"
  local pass="${3:-${SEED_ADMIN_PASSWORD:-}}"
  [[ -z "$pass" ]] && err "Usage: $0 seed <email> <password>"
  log "Seeding admin $email..."
  podman exec "${POD_NAME}-backend" /app/seed admin "$email" "$pass"
}

pod_create_user() {
  # create-user <name> <email> <password> [role]
  [[ $# -lt 4 ]] && err "Usage: $0 create-user <name> <email> <password> [role]"
  local name="$2" email="$3" pass="$4" role="${5:-admin}"
  log "Creating user $email (role=$role)..."
  podman exec "${POD_NAME}-backend" /app/seed create-user "$name" "$email" "$pass" "$role"
}

case "$COMMAND" in
  up)          pod_up ;;
  down)        pod_down ;;
  logs)        pod_logs "$@" ;;
  status)      pod_status ;;
  seed)        pod_seed "$@" ;;
  create-user) pod_create_user "$@" ;;
  *)
    echo "Usage: $0 {up|down|logs [svc]|status|seed [email] [pass]|create-user <name> <email> <pass> [role]}"
    echo ""
    echo "  up           - Build images and start pod (postgres, backend, frontend)"
    echo "  down         - Stop and remove pod"
    echo "  logs [svc]   - Show logs (postgres|backend|frontend)"
    echo "  status       - Show pod and container status"
    echo "  seed         - Seed/reset default admin (reads SEED_ADMIN_* from secrets.env)"
    echo "  create-user  - Create an admin user with a given role"
    ;;
esac
