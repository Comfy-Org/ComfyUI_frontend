#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

DEFAULT_MAX_BYTES=1048576
PLAYBOOK_URL='https://app.notion.com/p/comfy-org/Frontend-Binary-Upload-Playbook-media-comfy-org-3b06d73d365081acb5bcd34170b84a59'

usage() {
  cat >&2 <<EOF
Usage: $0 [--base <ref>] [--head <ref>] [--max-bytes <n>]

Fails when the range <base>...<head> introduces a binary file larger than
--max-bytes, whether by adding it or by replacing an existing one. Moving a
binary without changing it is allowed. Whether a file counts as binary is
git's own classification, so no file extensions are hardcoded.

Defaults: --base origin/main --head HEAD --max-bytes ${DEFAULT_MAX_BYTES}
Environment: BASE_REF, HEAD_REF, MAX_BINARY_BYTES
EOF
}

base="${BASE_REF:-origin/main}"
head="${HEAD_REF:-HEAD}"
max_bytes="${MAX_BINARY_BYTES:-$DEFAULT_MAX_BYTES}"

require_value() {
  # git refs cannot start with a dash, so a --flag here means the value was omitted
  if [ "$#" -lt 2 ] || [[ $2 == --* ]]; then
    echo "Error: $1 requires a value" >&2
    exit 2
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base)
      require_value "$@"
      base="$2"
      shift
      ;;
    --head)
      require_value "$@"
      head="$2"
      shift
      ;;
    --max-bytes)
      require_value "$@"
      max_bytes="$2"
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

numstat_file="$(mktemp)"
raw_file="$(mktemp)"
trap 'rm -f "$numstat_file" "$raw_file"' EXIT

# -M keeps rename detection deterministic regardless of the caller's diff.renames
git diff --numstat -z -M "${base}...${head}" >"$numstat_file"
git diff --raw -z -M --no-abbrev --diff-filter=AMR "${base}...${head}" >"$raw_file"

mapfile -d '' -t numstat_records <"$numstat_file"
mapfile -d '' -t raw_records <"$raw_file"

# Renamed and copied entries carry an empty path field followed by two extra
# records holding the source and destination paths.
declare -A is_binary=()
index=0
while [ "$index" -lt "${#numstat_records[@]}" ]; do
  record="${numstat_records[$index]}"
  path="${record#*$'\t'}"
  path="${path#*$'\t'}"

  if [ -z "$path" ]; then
    path="${numstat_records[$((index + 2))]}"
    index=$((index + 3))
  else
    index=$((index + 1))
  fi

  # git reports "-" instead of a line count for files it considers binary
  if [ "${record%%$'\t'*}" = '-' ]; then
    is_binary["$path"]=1
  fi
done

oversized=()
index=0
while [ "$index" -lt "${#raw_records[@]}" ]; do
  read -r _ _ base_blob head_blob change_type <<<"${raw_records[$index]#:}"

  case "$change_type" in
    R* | C*)
      path="${raw_records[$((index + 2))]}"
      index=$((index + 3))
      ;;
    *)
      path="${raw_records[$((index + 1))]}"
      index=$((index + 2))
      ;;
  esac

  [ -n "${is_binary["$path"]:-}" ] || continue
  # An unchanged blob at a new path is a move, which adds no weight to history
  [ "$base_blob" != "$head_blob" ] || continue

  size="$(git cat-file -s "$head_blob")"
  [ "$size" -gt "$max_bytes" ] || continue

  oversized+=("${size}"$'\t'"${path}")
done

limit_label="$(human_size "$max_bytes")"

if [ "${#oversized[@]}" -eq 0 ]; then
  echo "No binary files larger than ${limit_label} were added or replaced."
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
