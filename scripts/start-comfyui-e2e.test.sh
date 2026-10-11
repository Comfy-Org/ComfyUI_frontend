#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT

fixture="$test_root/repo"
mkdir -p \
  "$fixture/scripts" \
  "$fixture/tools/devtools/nested" \
  "$test_root/bin"
cp "$repo_root/scripts/start-comfyui-e2e.sh" "$fixture/scripts/"
printf '%s\n' 'fixture' > "$fixture/tools/devtools/fixture.txt"
printf '\000\377nested\n' > "$fixture/tools/devtools/nested/fixture.bin"
chmod 750 "$fixture/tools/devtools"
chmod 640 "$fixture/tools/devtools/fixture.txt"
chmod 750 "$fixture/tools/devtools/nested"
chmod 640 "$fixture/tools/devtools/nested/fixture.bin"

cat > "$test_root/bin/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
  info)
    exit 0
    ;;
  image)
    exit 0
    ;;
  run)
    mount_source=""
    while (($#)); do
      if [[ "$1" == type=bind,src=*,dst=/ComfyUI/custom_nodes/ComfyUI_devtools,readonly ]]; then
        mount_source="${1#type=bind,src=}"
        mount_source="${mount_source%,dst=*}"
      fi
      shift
    done
    [[ -n "$mount_source" ]]
    [[ "$mount_source" != "$SOURCE_DEVTOOLS" ]]
    [[ -z "$(find "$mount_source" \( \( -type f ! -perm -o=r \) -o \( -type d ! -perm -o=rx \) \) -print -quit)" ]]
    [[ "$(cat "$mount_source/fixture.txt")" == fixture ]]
    cmp "$SOURCE_DEVTOOLS/nested/fixture.bin" "$mount_source/nested/fixture.bin"
    printf '%s\n' "$mount_source" > "$CAPTURE_MOUNT"
    exit "${DOCKER_RUN_STATUS:-0}"
    ;;
  rm)
    exit 0
    ;;
esac
EOF
chmod +x "$test_root/bin/docker"

run_launcher() {
  local status=$1
  local tmpdir=$2
  mkdir -p "$tmpdir"
  PATH="$test_root/bin:$PATH" \
    TMPDIR="$tmpdir" \
    SOURCE_DEVTOOLS="$fixture/tools/devtools" \
    CAPTURE_MOUNT="$test_root/mount" \
    DOCKER_RUN_STATUS="$status" \
    AMP_ORB='' \
    bash "$fixture/scripts/start-comfyui-e2e.sh"
}

run_launcher 0 "$test_root/success"
[[ ! -e "$(cat "$test_root/mount")" ]]
[[ -z "$(find "$test_root/success" -mindepth 1 -print -quit)" ]]

set +e
run_launcher 23 "$test_root/failure" >/dev/null 2>&1
status=$?
set -e
[[ $status == 23 ]]
[[ ! -e "$(cat "$test_root/mount")" ]]
[[ -z "$(find "$test_root/failure" -mindepth 1 -print -quit)" ]]

echo 'start-comfyui-e2e regression: passed'
