#!/usr/bin/env bash
# scripts/setup.sh — Interactive k3s + buildkit setup for Kumbi.
#
# Installs default k3s stack (flannel vxlan + servicelb + traefik) with
# user-provided IP/token, then installs buildkitd (systemd on Linux,
# launchd/brew on macOS) pointing at k3s containerd, configures
# CONTAINERD_ADDRESS and the k3s embedded registry (5000) for buildkit.
#
# Usage:
#   bash scripts/setup.sh                    # interactive prompts
#   IP=10.100.0.1 TOKEN=xxx bash scripts/setup.sh   # non-interactive
#   make setup IP=10.100.0.1 TOKEN=xxx       # via Makefile
#
# The k3s install command matches the spec:
#   curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server \
#         --bind-address=IP \
#         --advertise-address=IP \
#         --node-ip=IP \
#         --flannel-backend=vxlan \
#         --kubelet-arg=rotate-certificates=true \
#         --tls-san=IP \
#         --write-kubeconfig-mode=644 \
#         --secrets-encryption \
#         --embedded-registry=true \
#         --token=TOKEN" sh -
# plus TLS SAN includes the hostname for convenience.
set -euo pipefail

# ── Colors / logging ───────────────────────────────────────────────────────
RED='\033[1;31m'
GREEN='\033[0;32m'
GOLD='\033[1;33m'
AZURE='\033[1;34m'
NC='\033[0m'
log()  { echo -e "${AZURE}[setup]${NC} $*"; }
warn() { echo -e "${GOLD}[!]${NC} $*"; }
fail() { echo -e "${RED}[error]${NC} $*"; }
ok()   { echo -e "${GREEN}[ok]${NC} $*"; }

# ── Detect OS / arch / package manager ───────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"
BUILDKIT_VERSION="${BUILDKIT_VERSION:-v0.32.2}"
K3S_REGISTRY_PORT="${K3S_REGISTRY_PORT:-5000}"

case "$ARCH" in
  x86_64|amd64) ARCH_GO=amd64; ARCH_BK=amd64 ;;
  aarch64|arm64) ARCH_GO=arm64; ARCH_BK=arm64 ;;
  *) ARCH_GO="$ARCH"; ARCH_BK="$ARCH" ;;
esac

# Env overrides (also from Makefile IP=/TOKEN=)
SETUP_IP="${IP:-${SETUP_IP:-${K3S_NODE_IP:-}}}"
SETUP_TOKEN="${TOKEN:-${SETUP_TOKEN:-${K3S_TOKEN:-}}}"

