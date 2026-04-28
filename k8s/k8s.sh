#!/usr/bin/env bash
# Kumbi Kubernetes management — delegates to dev/pod.sh or prod/deploy.sh
# Usage: ./k8s.sh <env> <command> [args...]
#   env: dev | prod
set -euo pipefail

ENV="${1:-help}"
COMMAND="${2:-help}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

case "$ENV" in
  dev)  shift; exec "$ROOT/dev/pod.sh"  "$@" ;;
  prod) shift; exec "$ROOT/prod/deploy.sh" "$@" ;;
  *)
    echo "Usage: $0 <env> <command> [args]"
    echo ""
    echo "  dev  <command>  - Podman pod (dev/test)"
    echo "  prod <command>  - microk8s / containerd (production)"
    echo ""
    echo "Dev commands:  up | down | logs [svc] | status | seed <email> <pass> | create-user <name> <email> <pass> [role]"
    echo "Prod commands: build | apply | rollout | status | seed | create-user <name> <email> <pass> [role] | teardown | deploy"
    ;;
esac
