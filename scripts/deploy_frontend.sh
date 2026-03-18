#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${EVOLVEX_REMOTE_HOST:-ssh.pacificslate.org}"
REMOTE_DIR="${EVOLVEX_FRONTEND_DIR:-/opt/evolvex-frontend}"
REMOTE_LOG="${EVOLVEX_FRONTEND_LOG:-/var/log/evolvex-frontend.log}"
PORT="${EVOLVEX_FRONTEND_PORT:-3002}"

# Frontend-only deployment. This never touches the backend checkout or agent process.
ssh "$REMOTE_HOST" 'bash -s' <<EOF
set -euo pipefail

REMOTE_DIR="$REMOTE_DIR"
REMOTE_LOG="$REMOTE_LOG"
PORT="$PORT"

if [ ! -d "\$REMOTE_DIR/.git" ]; then
  git clone git@github.com:pacific-slate/evolvex.git "\$REMOTE_DIR"
fi

cd "\$REMOTE_DIR"
git fetch origin main
git checkout main
git pull --ff-only origin main

cd dashboard
npm ci
npm run build

pkill -f "nohup npm start -- -p \$PORT" 2>/dev/null || true
pkill -f "npm start -p \$PORT" 2>/dev/null || true
pkill -f "next start -p \$PORT" 2>/dev/null || true

pids=\$(lsof -tiTCP:"\$PORT" -sTCP:LISTEN || true)
if [ -n "\$pids" ]; then
  kill -9 \$pids
  sleep 2
fi

nohup npm start -- -p "\$PORT" >"\$REMOTE_LOG" 2>&1 </dev/null &
sleep 5
ss -ltnp | grep ":\$PORT "
EOF
