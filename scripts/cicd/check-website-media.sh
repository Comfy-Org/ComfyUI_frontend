#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

WEBSITE_DIR='apps/website/'
TEST_FIXTURES_DIR='apps/website/e2e/'
MEDIA_EXTENSION='\.(png|jpe?g|webp|avif|gif|mp4|webm|mov|m4v|mp3|wav)$'
PLAYBOOK_URL='https://app.notion.com/p/comfy-org/Frontend-Binary-Upload-Playbook-media-comfy-org-3b06d73d365081acb5bcd34170b84a59'

usage() {
  cat >&2 <<EOF
Usage: $0 [--base <ref>] [--head <ref>]

Fails when the range <base>...<head> adds a raster image, video, or audio
file under ${WEBSITE_DIR}. Files that already exist on the base are
grandfathered: editing, moving, or deleting them is allowed. SVG and the
browser test fixtures under ${TEST_FIXTURES_DIR} are allowed.

Defaults: --base origin/main --head HEAD
Environment: BASE_REF, HEAD_REF
EOF
}

base="${BASE_REF:-origin/main}"
head="${HEAD_REF:-HEAD}"

require_value() {
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

added_file="$(mktemp)"
trap 'rm -f "$added_file"' EXIT

git diff --name-only -z --find-renames=100% --diff-filter=A "${base}...${head}" -- \
  "$WEBSITE_DIR" ":(exclude)${TEST_FIXTURES_DIR}" >"$added_file"

mapfile -d '' -t added <"$added_file"

blocked=()
for path in "${added[@]}"; do
  if [[ ${path,,} =~ $MEDIA_EXTENSION ]]; then
    blocked+=("$path")
  fi
done

if [ "${#blocked[@]}" -eq 0 ]; then
  echo "No images, video, or audio were added under ${WEBSITE_DIR}."
  exit 0
fi

{
  echo "Images, video, and audio may not be committed under ${WEBSITE_DIR}:"
  printf '  %s\n' "${blocked[@]}"
  echo
  echo 'Upload each file to media.comfy.org and reference it by its'
  echo 'https://media.comfy.org/... URL instead. SVG is still allowed in git.'
  echo "Frontend Binary Upload Playbook: ${PLAYBOOK_URL}"
} >&2

exit 1
