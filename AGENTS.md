# Kumbi — Agent Guidelines

## Operational rules

- The cluster is a real k3s **systemd/privileged** install, not k3d-in-Docker.
  `kubectl`, `k3s kubectl`, and `ctr` (containerd) work **without sudo**
  via `~/.kube/config` and `/run/k3s/containerd/containerd.sock`.
- **Never invoke `sudo` anywhere.** The Makefile and scripts must run
  unprivileged all the way. If a step needs root (nginx config in
  `/etc/nginx`, firewall, package install), skip it with a clear warning
  and tell the user to do it manually — do not prompt for a password.
- Control the environment only through: `makefile targets`, `kubectl`,
  `ctr`, `nerdctl`. Anything else is for debugging only.
- All deployments go into the single `kumbi` namespace (all ENVs).
- To verify automation, run the real targets (`make build`, `make refresh`,
  `make deploy`) with `ENV=dev FRONT_DOOR=true` — don’t paper over failures;
  the Makefile/scripts/code must actually work.
- When a deploy/logged error is silent, trace the recipe: errors inside
  `$(call tee,..)` pipelines can be masked by the pipe exit status.