#!/usr/bin/env bash
# scripts/check-config.sh — validate secrets.yaml before deploying.
# Usage: check-config.sh <secrets.yaml> [env] [overlay-dir]
# Exit 0 = ok, 1 = validation failed, 2 = unrecoverable error (timeout, missing file).
set -uo pipefail

TIMEOUT=30
FILE="${1:?usage: check-config.sh <secrets.yaml> [env] [overlay-dir]}"
ENV="${2:-}"
OVERLAY="${3:-}"
ERRORS=()

if ! [[ -f "$FILE" ]]; then
  echo "FAIL  $FILE: not found"
  exit 2
fi

if ! command -v timeout &>/dev/null; then
  echo "FAIL  'timeout' command not available — cannot enforce ${TIMEOUT}s limit"
  exit 2
fi

# ── Extract key=value pairs from the YAML ───────────────────────────────
# Parses multi-document YAML of the form:
#   ---
#   metadata:
#     name: <secret-name>
#   stringData:
#     KEY: value
#   ---
# Output: secretName/KEY=value  (one per line)
#
# We use a short Python script when PyYAML is available (accurate),
# otherwise fall back to awk (handles the simple structure we use).
extract_kv() {
  if python3 -c "import yaml" 2>/dev/null; then
    timeout "$TIMEOUT" python3 - "$FILE" <<'PYEOF'
import sys, yaml
with open(sys.argv[1]) as f:
    for doc in yaml.safe_load_all(f):
        if doc is None:
            continue
        name = (doc.get("metadata") or {}).get("name", "")
        data = doc.get("stringData", {}) or {}
        if name:
            for k, v in data.items():
                print("{}/{}={}".format(name, k, v or ""))
PYEOF
  else
    # awk fallback — assumes the simple YAML structure we actually use.
    timeout "$TIMEOUT" awk '
      /^---/ { secret=""; next }
      /^[[:space:]]*name:[[:space:]]/ { secret=$2; next }
      secret && /^[[:space:]]+[A-Z_]+:/ {
        split($0, a, ":")
        key = a[1]; sub(/^[[:space:]]+/, "", key)
        val = substr($0, index($0, ":") + 2)
        gsub(/^["\x27]|["\x27]$/, "", val)
        print secret "/" key "=" val
      }
    ' "$FILE"
  fi
}

output=$(extract_kv) || {
  echo "FAIL  Config check aborted (parse error or timeout after ${TIMEOUT}s)"
  exit 2
}

# Build associative array: secretName/key -> value
declare -A kv
while IFS='=' read -r key value; do
  kv["$key"]="$value"
done < <(echo "$output")

# ── Helper: check a key exists and is non-empty ──────────────────────────
check_key() {
  local val="${kv[$1/$2]:-}"
  if [[ -z "$val" ]]; then
    ERRORS+=("$1/$2 is missing or empty")
    return 1
  fi
}

# ── Helper: reject placeholder values ────────────────────────────────────
reject_placeholder() {
  local val="${kv[$1/$2]:-}"
  local raw
  raw=$(echo "$val" | tr '[:upper:]' '[:lower:]')
  if [[ "$raw" == "change_me"* ]]; then
    ERRORS+=("$1/$2 still has CHANGE_ME placeholder")
    return 1
  fi
}

# ── Helper: reject weak passwords ────────────────────────────────────────
check_password() {
  local val="${kv[$1/$2]:-}"
  if [[ -z "$val" ]]; then
    return 0
  fi
  local raw
  raw=$(echo "$val" | tr '[:upper:]' '[:lower:]')
  for weak in "password" "12345678" "admin" "password123" "changeme" "p@ssw0rd"; do
    if [[ "$raw" == "$weak" ]]; then
      ERRORS+=("$1/$2 is a weak / guessable password")
      return 1
    fi
  done
}

# ── Helper: check that a file contains a given string ────────────────────
file_contains() {
  local file="$1" pattern="$2" label="$3"
  if ! [[ -f "$file" ]]; then
    ERRORS+=("$label: $file not found")
    return 1
  fi
  if ! grep -q "$pattern" "$file"; then
    ERRORS+=("$label: expected pattern '$pattern' not found in $file")
    return 1
  fi
}

