#!/bin/bash
set -e

# Deploy video walkthrough(s) of newly-added Playwright spec files to
# Cloudflare Pages and write section markdown for the unified PR report
# comment. Companion to pr-playwright-deploy-and-comment.sh, following the
# same deploy-then-write-SUMMARY_FILE contract so the caller can upsert the
# result via the upsert-comment-section action.
#
# Usage: ./pr-video-deploy-and-comment.sh <branch_name>
#
# Required env vars:
#   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID - Cloudflare Pages deploy creds
#   TEST_RESULTS_DIR - directory containing the recorded video.webm files
#   VIDEO_MANIFEST   - JSON file from extract-playwright-videos.ts
#                      ([{name, file, relativePath}, ...])
#   SUMMARY_FILE     - where to write the generated markdown section

BRANCH_NAME=$(echo "$1" | sed 's/[^a-zA-Z0-9._/-]//g')
if [ -z "$BRANCH_NAME" ]; then
    echo "Error: Invalid or empty branch name" >&2
    exit 1
fi

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"
: "${TEST_RESULTS_DIR:?TEST_RESULTS_DIR is required}"
: "${VIDEO_MANIFEST:?VIDEO_MANIFEST is required}"
: "${SUMMARY_FILE:?SUMMARY_FILE is required}"

if [ ! -d "$TEST_RESULTS_DIR" ] || [ ! -f "$VIDEO_MANIFEST" ]; then
    echo "No video test-results/manifest found; skipping video deploy" >&2
    printf '%s\n' "## 🎬 New-test video: no video was produced" > "$SUMMARY_FILE"
    exit 0
fi

video_count=$(jq 'length' "$VIDEO_MANIFEST" 2>/dev/null || echo 0)
if [ "$video_count" -eq 0 ]; then
    printf '%s\n' "## 🎬 New-test video: no video attachments found" > "$SUMMARY_FILE"
    exit 0
fi

if ! command -v wrangler > /dev/null 2>&1; then
    echo "Installing wrangler v4..." >&2
    npm install -g wrangler@^4.0.0 >&2 || {
        echo "Failed to install wrangler" >&2
        printf '%s\n' "## 🎬 New-test video: ❌ deployment tooling unavailable" > "$SUMMARY_FILE"
        exit 0
    }
fi

# Cloudflare-compatible branch name (lowercase, only alphanumeric and dashes).
# Reuse the existing, already-provisioned "comfyui-playwright-chromium"
# Pages project (proven to work for trace report deploys) rather than a new
# "comfyui-playwright-videos" project, which isn't provisioned in Cloudflare
# and fails to deploy. A "-videos" branch suffix keeps this deployment
# distinct from the report deploy that runs for the same PR branch.
cloudflare_branch=$(echo "$BRANCH_NAME" | tr '[:upper:]' '[:lower:]' | \
    sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
project="comfyui-playwright-chromium"
cloudflare_branch="${cloudflare_branch}-videos"

echo "Deploying videos to project $project on branch $cloudflare_branch..." >&2

url=""
i=1
while [ $i -le 3 ]; do
    echo "Deployment attempt $i of 3..." >&2
    if output=$(wrangler pages deploy "$TEST_RESULTS_DIR" \
        --project-name="$project" \
        --branch="$cloudflare_branch" 2>&1); then
        url=$(echo "$output" | grep -oE 'https://[a-zA-Z0-9.-]+\.pages\.dev\S*' | head -1)
        [ -z "$url" ] && url="https://${cloudflare_branch}.${project}.pages.dev"
        echo "Success! URL: $url" >&2
        break
    fi
    echo "Deployment failed on attempt $i: $output" >&2
    [ $i -lt 3 ] && sleep 10
    i=$((i + 1))
done

if [ -z "$url" ]; then
    printf '%s\n' "## 🎬 New-test video: ❌ deployment failed" > "$SUMMARY_FILE"
    exit 0
fi

comment="## 🎬 New-test video walkthrough available

<details>
<summary>🎬 New-test video walkthrough</summary>

This PR adds new test spec file(s) — here's a video walkthrough of just the new test(s) (existing suite runs without video to keep CI cost down):
"

while IFS= read -r entry; do
    [ -z "$entry" ] && continue
    name=$(echo "$entry" | jq -r '.name')
    relative_path=$(echo "$entry" | jq -r '.relativePath')
    comment="$comment
- [$name](${url}/${relative_path})"
done < <(jq -c '.[]' "$VIDEO_MANIFEST")

comment="$comment

</details>"

printf '%s\n' "$comment" > "$SUMMARY_FILE"
