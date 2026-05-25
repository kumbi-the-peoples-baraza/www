#!/usr/bin/env bash
# scripts/generate-secrets.sh — ensure DATABASE_URL is present in backend-secret.
# Reads POSTGRES_USER/PASSWORD/DB from postgres-secret, computes DATABASE_URL,
# and inserts/updates it in backend-secret. Idempotent.
# Usage: generate-secrets.sh <secrets.yaml>
set -uo pipefail

FILE="${1:?usage: generate-secrets.sh <secrets.yaml>}"
[[ -f "$FILE" ]] || {
    echo "FAIL  $FILE: not found"
    exit 1
}

# ── Extract PG vars from postgres-secret ────────────────────────────────────
pg_user=$(awk '
  /^---/ { sec=""; next }
  /name: postgres-secret/ { sec="postgres"; next }
  sec == "postgres" && /POSTGRES_USER:/ { print $2 }
' "$FILE")

pg_pass=$(awk '
  /^---/ { sec=""; next }
  /name: postgres-secret/ { sec="postgres"; next }
  sec == "postgres" && /POSTGRES_PASSWORD:/ { print $2 }
' "$FILE")

pg_db=$(awk '
  /^---/ { sec=""; next }
  /name: postgres-secret/ { sec="postgres"; next }
  sec == "postgres" && /POSTGRES_DB:/ { print $2 }
' "$FILE")

if [[ -z "$pg_user" || -z "$pg_pass" || -z "$pg_db" ]]; then
    echo "FAIL  Could not read POSTGRES_USER/PASSWORD/DB from $FILE (postgres-secret)"
    exit 1
fi

dsn="postgres://${pg_user}:${pg_pass}@postgres:5432/${pg_db}?sslmode=disable"

# ── Check / update DATABASE_URL in backend-secret ───────────────────────────
current=$(awk '
  /^---/ { sec=""; next }
  /name: backend-secret/ { sec="be"; next }
  sec == "be" && /DATABASE_URL:/ {
    split($0, a, ": ")
    val = substr($0, index($0, ": ") + 2)
    gsub(/^["\x27]|["\x27]$/, "", val)
    print val
  }
' "$FILE")

if [[ "$current" == "$dsn" ]]; then
    echo "PASS  $FILE — DATABASE_URL is up to date"
    exit 0
fi

# ── Insert or update DATABASE_URL ───────────────────────────────────────────
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

if [[ -z "$current" ]]; then
    # Insert DATABASE_URL after STORAGE_PATH (before SEED_ADMIN_EMAIL)
    awk -v dsn="$dsn" '
    /^---/ { sep++; print; next }
    sep == 0 { print; next }
    sep == 1 {
      if (/STORAGE_PATH:/) {
        print
        print "  DATABASE_URL: " dsn
        next
      }
      print; next
    }
    sep >= 2 { print }
  ' "$FILE" >"$tmp"
    echo "ADDED  DATABASE_URL to backend-secret in $FILE"
else
    # Replace existing DATABASE_URL value
    sed "s|^  DATABASE_URL: .*|  DATABASE_URL: $dsn|" "$FILE" >"$tmp"
    echo "UPDATED  DATABASE_URL in $FILE ($dsn)"
fi

cp "$tmp" "$FILE"