# ── Validations ──────────────────────────────────────────────────────────

# 1. Detect which secrets exist
has_backend=0
has_postgres=0
while IFS='=' read -r key _; do
  case "$key" in
    backend-secret/*) has_backend=1 ;;
    postgres-secret/*) has_postgres=1 ;;
  esac
done < <(echo "$output")

if [[ "$has_backend" -eq 0 ]]; then
  ERRORS+=("backend-secret not found in $FILE")
fi
if [[ "$has_postgres" -eq 0 ]]; then
  ERRORS+=("postgres-secret not found in $FILE")
fi

# 3. backend-secret checks
if [[ "$has_backend" -eq 1 ]]; then
  check_key "backend-secret" "JWT_SECRET"
  check_key "backend-secret" "ALLOW_ORIGIN"
  check_key "backend-secret" "SEED_ADMIN_EMAIL"
  check_key "backend-secret" "SEED_ADMIN_PASSWORD"

  reject_placeholder "backend-secret" "JWT_SECRET"
  reject_placeholder "backend-secret" "SEED_ADMIN_PASSWORD"

  jwt="${kv[backend-secret/JWT_SECRET]:-}"
  if [[ -n "$jwt" ]] && [[ ${#jwt} -lt 32 ]]; then
    ERRORS+=("backend-secret/JWT_SECRET is only ${#jwt} chars — must be at least 32")
  fi

  check_password "backend-secret" "SEED_ADMIN_PASSWORD"
fi

# 4. postgres-secret checks
if [[ "$has_postgres" -eq 1 ]]; then
  check_key "postgres-secret" "POSTGRES_USER"
  check_key "postgres-secret" "POSTGRES_DB"
  check_key "postgres-secret" "POSTGRES_PASSWORD"

  reject_placeholder "postgres-secret" "POSTGRES_USER"
  reject_placeholder "postgres-secret" "POSTGRES_DB"
  reject_placeholder "postgres-secret" "POSTGRES_PASSWORD"

  check_password "postgres-secret" "POSTGRES_PASSWORD"
fi

# 5. Verify postgres-secret is shared by all DB consumers
BASE=""
if [[ -n "$OVERLAY" ]]; then
  # Derive base dir: overlays/<env>/.. -> base/
  BASE="${OVERLAY%/overlays/*}/base"
fi
if [[ -n "$BASE" ]] && [[ -d "$BASE" ]]; then
  # Every pod that needs DB creds must reference postgres-secret
  for df in postgres.yaml backend.yaml seed-job.yaml; do
    manifest="$BASE/$df"
    if [[ -f "$manifest" ]]; then
      if ! grep -q 'name: postgres-secret' "$manifest"; then
        ERRORS+=("$manifest does not reference postgres-secret (all DB consumers must use the same secret)")
      fi
    fi
  done
fi

# 6. Verify overlay image tag matches the environment
if [[ -n "$ENV" ]] && [[ -n "$OVERLAY" ]]; then
  kustomization="$OVERLAY/kustomization.yaml"
  if [[ -f "$kustomization" ]]; then
    for img in "kumbi/backend" "kumbi/frontend"; do
      overlay_tag=$(timeout "$TIMEOUT" awk -v img="$img" '
        /^images:/ { in_images=1; next }
        in_images && /^[[:space:]]*- name:/ { current=$NF }
        in_images && current == img && /newTag:/ {
          gsub(/^[[:space:]]*newTag:[[:space:]]*/, ""); print; exit
        }
      ' "$kustomization")
      if [[ -z "$overlay_tag" ]]; then
        ERRORS+=("$kustomization: no newTag found for $img")
      elif [[ "$overlay_tag" != "$ENV" ]]; then
        ERRORS+=("$kustomization: $img has newTag=$overlay_tag but ENV=$ENV (images built as $img:$ENV)")
      fi
    done
  fi
fi

# ── Report ───────────────────────────────────────────────────────────────
if [[ ${#ERRORS[@]} -eq 0 ]]; then
  echo "PASS  $FILE — all checks ok"
  exit 0
else
  echo "FAIL  $FILE — ${#ERRORS[@]} problem(s):"
  for err in "${ERRORS[@]}"; do
    echo "      • $err"
  done
  exit 1
fi
