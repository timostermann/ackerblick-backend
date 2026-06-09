#!/usr/bin/env bash
# bootstrap.sh — one-time server setup after `terraform apply`.
# Run as root on a fresh Ubuntu 24.04 server:
#   ssh root@<server-ip> 'bash -s' < infra/bootstrap.sh
#
# After this script completes, edit /opt/ackerblick-backend/.env and then run:
#   docker compose -f /opt/ackerblick-backend/docker-compose.prod.yml up -d
#
# NOTE: Steps 2 and 4 require the server to reach github.com. If GitHub is
# unreachable at deploy time, git clone/pull will fail. Ensure outbound HTTPS
# is not blocked and retry if there is a transient GitHub outage.
set -euo pipefail

REPO_URL="https://github.com/timostermann/ackerblick-backend.git"  # <-- update before running
DEPLOY_DIR="/opt/ackerblick-backend"

echo "==> [1/5] Installing Docker + Docker Compose plugin"
if command -v docker &>/dev/null; then
  echo "  Docker already installed — skipping."
else
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --batch --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -y
  apt-get install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin
  systemctl enable --now docker
fi
echo "  Docker $(docker --version) installed."

echo "==> [2/5] Mounting block volume at /mnt/ackerblick-db"
BLOCK_DEV=$(readlink -f /dev/disk/by-id/scsi-0HC_Volume_* 2>/dev/null | head -1)
if [ -z "$BLOCK_DEV" ]; then
  echo "  ERROR: No Hetzner Block Volume found. Ensure terraform apply completed and the volume is attached."
  exit 1
fi
mkdir -p /mnt/ackerblick-db
if mountpoint -q /mnt/ackerblick-db; then
  echo "  Already mounted — skipping."
else
  mount "$BLOCK_DEV" /mnt/ackerblick-db
fi
grep -qF "$BLOCK_DEV" /etc/fstab \
  || echo "$BLOCK_DEV /mnt/ackerblick-db ext4 defaults 0 2" >> /etc/fstab
echo "  Mounted $BLOCK_DEV at /mnt/ackerblick-db."

echo "==> [3/5] Cloning repository to $DEPLOY_DIR"
# NOTE: This uses unauthenticated HTTPS and requires the repo to be public.
# For a private repo, switch to SSH and pre-install a read-only deploy key:
#   ssh-keygen -t ed25519 -f /root/.ssh/deploy_key -N ''
#   # Add the public key as a GitHub deploy key (read-only)
#   GIT_SSH_COMMAND='ssh -i /root/.ssh/deploy_key' git clone git@github.com:timostermann/ackerblick-backend.git
if [ -d "$DEPLOY_DIR" ]; then
  echo "  $DEPLOY_DIR already exists — pulling latest instead."
  GIT_TERMINAL_PROMPT=0 git -C "$DEPLOY_DIR" pull origin main
else
  GIT_TERMINAL_PROMPT=0 git clone "$REPO_URL" "$DEPLOY_DIR"
fi

echo "==> [4/5] Creating .env from template"
if [ -f "$DEPLOY_DIR/.env" ]; then
  echo "  .env already exists — skipping to preserve existing secrets."
else
  cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env"
fi

echo ""
echo "============================================================"
echo "  NEXT STEP: fill in secrets in $DEPLOY_DIR/.env"
echo ""
echo "  Required values:"
echo "    DATABASE_URL  — use 'db' as the hostname:"
echo "      postgresql://<user>:<password>@db:5432/<dbname>?schema=public"
echo "    DB_PASSWORD   — must match POSTGRES_PASSWORD in DATABASE_URL"
echo "    API_KEY       — shared key baked into firmware"
echo "    DASHBOARD_USER / DASHBOARD_PASSWORD"
echo ""
echo "  Then run:"
echo "    docker compose -f $DEPLOY_DIR/docker-compose.prod.yml up -d"
echo "============================================================"
echo ""

echo "==> [5/5] Bootstrap complete. Edit .env before starting services."
