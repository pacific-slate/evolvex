#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${EVOLVEX_REMOTE_HOST:-ssh.pacificslate.org}"
REMOTE_DIR="${EVOLVEX_BACKEND_DIR:-/opt/evolvex-post-submission-dev}"
REMOTE_LOG="${EVOLVEX_BACKEND_LOG:-/var/log/evolvex-backend.log}"
PORT="${EVOLVEX_BACKEND_PORT:-8000}"
BIND_HOST="${EVOLVEX_BACKEND_BIND_HOST:-127.0.0.1}"
BRANCH="${EVOLVEX_DEPLOY_BRANCH:-post-submission-dev}"
ENV_FILE="${EVOLVEX_ENV_FILE:-/opt/evolvex/.env}"

# Backend-only deployment. This never rebuilds or restarts the frontend.
ssh "$REMOTE_HOST" 'bash -s' <<EOF
set -euo pipefail

REMOTE_DIR="$REMOTE_DIR"
REMOTE_LOG="$REMOTE_LOG"
PORT="$PORT"
BIND_HOST="$BIND_HOST"
BRANCH="$BRANCH"
ENV_FILE="$ENV_FILE"

cd "\$REMOTE_DIR"
git fetch origin "\$BRANCH"
git checkout "\$BRANCH"

if [ -f "\$ENV_FILE" ]; then
  set -a
  source "\$ENV_FILE"
  set +a
fi

git pull --ff-only origin "\$BRANCH"

if [ ! -x .venv/bin/python ]; then
  PYTHON_BIN=\$(command -v python3.13 || command -v python3)
  "\$PYTHON_BIN" -m venv .venv
fi

source .venv/bin/activate
python -m pip install -r requirements.txt
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
