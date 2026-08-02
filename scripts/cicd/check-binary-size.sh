#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

DEFAULT_MAX_BYTES=1048576
PLAYBOOK_URL='https://app.notion.com/p/comfy-org/Frontend-Binary-Upload-Playbook-media-comfy-org-3b06d73d365081acb5bcd34170b84a59'

usage() {
  cat >&2 <<EOF
Usage: $0 [--base <ref>] [--head <ref>] [--max-bytes <n>]

Fails when the range <base>...<head> adds or grows a binary file larger than
--max-bytes. Whether a file counts as binary is git's own classification, so
no file extensions are hardcoded.

Defaults: --base origin/main --head HEAD --max-bytes ${DEFAULT_MAX_BYTES}
Environment: BASE_REF, HEAD_REF, MAX_BINARY_BYTES
EOF
}

base="${BASE_REF:-origin/main}"
head="${HEAD_REF:-HEAD}"
max_bytes="${MAX_BINARY_BYTES:-$DEFAULT_MAX_BYTES}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base)
      base="${2:-}"
      shift
      ;;
    --head)
      head="${2:-}"
      shift
      ;;
    --max-bytes)
      max_bytes="${2:-}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
  shift
done

if [[ ! $max_bytes =~ ^[0-9]+$ ]]; then
  echo "Error: --max-bytes must be a non-negative integer, got '${max_bytes}'" >&2
  exit 2
fi

if [ -z "$base" ] || [ -z "$head" ]; then
  echo 'Error: --base and --head must be non-empty refs' >&2
  exit 2
fi

human_size() {
  awk -v bytes="$1" 'BEGIN {
    split("B:KiB:MiB:GiB", unit, ":")
    i = 1
    while (bytes >= 1024 && i < 4) {
      bytes /= 1024
      i++
    }
    printf i == 1 ? "%d %s\n" : "%.1f %s\n", bytes, unit[i]
  }'
}

changes_file="$(mktemp)"
trap 'rm -f "$changes_file"' EXIT

git diff --numstat -z --diff-filter=AM "${base}...${head}" >"$changes_file"
mapfile -d '' -t changes <"$changes_file"

oversized=()
for change in "${changes[@]}"; do
  added_lines="${change%%$'\t'*}"
  # git reports "-" instead of a line count for files it considers binary
  [ "$added_lines" = '-' ] || continue

  path="${change#*$'\t'}"
  path="${path#*$'\t'}"

  size="$(git cat-file -s "${head}:${path}")"
  [ "$size" -gt "$max_bytes" ] || continue

  oversized+=("${size}"$'\t'"${path}")
done

limit_label="$(human_size "$max_bytes")"

if [ "${#oversized[@]}" -eq 0 ]; then
  echo "No binary files larger than ${limit_label} were added or grown."
  exit 0
fi

{
  echo "Binary files larger than ${limit_label} may not be committed to this repository:"
  for entry in "${oversized[@]}"; do
    size="${entry%%$'\t'*}"
    path="${entry#*$'\t'}"
    printf '  %s (%s)\n' "$path" "$(human_size "$size")"
  done
  echo
  echo 'Host the file on media.comfy.org and reference it by URL instead.'
  echo "Frontend Binary Upload Playbook: ${PLAYBOOK_URL}"
  echo
  echo "If it genuinely belongs in git, add the 'allow-large-binaries' label to the PR."
} >&2

exit 1
