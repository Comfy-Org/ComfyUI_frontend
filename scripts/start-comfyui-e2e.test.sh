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
example_packs=(how_to_frontend_nodes how_to_widgets how_to_graph_interaction how_to_execution)
for pack in "${example_packs[@]}"; do
  mkdir -p "$fixture/examples/node-api/$pack/web"
  printf '%s\n' "$pack" > "$fixture/examples/node-api/$pack/web/pack.js"
  chmod 750 "$fixture/examples/node-api/$pack" "$fixture/examples/node-api/$pack/web"
  chmod 640 "$fixture/examples/node-api/$pack/web/pack.js"
done

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
    example_mounts=0
    while (($#)); do
      if [[ "$1" == type=bind,src=*,dst=/ComfyUI/custom_nodes/*,readonly ]]; then
        source="${1#type=bind,src=}"
        source="${source%,dst=*}"
        name="${1##*/custom_nodes/}"
        name="${name%,readonly}"
        [[ "$source" != "$SOURCE_REPO"/* ]]
        [[ -z "$(find "$source" \( \( -type f ! -perm -o=r \) -o \( -type d ! -perm -o=rx \) \) -print -quit)" ]]
        if [[ "$name" == ComfyUI_devtools ]]; then
          mount_source="$source"
        else
          [[ "$(cat "$source/web/pack.js")" == "$name" ]]
          example_mounts=$((example_mounts + 1))
        fi
      fi
      shift
    done
    [[ -n "$mount_source" ]]
    [[ $example_mounts == 4 ]]
    [[ "$(cat "$mount_source/fixture.txt")" == fixture ]]
    cmp "$SOURCE_REPO/tools/devtools/nested/fixture.bin" "$mount_source/nested/fixture.bin"
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
    SOURCE_REPO="$fixture" \
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
