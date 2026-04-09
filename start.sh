#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

RUN_DIR="$ROOT_DIR/.run/edgeops"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"
LAUNCHER_PID_FILE="$RUN_DIR/launcher.pid"
RUNTIME_ENV_FILE="$RUN_DIR/runtime.env"
START_MODE="production"
DETACH_MODE=0

for arg in "$@"; do
  case "$arg" in
    dev)
      START_MODE="dev"
      ;;
    production)
      START_MODE="production"
      ;;
    -d|--detach|daemon)
      DETACH_MODE=1
      ;;
    *)
      echo "[start] Unknown argument: $arg" >&2
      echo "[start] Usage: ./start.sh [dev] [-d]" >&2
      exit 1
      ;;
  esac
done

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

API_PORT="${EDGEOPS_PORT:-8787}"
FRONTEND_PORT="${EDGEOPS_FRONTEND_PORT:-8080}"
FRONTEND_HOST="${EDGEOPS_FRONTEND_HOST:-0.0.0.0}"
DEV_FRONTEND_PORT="${EDGEOPS_DEV_FRONTEND_PORT:-5173}"
DEV_FRONTEND_HOST="${EDGEOPS_DEV_FRONTEND_HOST:-0.0.0.0}"
EDGEOPS_API_ORIGIN="${EDGEOPS_API_ORIGIN:-http://127.0.0.1:${API_PORT}}"
RUNTIME_FRONTEND_PORT="$FRONTEND_PORT"
RUNTIME_FRONTEND_HOST="$FRONTEND_HOST"

if [[ "$START_MODE" == "dev" ]]; then
  export NODE_ENV="${NODE_ENV:-development}"
  RUNTIME_FRONTEND_PORT="$DEV_FRONTEND_PORT"
  RUNTIME_FRONTEND_HOST="$DEV_FRONTEND_HOST"
else
  export NODE_ENV="${NODE_ENV:-production}"
fi
export EDGEOPS_API_ORIGIN

backend_pid=""
frontend_pid=""

mkdir -p "$RUN_DIR"

read_pid_file() {
  local pid_file="$1"

  if [[ -f "$pid_file" ]]; then
    tr -d '[:space:]' <"$pid_file"
  fi
}

process_matches() {
  local pid="$1"
  local expected="$2"
  local args

  if [[ -z "$expected" ]]; then
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
    return $?
  fi

  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    return 1
  fi

  args="$(ps -p "$pid" -o args= 2>/dev/null || true)"
  [[ "$args" == *"$expected"* ]]
}

remove_runtime_files() {
  rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE" "$LAUNCHER_PID_FILE" "$RUNTIME_ENV_FILE"

  if [[ -d "$RUN_DIR" ]] && [[ -z "$(ls -A "$RUN_DIR" 2>/dev/null)" ]]; then
    rmdir "$RUN_DIR" 2>/dev/null || true
  fi
}

ensure_not_running() {
  local existing_backend_pid
  local existing_frontend_pid
  local existing_launcher_pid
  local existing_frontend_hint

  existing_backend_pid="$(read_pid_file "$BACKEND_PID_FILE")"
  existing_frontend_pid="$(read_pid_file "$FRONTEND_PID_FILE")"
  existing_launcher_pid="$(read_pid_file "$LAUNCHER_PID_FILE")"
  existing_frontend_hint=""

  if [[ -f "$RUNTIME_ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    . "$RUNTIME_ENV_FILE"
    existing_frontend_hint="${EDGEOPS_FRONTEND_PROCESS_HINT:-}"
  fi

  if process_matches "$existing_backend_pid" "server/index.js" \
    || process_matches "$existing_frontend_pid" "$existing_frontend_hint" \
    || process_matches "$existing_launcher_pid" "start.sh"; then
    echo "[start] EdgeOps already appears to be running." >&2
    echo "[start] Use ./stop.sh first, or remove stale files under .run/edgeops if needed." >&2
    exit 1
  fi

  remove_runtime_files
}

write_runtime_files() {
  mkdir -p "$RUN_DIR"
  printf '%s\n' "$backend_pid" >"$BACKEND_PID_FILE"
  printf '%s\n' "$frontend_pid" >"$FRONTEND_PID_FILE"
  printf '%s\n' "$$" >"$LAUNCHER_PID_FILE"
  cat >"$RUNTIME_ENV_FILE" <<EOF
EDGEOPS_START_MODE=$START_MODE
EDGEOPS_DETACH_MODE=$DETACH_MODE
EDGEOPS_PORT=$API_PORT
EDGEOPS_FRONTEND_PORT=$RUNTIME_FRONTEND_PORT
EDGEOPS_FRONTEND_HOST=$RUNTIME_FRONTEND_HOST
EDGEOPS_API_ORIGIN=$EDGEOPS_API_ORIGIN
EDGEOPS_FRONTEND_PROCESS_HINT=$(
  if [[ "$START_MODE" == "dev" ]]; then
    printf '%s' 'vite'
  else
    printf '%s' 'server/frontend.js'
  fi
)
EOF
}

cleanup() {
  local exit_code="${1:-0}"

  trap - EXIT INT TERM

  if [[ -n "$frontend_pid" ]] && kill -0 "$frontend_pid" 2>/dev/null; then
    kill "$frontend_pid" 2>/dev/null || true
  fi

  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null || true
  fi

  wait 2>/dev/null || true
  remove_runtime_files
  exit "$exit_code"
}

trap 'cleanup $?' EXIT
trap 'cleanup 130' INT TERM

ensure_not_running

if [[ "$START_MODE" == "production" ]]; then
  if [[ "${EDGEOPS_SKIP_BUILD:-0}" != "1" ]]; then
    echo "[start] Building frontend assets"
    npm run build
  else
    echo "[start] Skipping frontend build because EDGEOPS_SKIP_BUILD=1"
  fi

  if [[ ! -f dist/index.html ]]; then
    echo "[start] Missing dist/index.html. Run npm run build or unset EDGEOPS_SKIP_BUILD." >&2
    exit 1
  fi
fi

echo "[start] Starting API on http://127.0.0.1:${API_PORT}"
node server/index.js &
backend_pid=$!

if [[ "$START_MODE" == "dev" ]]; then
  echo "[start] Starting dev frontend on http://${DEV_FRONTEND_HOST}:${DEV_FRONTEND_PORT}"
  echo "[start] Vite will proxy /api to http://127.0.0.1:${API_PORT}"
  npm run dev -- --host "${DEV_FRONTEND_HOST}" --port "${DEV_FRONTEND_PORT}" &
  frontend_pid=$!
else
  echo "[start] Starting frontend on http://${FRONTEND_HOST}:${FRONTEND_PORT}"
  echo "[start] Frontend will proxy /api to ${EDGEOPS_API_ORIGIN}"
  node server/frontend.js &
  frontend_pid=$!
fi

write_runtime_files

if [[ "$DETACH_MODE" == "1" ]]; then
  echo "[start] EdgeOps started in detached mode"
  echo "[start] API pid: $backend_pid"
  echo "[start] Frontend pid: $frontend_pid"
  echo "[start] Use ./stop.sh to stop the stack"
  trap - EXIT INT TERM
  exit 0
fi

wait -n "$backend_pid" "$frontend_pid"
cleanup $?
