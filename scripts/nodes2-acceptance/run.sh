#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
here="$repo_root/scripts/nodes2-acceptance"
: "${COMFYUI_DIR:?Set COMFYUI_DIR to a ComfyUI checkout}"
python="${COMFYUI_PYTHON:-$COMFYUI_DIR/.venv/bin/python}"
work="${NODES2_ACCEPTANCE_WORK_DIR:-$repo_root/temp/nodes2-acceptance}"
projects="${NODES2_ACCEPTANCE_PROJECTS:-inputs packs layout perf}"
inputs_port="${NODES2_ACCEPTANCE_INPUTS_PORT:-18461}"
packs_port="${NODES2_ACCEPTANCE_PACKS_PORT:-18462}"
perf_port="${NODES2_ACCEPTANCE_PERF_PORT:-18463}"
test_build="${NODES2_ACCEPTANCE_TEST_BUILD:-}"
prod_build="${NODES2_ACCEPTANCE_PROD_BUILD:-}"
grep_args=()
[[ -n ${NODES2_ACCEPTANCE_GREP:-} ]] && grep_args=(--grep "$NODES2_ACCEPTANCE_GREP")

export NODES2_ACCEPTANCE_RUN="${NODES2_ACCEPTANCE_RUN:-$(date +%Y-%m-%d_%H%M%S)-$("$python" -c 'import uuid; print(uuid.uuid4())')}"
export NODES2_ACCEPTANCE_BUILD="${NODES2_ACCEPTANCE_BUILD:-$(git -C "$repo_root" rev-parse --short=10 HEAD)}"
if [[ -n ${NODES2_ACCEPTANCE_VARIANT:-} ]]; then
  export NODES2_ACCEPTANCE_REPORT_DIR="${NODES2_ACCEPTANCE_REPORT_DIR:-nodes2-acceptance-report/$NODES2_ACCEPTANCE_RUN/$NODES2_ACCEPTANCE_VARIANT}"
fi
report_dir="${NODES2_ACCEPTANCE_REPORT_DIR:-nodes2-acceptance-report/$NODES2_ACCEPTANCE_RUN}"
[[ $report_dir = /* ]] || report_dir="$repo_root/$report_dir"
logs="$report_dir/logs"
mkdir -p "$logs" "$work"

wants() { [[ " $projects " == *" $1 "* ]]; }

servers=()
startup_pid=""
startup_backend=""
stop_servers() {
  if [[ -n $startup_pid ]]; then
    kill "$startup_pid" 2>/dev/null || true
    if wait "$startup_pid" 2>/dev/null; then
      servers+=("$(cat "$startup_backend/server.pid")")
    fi
  fi
  for pid in ${servers[@]+"${servers[@]}"}; do
    kill "$pid" 2>/dev/null || true
  done
  servers=()
}
trap stop_servers EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

serve() {
  local port=$1 backend=$2 frontend=$3
  shift 3
  startup_backend="$backend"
  "$here/serve.sh" "$port" "$backend" "$frontend" "$@" &
  startup_pid=$!
  wait "$startup_pid"
  servers+=("$(cat "$backend/server.pid")")
  startup_pid=""
}

run_project() {
  local project=$1 port=$2 backend=$3
  shift 3
  echo "$(date +%T) $project started"
  local status=0
  (
    cd "$repo_root"
    PLAYWRIGHT_TEST_URL="http://127.0.0.1:$port" \
      PLAYWRIGHT_SETUP_API_URL="http://127.0.0.1:$port" \
      TEST_COMFYUI_DIR="$backend" \
      pnpm exec playwright test --project="$project" --retries=0 --workers=1 \
      --reporter=line,./browser_tests/reporters/nodes2AcceptanceReporter.ts \
      --output="test-results/$NODES2_ACCEPTANCE_RUN/$project" ${grep_args[@]+"${grep_args[@]}"} "$@"
  ) >"$logs/$project.log" 2>&1 || status=$?
  echo "$(date +%T) $project finished (exit $status): $(grep -E '^ +[0-9]+ (passed|failed|flaky|skipped)' "$logs/$project.log" | tr -s ' ' | tr '\n' ' ')"
  return "$status"
}

cd "$repo_root"
if wants inputs && [[ -z $test_build ]]; then
  echo "Building the test bundle"
  pnpm build:test >"$logs/build-test.log" 2>&1
  test_build="$repo_root/dist/test"
fi
if { wants packs || wants layout || wants perf; } && [[ -z $prod_build ]]; then
  echo "Building the production bundle"
  NODE_ENV=production pnpm exec vite build --config vite.config.mts \
    --outDir "$work/dist-prod" --emptyOutDir >"$logs/build-prod.log" 2>&1
  prod_build="$work/dist-prod"
fi
if wants packs || wants layout; then
  echo "Installing the pinned packs"
  pnpm exec tsx "$here/setupPacks.ts" --backend "$work/packs" --python "$python"
fi

status=0
inputs_pid=""
if wants inputs; then
  serve "$inputs_port" "$work/inputs" "$test_build"
  run_project nodes2-acceptance "$inputs_port" "$work/inputs" &
  inputs_pid=$!
fi
if wants packs || wants layout; then
  read -r -a packs <"$work/packs/packs.txt" || true
  serve "$packs_port" "$work/packs" "$prod_build" "${packs[@]}"
  if wants packs; then run_project nodes2-acceptance-packs "$packs_port" "$work/packs" || status=$?; fi
  if wants layout; then run_project nodes2-acceptance-layout "$packs_port" "$work/packs" || status=$?; fi
fi
if [[ -n $inputs_pid ]]; then wait "$inputs_pid" || status=$?; fi

if wants perf; then
  stop_servers
  serve "$perf_port" "$work/perf" "$prod_build"
  run_project nodes2-acceptance-perf "$perf_port" "$work/perf" --grep-invert @slow || status=$?
fi

echo "Reports: $report_dir"
echo "All runs: $repo_root/nodes2-acceptance-report/index.html"
exit "$status"
