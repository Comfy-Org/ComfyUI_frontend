#!/usr/bin/env bash
# Batch-trigger QA runs by creating and pushing sno-qa-* branches.
#
# Usage:
#   ./scripts/qa-batch.sh 10394 10238 9996          # Trigger specific numbers
#   ./scripts/qa-batch.sh --from tmp/issues.md --top 5  # From triage file
#   ./scripts/qa-batch.sh --dry-run 10394 10238     # Preview only
#   ./scripts/qa-batch.sh --cleanup                 # Delete old sno-qa-* branches

set -euo pipefail

DELAY=5
DRY_RUN=false
CLEANUP=false
FROM_FILE=""
TOP_N=0
NUMBERS=()

die() { echo "error: $*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: qa-batch.sh [options] [numbers...]

Options:
  --from <file>   Extract numbers from a triage markdown file
  --top <N>       Take first N entries from Tier 1 (requires --from)
  --dry-run       Print what would happen without pushing
  --cleanup       Delete all sno-qa-* remote branches
  --delay <secs>  Seconds between pushes (default: 5)
  -h, --help      Show this help
EOF
  exit 0
}

# --- Parse args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)     FROM_FILE="$2"; shift 2 ;;
    --top)      TOP_N="$2"; shift 2 ;;
    --dry-run)  DRY_RUN=true; shift ;;
    --cleanup)  CLEANUP=true; shift ;;
    --delay)    DELAY="$2"; shift 2 ;;
    -h|--help)  usage ;;
    -*)         die "unknown option: $1" ;;
    *)          NUMBERS+=("$1"); shift ;;
  esac
done

# --- Cleanup mode ---
if $CLEANUP; then
  echo "Fetching remote sno-qa-* branches..."
  branches=$(git ls-remote --heads origin 'refs/heads/sno-qa-*' | awk '{print $2}' | sed 's|refs/heads/||')

  if [[ -z "$branches" ]]; then
    echo "No sno-qa-* branches found on remote."
    exit 0
  fi

  echo "Found branches:"
  while IFS= read -r b; do echo "  $b"; done <<< "$branches"
  echo

  if $DRY_RUN; then
    echo "[dry-run] Would delete the above branches."
    exit 0
  fi

  read -rp "Delete all of the above? [y/N] " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
  fi

  for branch in $branches; do
    echo "Deleting origin/$branch..."
    git push origin --delete "$branch"
  done
  echo "Done. Cleaned up $(echo "$branches" | wc -l | tr -d ' ') branches."
  exit 0
fi

# --- Extract numbers from markdown ---
if [[ -n "$FROM_FILE" ]]; then
  [[ -f "$FROM_FILE" ]] || die "file not found: $FROM_FILE"
  [[ "$TOP_N" -gt 0 ]] || die "--top N required with --from"

  # Extract Tier 1 table rows: | N | [#NNNNN](...) | ...
  # Stop at the next ## heading after Tier 1
  extracted=$(awk '/^## Tier 1/,/^## Tier [^1]/' "$FROM_FILE" \
    | grep -oP '\[#\K\d+' \
    | head -n "$TOP_N")

  if [[ -z "$extracted" ]]; then
    die "no numbers found in $FROM_FILE"
  fi

  while IFS= read -r num; do
    NUMBERS+=("$num")
  done <<< "$extracted"
fi

[[ ${#NUMBERS[@]} -gt 0 ]] || die "no numbers specified. Use positional args or --from/--top."

# --- Validate ---
for num in "${NUMBERS[@]}"; do
  [[ "$num" =~ ^[0-9]+$ ]] || die "invalid number: $num"
done

# Deduplicate
mapfile -t NUMBERS < <(printf '%s\n' "${NUMBERS[@]}" | sort -un)

# --- Push branches ---
echo "Triggering QA for: ${NUMBERS[*]}"
if $DRY_RUN; then
  echo "[dry-run]"
fi
echo

pushed=()
skipped=()

# Fetch remote refs once
remote_refs=$(git ls-remote --heads origin 'refs/heads/sno-qa-*' 2>/dev/null | awk '{print $2}' | sed 's|refs/heads/||')

for num in "${NUMBERS[@]}"; do
  branch="sno-qa-$num"

  # Check if already exists on remote
  if echo "$remote_refs" | grep -qx "$branch"; then
    echo "  skip: $branch (already exists on remote)"
    skipped+=("$num")
    continue
  fi

  if $DRY_RUN; then
    echo "  would push: $branch"
    pushed+=("$num")
    continue
  fi

  # Create branch at current HEAD and push
  git branch -f "$branch" HEAD
  git push origin "$branch"
  pushed+=("$num")
  echo "  pushed: $branch"

  # Clean up local branch
  git branch -D "$branch" 2>/dev/null || true

  # Delay between pushes to avoid CI concurrency storm
  if [[ "$num" != "${NUMBERS[-1]}" ]]; then
    echo "  waiting ${DELAY}s..."
    sleep "$DELAY"
  fi
done

# --- Summary ---
echo
echo "=== Summary ==="
echo "Triggered: ${#pushed[@]}"
echo "Skipped:   ${#skipped[@]}"

if [[ ${#pushed[@]} -gt 0 ]]; then
  echo
  echo "Triggered numbers: ${pushed[*]}"
  repo_url=$(git remote get-url origin | sed 's/\.git$//' | sed 's|git@github.com:|https://github.com/|')
  echo "Actions: ${repo_url}/actions"
fi

if [[ ${#skipped[@]} -gt 0 ]]; then
  echo
  echo "Skipped (already exist): ${skipped[*]}"
  echo "Use --cleanup first to remove old branches."
fi