# ── Helpers ────────────────────────────────────────────────────────────────
have_sudo() {
  if [ "$(id -u)" -eq 0 ]; then return 0; fi
  if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then return 0; fi
  # try non-n check if sudo exists
  if command -v sudo >/dev/null 2>&1; then return 0; fi
  return 1
}
run_root() {
  # run command as root: via sudo if needed, else directly if already root
  if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi
}
detect_ip() {
  # Try to guess primary IP
  local ip=""
  if command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  if [ -z "$ip" ] && command -v ip >/dev/null 2>&1; then
    ip="$(ip route get 8.8.8.8 2>/dev/null | awk '/src/ {for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1)"
  fi
  if [ -z "$ip" ] && command -v ifconfig >/dev/null 2>&1; then
    ip="$(ifconfig 2>/dev/null | awk '/inet / && $2!="127.0.0.1" {print $2; exit}')"
  fi
  echo "${ip:-10.100.0.1}"
}
prompt_ip() {
  if [ -n "${SETUP_IP:-}" ]; then
    K3S_IP="$SETUP_IP"
    log "Using IP from env: $K3S_IP"
    return
  fi
  local guessed
  guessed="$(detect_ip)"
  if [ -t 0 ]; then
    read -r -p "Enter node IP for k3s [${guessed}]: " inp || true
    K3S_IP="${inp:-$guessed}"
  else
    K3S_IP="$guessed"
    log "Non-interactive: using guessed IP $K3S_IP (set IP= to override)"
  fi
  if ! [[ "$K3S_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && ! [[ "$K3S_IP" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    warn "IP looks unusual: $K3S_IP"
  fi
}
prompt_token() {
  if [ -n "${SETUP_TOKEN:-}" ]; then
    K3S_TOKEN="$SETUP_TOKEN"
    log "Using token from env (hidden)"
    return
  fi
  if [ -t 0 ]; then
    # generate suggestion
    local gen=""
    if command -v openssl >/dev/null 2>&1; then
      gen="$(openssl rand -hex 32 2>/dev/null || true)"
    fi
    if [ -n "$gen" ]; then
      echo -e "${AZURE}[setup]${NC} Suggested token: ${GOLD}${gen}${NC}"
      read -r -s -p "Enter k3s token [press Enter to use suggested]: " inp || true
      echo ""
      K3S_TOKEN="${inp:-$gen}"
    else
      read -r -s -p "Enter k3s token: " inp || true
      echo ""
      K3S_TOKEN="$inp"
    fi
  else
    if command -v openssl >/dev/null 2>&1; then
      K3S_TOKEN="$(openssl rand -hex 32)"
      log "Non-interactive: generated random token (set TOKEN= to override)"
    else
      K3S_TOKEN="kumbi-$(date +%s)"
      warn "Generated fallback token $K3S_TOKEN"
    fi
  fi
  if [ -z "${K3S_TOKEN:-}" ]; then
    fail "Token cannot be empty"
    exit 1
  fi
}
install_pkg_linux() {
  local pkg="$1"
  if command -v "$pkg" >/dev/null 2>&1; then return 0; fi
  log "Installing missing package: $pkg"
  if command -v apt-get >/dev/null 2>&1; then
    run_root apt-get update -y || true
    case "$pkg" in
      kubectl) ;; # handled separately
      envsubst) run_root apt-get install -y gettext-base || run_root apt-get install -y gettext ;;
      openssl)  run_root apt-get install -y openssl ;;
      curl)     run_root apt-get install -y curl ;;
      *)        run_root apt-get install -y "$pkg" || warn "apt install $pkg failed" ;;
    esac
  elif command -v dnf >/dev/null 2>&1; then
    case "$pkg" in
      envsubst) run_root dnf install -y gettext ;;
      *) run_root dnf install -y "$pkg" || warn "dnf install $pkg failed" ;;
    esac
  elif command -v yum >/dev/null 2>&1; then
    case "$pkg" in
      envsubst) run_root yum install -y gettext ;;
      *) run_root yum install -y "$pkg" || warn "yum install $pkg failed" ;;
    esac
  elif command -v apk >/dev/null 2>&1; then
    case "$pkg" in
      envsubst) run_root apk add --no-cache gettext ;;
      *) run_root apk add --no-cache "$pkg" || warn "apk add $pkg failed" ;;
    esac
  else
    warn "No known package manager for $pkg — install manually"
    return 1
  fi
}
install_kubectl_linux() {
  if command -v kubectl >/dev/null 2>&1; then
    ok "kubectl already present: $(kubectl version --client=true 2>&1 | head -1)"
    return
  fi
  log "Installing kubectl..."
  # Prefer k3s kubectl symlink if k3s is present
  if command -v k3s >/dev/null 2>&1; then
    if have_sudo || [ "$(id -u)" -eq 0 ]; then
      run_root ln -sf /usr/local/bin/k3s /usr/local/bin/kubectl 2>/dev/null || true
      if command -v kubectl >/dev/null 2>&1; then ok "kubectl symlinked to k3s"; return; fi
    fi
  fi
  # Download upstream kubectl
  local ver
  ver="$(curl -fsSL https://dl.k8s.io/release/stable.txt 2>/dev/null || echo "v1.31.0")"
  local url="https://dl.k8s.io/release/${ver}/bin/linux/${ARCH_GO}/kubectl"
  log "Downloading kubectl ${ver} for ${ARCH_GO} from ${url}"
  if have_sudo || [ "$(id -u)" -eq 0 ]; then
    curl -fsSL -o /tmp/kubectl "$url" || { fail "kubectl download failed"; return 1; }
    run_root install -o root -g root -m 0755 /tmp/kubectl /usr/local/bin/kubectl
    rm -f /tmp/kubectl
    ok "kubectl ${ver} installed"
  else
    warn "No sudo — cannot install kubectl to /usr/local/bin. Install manually: $url"
    return 1
  fi
}
setup_containerd_env() {
  local addr="/run/k3s/containerd/containerd.sock"
  log "Configuring CONTAINERD_ADDRESS=${addr}"
  export CONTAINERD_ADDRESS="$addr"
  # Persist for interactive shells
  local line='export CONTAINERD_ADDRESS=/run/k3s/containerd/containerd.sock'
  for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
    if [ -f "$rc" ]; then
      grep -q "CONTAINERD_ADDRESS" "$rc" 2>/dev/null || echo "$line" >> "$rc"
    fi
  done
  # System-wide profile.d if root
  if have_sudo || [ "$(id -u)" -eq 0 ]; then
    if [ -d /etc/profile.d ]; then
      echo "$line" | run_root tee /etc/profile.d/k3s-buildkit.sh >/dev/null 2>&1 || true
      run_root chmod 0644 /etc/profile.d/k3s-buildkit.sh 2>/dev/null || true
    fi
    # Also for non-interactive make
    if [ -d /etc/environment.d ]; then
      echo "CONTAINERD_ADDRESS=$addr" | run_root tee /etc/environment.d/99-k3s-buildkit.conf >/dev/null 2>&1 || true
    fi
  else
    warn "No sudo — skip writing /etc/profile.d/k3s-buildkit.sh (CONTAINERD_ADDRESS only in current shell & dotfiles)"
  fi
  ok "CONTAINERD_ADDRESS set (current shell + dotfiles)"
}
setup_k3s_registry() {
  local ip="$1"
  local reg_file="/etc/rancher/k3s/registries.yaml"
  log "Configuring k3s registry mirrors at $reg_file (embedded registry $ip:$K3S_REGISTRY_PORT)"
  local dir
  dir="$(dirname "$reg_file")"
  if have_sudo || [ "$(id -u)" -eq 0 ]; then
    run_root mkdir -p "$dir"
    # Backup existing
    if [ -f "$reg_file" ]; then run_root cp "$reg_file" "${reg_file}.bak.$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true; fi
    cat <<YAML | run_root tee "$reg_file" >/dev/null
mirrors:
  docker.io:
    endpoint:
      - "http://${ip}:${K3S_REGISTRY_PORT}"
      - "https://registry-1.docker.io"
  "${ip}:${K3S_REGISTRY_PORT}":
    endpoint:
      - "http://${ip}:${K3S_REGISTRY_PORT}"
  "registry.local:${K3S_REGISTRY_PORT}":
    endpoint:
      - "http://${ip}:${K3S_REGISTRY_PORT}"
YAML
    ok "Wrote $reg_file"
    # Restart k3s to pick up mirrors if running
    if systemctl is-active --quiet k3s 2>/dev/null || systemctl is-active --quiet k3s-agent 2>/dev/null; then
      log "Restarting k3s to apply registries.yaml..."
      run_root systemctl restart k3s 2>/dev/null || run_root systemctl restart k3s-agent 2>/dev/null || warn "k3s restart failed — reboot or systemctl restart k3s"
      sleep 5
    fi
  else
    warn "No sudo — cannot write $reg_file. Create manually:"
    cat <<YAML
mirrors:
  docker.io:
    endpoint:
      - "http://${ip}:${K3S_REGISTRY_PORT}"
  "${ip}:${K3S_REGISTRY_PORT}":
    endpoint:
      - "http://${ip}:${K3S_REGISTRY_PORT}"
  "registry.local:${K3S_REGISTRY_PORT}":
    endpoint:
      - "http://${ip}:${K3S_REGISTRY_PORT}"
YAML
  fi
}
install_k3s_linux() {
  local ip="$1" token="$2"
  local hostname
  hostname="$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo "wtfx")"
  log "Installing k3s (flannel vxlan + embedded registry) on $ip ..."
  # Check if k3s already running and same IP — skip if desired
  if systemctl is-active --quiet k3s 2>/dev/null || k3s kubectl get nodes >/dev/null 2>&1; then
    warn "k3s already active — will re-install with new IP/token (existing will be overwritten)"
    read -r -p "Continue k3s reinstall? [y/N]: " c || true
    if [[ ! "$c" =~ ^[Yy]$ ]]; then log "Skipping k3s install"; return 0; fi
  fi
  # Ensure curl, openssl available
  for dep in curl openssl; do
    if ! command -v "$dep" >/dev/null 2>&1; then install_pkg_linux "$dep" || true; fi
  done
  # Build INSTALL_K3S_EXEC string - includes vxlan and embedded registry
  # The spec requires these flags exactly; we add embedded-registry and hostname SAN
  local k3s_exec="server \
      --bind-address=${ip} \
      --advertise-address=${ip} \
      --node-ip=${ip} \
      --flannel-backend=vxlan \
      --kubelet-arg=rotate-certificates=true \
      --tls-san=${ip},${hostname} \
      --write-kubeconfig-mode=644 \
      --secrets-encryption \
      --embedded-registry=true \
      --token=${token}"
  log "Running: curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC=\"...\" sh -"
  # Use a temp file for token to avoid shell history
  curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="$k3s_exec" sh - || {
    fail "k3s install failed"
    exit 1
  }
  ok "k3s installed"
  # Setup kubeconfig
  mkdir -p "$HOME/.kube"
  if [ -f /etc/rancher/k3s/k3s.yaml ]; then
    if [ -w /etc/rancher/k3s/k3s.yaml ]; then
      cp /etc/rancher/k3s/k3s.yaml "$HOME/.kube/config" || true
    else
      if have_sudo; then
        run_root cp /etc/rancher/k3s/k3s.yaml "$HOME/.kube/config" || true
        run_root chown "$(id -u):$(id -g)" "$HOME/.kube/config" 2>/dev/null || true
      else
        warn "Cannot copy /etc/rancher/k3s/k3s.yaml without sudo — run: sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config && sudo chown \$USER ~/.kube/config"
      fi
    fi
    chmod 600 "$HOME/.kube/config" 2>/dev/null || true
    export KUBECONFIG="$HOME/.kube/config"
    ok "kubeconfig at $HOME/.kube/config"
  fi
  # Wait for node ready
  log "Waiting for k3s to be ready (30s)..."
  for i in 1 2 3 4 5 6; do
    if kubectl get nodes >/dev/null 2>&1 || k3s kubectl get nodes >/dev/null 2>&1; then ok "k3s ready"; break; fi
    sleep 5
  done
  kubectl get nodes -o wide 2>&1 || k3s kubectl get nodes -o wide 2>&1 || warn "kubectl get nodes failed"
  # Install kubectl symlink if missing
  install_kubectl_linux
  # Setup registry mirrors
  setup_k3s_registry "$ip"
}
install_buildkit_linux() {
  local ip="${1:-$(detect_ip)}"
  log "Installing buildkit (systemd) pointing at k3s containerd + registry ${ip}:${K3S_REGISTRY_PORT}..."
  # Detect arch for buildkit tarball
  local bk_arch="$ARCH_BK"
  # Check existing
  if command -v buildkitd >/dev/null 2>&1 && [ -S /run/buildkit/buildkitd.sock ]; then
    log "buildkitd already present: $(buildkitd --version 2>&1 | head -1)"
    # Ensure config points to k3s containerd
    # Will recreate config below anyway
  fi
  # Install buildkit binaries if missing
  if ! command -v buildkitd >/dev/null 2>&1; then
    log "Downloading buildkit ${BUILDKIT_VERSION} for ${bk_arch}..."
    local url="https://github.com/moby/buildkit/releases/download/${BUILDKIT_VERSION}/buildkit-${BUILDKIT_VERSION}.linux-${bk_arch}.tar.gz"
    local tmp="/tmp/buildkit-${BUILDKIT_VERSION}.tgz"
    curl -fsSL -o "$tmp" "$url" || { fail "Failed to download $url"; exit 1; }
    if have_sudo || [ "$(id -u)" -eq 0 ]; then
      run_root tar -xzf "$tmp" -C /usr/local 2>/dev/null || {
        # tar may contain bin/ prefix
        tar -tzf "$tmp" | head
        run_root tar -xzf "$tmp" -C /tmp
        run_root cp -a /tmp/bin/* /usr/local/bin/ 2>/dev/null || run_root cp -a /tmp/buildkit* /usr/local/bin/ 2>/dev/null || true
      }
      # Ensure binaries are executable and in PATH (some tarballs extract to ./bin)
      if [ -d /usr/local/bin/buildkit ]; then run_root cp -a /usr/local/bin/buildkit/* /usr/local/bin/ 2>/dev/null || true; fi
      rm -f "$tmp"
      ok "buildkit binaries installed to /usr/local/bin"
    else
      warn "No sudo — cannot install buildkit binaries to /usr/local/bin. Install manually: $url"
      return 1
    fi
  fi
  # Create minimal buildkitd.toml
  log "Writing /etc/buildkit/buildkitd.toml (minimal, containerd + insecure registries)..."
  local toml="/etc/buildkit/buildkitd.toml"
  if have_sudo || [ "$(id -u)" -eq 0 ]; then
    run_root mkdir -p /etc/buildkit
    cat <<TOML | run_root tee "$toml" >/dev/null
# Minimal buildkit config for Kumbi — k3s containerd + embedded registry
[worker.containerd]
  enabled = true
  address = "/run/k3s/containerd/containerd.sock"
  namespace = "k8s.io"
  gc = true
  maxUsedSpace = "5GB"
  reservedSpace = "1GB"
  max-parallelism = 2

[[worker.containerd.gcpolicy]]
  keepBytes = "5GB"
  keepDuration = "168h"
  filters = ["type==source.local", "type==exec.cachemount"]

# Allow insecure embedded registry (k3s) at node IP and registry.local
[registry."${ip}:${K3S_REGISTRY_PORT}"]
  http = true
  insecure = true

[registry."registry.local:${K3S_REGISTRY_PORT}"]
  http = true
  insecure = true

# Also allow docker.io mirror via embedded registry
# (k3s registries.yaml mirrors docker.io -> http://IP:5000)
TOML
    ok "Wrote $toml"
  else
    warn "No sudo — cannot write $toml"
    cat <<TOML
[worker.containerd]
  enabled = true
  address = "/run/k3s/containerd/containerd.sock"
  namespace = "k8s.io"
[registry."${ip}:${K3S_REGISTRY_PORT}"]
  http = true
  insecure = true
[registry."registry.local:${K3S_REGISTRY_PORT}"]
  http = true
  insecure = true
TOML
  fi
  # Create systemd socket + service
  log "Creating systemd units buildkit.socket + buildkit.service..."
  local sock="/etc/systemd/system/buildkit.socket"
  local svc="/etc/systemd/system/buildkit.service"
  if have_sudo || [ "$(id -u)" -eq 0 ]; then
    cat <<SOCK | run_root tee "$sock" >/dev/null
[Unit]
Description=BuildKit
Documentation=https://github.com/moby/buildkit

[Socket]
ListenStream=%t/buildkit/buildkitd.sock
SocketMode=0660

[Install]
WantedBy=sockets.target
SOCK
    cat <<SVC | run_root tee "$svc" >/dev/null
[Unit]
Description=Buildkit Daemon
Requires=buildkit.socket
After=network.target k3s.service
Documentation=https://github.com/moby/buildkit

[Service]
Type=notify
ExecStart=/usr/local/bin/buildkitd --config /etc/buildkit/buildkitd.toml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVC
    run_root systemctl daemon-reload
    run_root systemctl enable --now buildkit.socket 2>/dev/null || run_root systemctl enable --now buildkit 2>/dev/null || true
    run_root systemctl restart buildkit 2>/dev/null || run_root systemctl start buildkit 2>/dev/null || true
    sleep 2
    if [ -S /run/buildkit/buildkitd.sock ]; then ok "buildkit socket ready at /run/buildkit/buildkitd.sock"; else warn "buildkit socket not yet created — check: journalctl -u buildkit -f"; fi
    if command -v buildctl >/dev/null 2>&1; then
      if timeout 5 buildctl --addr unix:///run/buildkit/buildkitd.sock debug workers >/dev/null 2>&1; then ok "buildkitd responsive"; else warn "buildkitd not yet responsive — try: sudo systemctl status buildkit"; fi
    fi
    # Also ensure CONTAINERD_ADDRESS
    setup_containerd_env
  else
    warn "No sudo — cannot write systemd units. Create manually:"
    echo "  $sock and $svc"
    return 1
  fi
}
install_buildkit_darwin() {
  log "macOS detected — installing buildkit via Homebrew (launchd)..."
  # Check brew
  if ! command -v brew >/dev/null 2>&1; then
    fail "Homebrew not found. Install from https://brew.sh then re-run: brew install buildkit"
    return 1
  fi
  # Install dependencies
  local need=(buildkit gettext openssl)
  for pkg in "${need[@]}"; do
    local bin="$pkg"
    if [ "$pkg" = "gettext" ]; then bin="envsubst"; fi
    if ! command -v "$bin" >/dev/null 2>&1; then
      log "brew install $pkg..."
      brew install "$pkg" || warn "brew install $pkg failed"
    else
      ok "$pkg already installed"
    fi
  done
  # kubectl
  if ! command -v kubectl >/dev/null 2>&1; then
    log "brew install kubectl..."
    brew install kubectl || warn "kubectl brew install failed"
  fi
  # k3s? On mac, k3s not natively supported via systemd; suggest k3d or colima
  if ! command -v k3s >/dev/null 2>&1; then
    warn "k3s server not available on macOS (systemd only). Consider: brew install k3d && k3d cluster create"
    log "Skipping k3s install on mac — only buildkit will be configured"
  fi
  # Buildkit macOS config: OCI worker (no k3s containerd)
  local toml_dir="$HOME/.config/buildkit"
  local toml="$toml_dir/buildkitd.toml"
  mkdir -p "$toml_dir"
  cat <<TOML > "$toml"
# Minimal buildkit config for macOS (OCI worker)
[worker.oci]
  enabled = true
  gc = true

# Allow insecure local registry if using k3d/k3s
[registry."registry.local:${K3S_REGISTRY_PORT}"]
  http = true
  insecure = true

[registry."localhost:${K3S_REGISTRY_PORT}"]
  http = true
  insecure = true
TOML
  ok "Wrote $toml"
  # Try brew services
  if brew services list 2>/dev/null | grep -q buildkit; then
    log "Restarting buildkit via brew services..."
    brew services restart buildkit || brew services start buildkit || true
  else
    log "Starting buildkit via brew services..."
    brew services start buildkit 2>/dev/null || {
      warn "brew services start failed — trying manual launchd plist"
      # Fallback: run buildkitd directly
      local plist="$HOME/Library/LaunchAgents/homebrew.buildkit.plist"
      if [ -f "$plist" ]; then
        launchctl load -w "$plist" 2>/dev/null || true
      fi
    }
  fi
  # Also support colima/docker containerd socket if present
  local sock="/run/buildkit/buildkitd.sock"
  if [ -S "$sock" ]; then ok "buildkit socket at $sock"
  else
    local alt="$HOME/.buildkit/buildkitd.sock"
    if [ -S "$alt" ]; then ok "buildkit socket at $alt"
    else
      warn "buildkit socket not found — check: brew services info buildkit; log: brew services logs buildkit"
      # Try starting manually for verification
      if command -v buildkitd >/dev/null 2>&1; then
        log "You can run manually: buildkitd --config $toml --addr unix://$HOME/.buildkit/buildkitd.sock"
      fi
    fi
  fi
  # CONTAINERD_ADDRESS not applicable on mac, but set for consistency if k3d uses docker
  export CONTAINERD_ADDRESS="${CONTAINERD_ADDRESS:-}"
  log "macOS buildkit setup complete (OCI worker, no k3s containerd)"
}
setup_deps() {
  log "Checking frontend/backend dependencies..."
  if command -v bun >/dev/null 2>&1; then
    log "bun present: $(bun --version 2>&1 | head -1)"
  else
    if [ "$OS" = "Darwin" ]; then
      if command -v brew >/dev/null 2>&1; then log "Installing bun via brew..."; brew install oven-sh/bun/bun || warn "bun install failed"; fi
    else
      warn "bun not found — install from https://bun.sh"
    fi
  fi
  if command -v go >/dev/null 2>&1; then
    log "go present: $(go version 2>&1 | head -1)"
  else
    if [ "$OS" = "Darwin" ] && command -v brew >/dev/null 2>&1; then brew install go || warn "go install failed"
    else warn "go not found — install from https://go.dev"; fi
  fi
  # Try to install deps if present
  if [ -d frontend ] && command -v bun >/dev/null 2>&1; then
    log "Installing frontend deps (bun install)..."
    (cd frontend && bun install 2>&1 | tail -5) || warn "bun install failed"
  fi
  if [ -d backend ] && command -v go >/dev/null 2>&1; then
    log "Downloading backend modules (go mod download)..."
    (cd backend && go mod download 2>&1 | tail -5) || warn "go mod download failed"
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────
main() {
  log "Kumbi setup — OS: $OS arch: $ARCH_GO"
  prompt_ip
  prompt_token
  echo ""
  log "Configuration:"
  echo "  IP:    $K3S_IP"
  echo "  Token: ${K3S_TOKEN:0:8}... (hidden)"
  echo "  OS:    $OS"
  echo ""
  if [ "$OS" = "Darwin" ]; then
    log "macOS flow: skip k3s systemd install, setup buildkit via brew"
    install_buildkit_darwin
    setup_deps
    install_kubectl_linux || true # will brew install on darwin
    # kubectl via brew already
    if ! command -v envsubst >/dev/null 2>&1; then
      if command -v brew >/dev/null 2>&1; then brew install gettext || true; fi
    fi
    ok "macOS setup complete"
  else
    # Linux
    install_k3s_linux "$K3S_IP" "$K3S_TOKEN"
    # kubectl already handled in k3s install
    if ! command -v kubectl >/dev/null 2>&1; then install_kubectl_linux || true; fi
    if ! command -v envsubst >/dev/null 2>&1; then install_pkg_linux envsubst || true; fi
    if ! command -v openssl >/dev/null 2>&1; then install_pkg_linux openssl || true; fi
    setup_containerd_env
    install_buildkit_linux "$K3S_IP"
    setup_deps
    echo ""
    ok "Linux setup complete"
    log "Next steps:"
    echo "  - Verify: make k3s-check ENV=dev"
    echo "  - Deploy: make deploy ENV=dev"
    echo "  - CONTAINERD_ADDRESS=$CONTAINERD_ADDRESS (added to ~/.bashrc etc)"
    echo "  - Registry: http://${K3S_IP}:${K3S_REGISTRY_PORT} (mirrored in /etc/rancher/k3s/registries.yaml)"
    echo "  - Buildkit: /run/buildkit/buildkitd.sock (systemd socket)"
  fi
  # Common post-checks
  echo ""
  log "Tool versions:"
  command -v kubectl >/dev/null 2>&1 && echo "  kubectl: $(kubectl version --client=true 2>&1 | head -1)" || echo "  kubectl: missing"
  command -v k3s >/dev/null 2>&1 && echo "  k3s: $(k3s --version 2>&1 | head -1)" || echo "  k3s: missing (expected on mac)"
  command -v buildkitd >/dev/null 2>&1 && echo "  buildkitd: $(buildkitd --version 2>&1 | head -1)" || echo "  buildkitd: missing"
  command -v buildctl >/dev/null 2>&1 && echo "  buildctl: $(buildctl --version 2>&1 | head -1)" || echo "  buildctl: missing"
  echo "  CONTAINERD_ADDRESS=${CONTAINERD_ADDRESS:-<unset>}"
}

main "$@"
