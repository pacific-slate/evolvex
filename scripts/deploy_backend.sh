#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${EVOLVEX_REMOTE_HOST:-ssh.pacificslate.org}"
REMOTE_DIR="${EVOLVEX_BACKEND_DIR:-/opt/evolvex}"
REMOTE_LOG="${EVOLVEX_BACKEND_LOG:-/var/log/evolvex-backend.log}"
PORT="${EVOLVEX_BACKEND_PORT:-8000}"
BIND_HOST="${EVOLVEX_BACKEND_BIND_HOST:-127.0.0.1}"

# Backend-only deployment. This never rebuilds or restarts the frontend.
ssh "$REMOTE_HOST" 'bash -s' <<EOF
set -euo pipefail

REMOTE_DIR="$REMOTE_DIR"
REMOTE_LOG="$REMOTE_LOG"
PORT="$PORT"
BIND_HOST="$BIND_HOST"

cd "\$REMOTE_DIR"
git fetch origin main
git checkout main
git pull --ff-only origin main

source .venv/bin/activate
python -m pytest tests/ -q

pids=\$(lsof -tiTCP:"\$PORT" -sTCP:LISTEN || true)
if [ -n "\$pids" ]; then
  kill \$pids
  sleep 2
fi

nohup bash -lc "source .venv/bin/activate && exec .venv/bin/uvicorn api:app --host \$BIND_HOST --port \$PORT" >"\$REMOTE_LOG" 2>&1 </dev/null &
sleep 4
ss -ltnp | grep ":\$PORT "
EOF
