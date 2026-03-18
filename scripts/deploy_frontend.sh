#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${EVOLVEX_REMOTE_HOST:-ssh.pacificslate.org}"
REMOTE_DIR="${EVOLVEX_FRONTEND_DIR:-/opt/evolvex-frontend}"
REMOTE_LOG="${EVOLVEX_FRONTEND_LOG:-/var/log/evolvex-frontend.log}"
PORT="${EVOLVEX_FRONTEND_PORT:-3002}"
REMOTE_BRANCH="${EVOLVEX_FRONTEND_BRANCH:-main}"

# Frontend-only deployment. This never touches the backend checkout or agent process.
ssh "$REMOTE_HOST" 'bash -s' <<EOF
set -euo pipefail

REMOTE_DIR="$REMOTE_DIR"
REMOTE_LOG="$REMOTE_LOG"
PORT="$PORT"
REMOTE_BRANCH="$REMOTE_BRANCH"

if [ ! -d "\$REMOTE_DIR/.git" ]; then
  git clone git@github.com:pacific-slate/evolvex.git "\$REMOTE_DIR"
fi

cd "\$REMOTE_DIR"
git fetch origin "\$REMOTE_BRANCH"
if git show-ref --verify --quiet "refs/heads/\$REMOTE_BRANCH"; then
  git checkout "\$REMOTE_BRANCH"
else
  git checkout -B "\$REMOTE_BRANCH" "origin/\$REMOTE_BRANCH"
fi
git pull --ff-only origin "\$REMOTE_BRANCH"

cd dashboard
npm ci
npm run build

pkill -f "nohup npm start -- -p \$PORT" 2>/dev/null || true
pkill -f "npm start -p \$PORT" 2>/dev/null || true
pkill -f "next start -p \$PORT" 2>/dev/null || true

sleep 1

pids=\$(ss -ltnp 2>/dev/null | awk -v port="\$PORT" -f "../scripts/extract_listening_pids.awk" | sort -u)
if [ -n "\$pids" ]; then
  kill -9 \$pids
  sleep 2
fi

if ss -ltnp 2>/dev/null | grep -q ":\$PORT "; then
  echo "port \$PORT is still occupied after shutdown attempt" >&2
  ss -ltnp | grep ":\$PORT " >&2 || true
  exit 1
fi

nohup npm start -- -p "\$PORT" >"\$REMOTE_LOG" 2>&1 </dev/null &
sleep 5
ss -ltnp | grep ":\$PORT "
EOF
