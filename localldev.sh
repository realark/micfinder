#!/usr/bin/env bash

set -Eeuo pipefail
shopt -s extglob

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Load project defaults, then local overrides, without evaluating either file as shell code.
declare -A DOTENV=()
load_dotenv() {
  local file="$1" line key value
  [[ -f "$file" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    line="${line##+([[:space:]])}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" == export\ * ]] && line="${line#export }"
    [[ "$line" == *=* ]] || continue

    key="${line%%=*}"
    value="${line#*=}"
    key="${key%%+([[:space:]])}"
    value="${value##+([[:space:]])}"
    value="${value%%+([[:space:]])}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

    if (( ${#value} >= 2 )) &&
       [[ ( "$value" == \"*\" ) || ( "$value" == \'*\' ) ]]; then
      value="${value:1:${#value}-2}"
    fi
    DOTENV["$key"]="$value"
  done < "$file"
}

load_dotenv "$ROOT_DIR/.env.local.sample"
load_dotenv "$ROOT_DIR/.env"

export PORT="${PORT:-${DOTENV[PORT]:-3000}}"
export NODE_ENV="${NODE_ENV:-${DOTENV[NODE_ENV]:-development}}"
export JWT_SECRET="${JWT_SECRET:-${DOTENV[JWT_SECRET]:-localdev}}"
export PG_HOST="${PG_HOST:-${DOTENV[PG_HOST]:-localhost}}"
export PG_PORT="${PG_PORT:-${DOTENV[PG_PORT]:-5432}}"
export PG_USER="${PG_USER:-${DOTENV[PG_USER]:-openmics}}"
export PG_DATABASE="${PG_DATABASE:-${DOTENV[PG_DATABASE]:-openmics}}"
export PG_PASSWORD="${PG_PASSWORD:-${DOTENV[PG_PASSWORD]:-password}}"
export PG_SSL="${PG_SSL:-${DOTENV[PG_SSL]:-false}}"
export CORS_DISABLE="${CORS_DISABLE:-${DOTENV[CORS_DISABLE]:-true}}"
export VITE_MICFINDER_API_URL="${VITE_MICFINDER_API_URL:-${DOTENV[VITE_MICFINDER_API_URL]:-http://localhost:${PORT}}}"

FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_URL="http://127.0.0.1:${PORT}"
FRONTEND_URL="http://${FRONTEND_HOST}:${FRONTEND_PORT}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_command curl
require_command flock

LOCK_DIR="${XDG_RUNTIME_DIR:-/tmp}"
exec 9>"${LOCK_DIR}/micfinder-localdev-${UID}.lock"
if ! flock -n 9; then
  printf 'Mic Finder local development is already starting or running.\n'
  exit 0
fi

backend_is_running() {
  local response
  response="$(curl --fail --silent --show-error --max-time 1 "${BACKEND_URL}/health" 2>/dev/null)" || return 1
  [[ "$response" == *'"status":"ok"'* ]]
}

frontend_is_running() {
  local response
  response="$(curl --fail --silent --show-error --max-time 1 "$FRONTEND_URL" 2>/dev/null)" || return 1
  [[ "$response" == *'<title>Mic Finder</title>'* ]]
}

backend_running=false
frontend_running=false
backend_is_running && backend_running=true
frontend_is_running && frontend_running=true

if [[ "$backend_running" == true && "$frontend_running" == true ]]; then
  printf 'Mic Finder is already running at %s\n' "$FRONTEND_URL"
  exit 0
fi

require_command docker
require_command npm
require_command setsid
docker compose version >/dev/null

pids=()
started_database=false

cleanup() {
  local status=$?
  trap - EXIT

  if (( ${#pids[@]} > 0 )); then
    for pid in "${pids[@]}"; do
      kill -- "-${pid}" 2>/dev/null || true
    done
    wait "${pids[@]}" 2>/dev/null || true
  fi
  if [[ "$started_database" == true ]]; then
    docker compose stop db >/dev/null 2>&1 || true
  fi

  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

wait_for() {
  local label="$1" check="$2" attempt
  for attempt in {1..60}; do
    if "$check"; then
      printf '%s is ready.\n' "$label"
      return 0
    fi
    sleep 0.5
  done
  printf '%s did not become ready within 30 seconds.\n' "$label" >&2
  return 1
}

if [[ "$backend_running" == false ]]; then
  database_running=false
  while IFS= read -r service; do
    [[ "$service" == db ]] && database_running=true
  done < <(docker compose ps --status running --services 2>/dev/null)

  if [[ "$database_running" == false ]]; then
    printf 'Starting PostgreSQL...\n'
    docker compose up --detach db
    started_database=true
  fi

  for attempt in {1..60}; do
    if docker compose exec -T db pg_isready --quiet --username "$PG_USER" --dbname "$PG_DATABASE"; then
      break
    fi
    if (( attempt == 60 )); then
      printf 'PostgreSQL did not become ready within 30 seconds.\n' >&2
      exit 1
    fi
    sleep 0.5
  done

  printf 'Starting backend at %s...\n' "$BACKEND_URL"
  setsid --wait npm --prefix backend run dev &
  pids+=("$!")
  wait_for "Backend" backend_is_running
else
  printf 'Backend is already running at %s.\n' "$BACKEND_URL"
fi

if [[ "$frontend_running" == false ]]; then
  printf 'Starting frontend at %s...\n' "$FRONTEND_URL"
  setsid --wait npm --prefix frontend run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" --strictPort &
  pids+=("$!")
  wait_for "Frontend" frontend_is_running
else
  printf 'Frontend is already running at %s.\n' "$FRONTEND_URL"
fi

printf '\nMic Finder is ready: %s\n' "$FRONTEND_URL"
printf 'Press Ctrl-C to stop services started by this script.\n'

set +e
wait -n "${pids[@]}"
status=$?
set -e
printf 'A local service exited; stopping the remaining services.\n' >&2
exit "$status"
