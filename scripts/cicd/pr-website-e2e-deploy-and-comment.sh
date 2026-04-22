#!/bin/bash
set -e

# Deploy website Playwright report to Cloudflare Pages and comment on PR
# Usage: ./pr-website-e2e-deploy-and-comment.sh <pr_number> <branch_name> <status>

# Input validation
case "$1" in
    ''|*[!0-9]*)
        echo "Error: PR_NUMBER must be numeric" >&2
        exit 1
        ;;
esac
PR_NUMBER="$1"

BRANCH_NAME=$(echo "$2" | sed 's/[^a-zA-Z0-9._/-]//g')
if [ -z "$BRANCH_NAME" ]; then
    echo "Error: Invalid or empty branch name" >&2
    exit 1
fi

STATUS="${3:-completed}"
case "$STATUS" in
    starting|completed) ;;
    *)
        echo "Error: STATUS must be 'starting' or 'completed'" >&2
        exit 1
        ;;
esac

# Required environment variables
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

if [ "$STATUS" = "completed" ]; then
    : "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required for deployment}"
    : "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required for deployment}"
fi

# Configuration
COMMENT_MARKER="<!-- WEBSITE_E2E_STATUS -->"
PROJECT_NAME="comfyui-website-e2e"
REPORT_DIR="website-playwright-report"

# Install wrangler if not available
if ! command -v wrangler > /dev/null 2>&1; then
    echo "Installing wrangler v4..." >&2
    npm install -g wrangler@^4.0.0 >&2 || {
        echo "Failed to install wrangler" >&2
    }
fi

deploy_report() {
    dir="$1"
    branch="$2"

    [ ! -d "$dir" ] && echo "failed" && return

    echo "Deploying website E2E report to project $PROJECT_NAME on branch $branch..." >&2

    i=1
    while [ $i -le 3 ]; do
        echo "Deployment attempt $i of 3..." >&2
        if output=$(wrangler pages deploy "$dir" \
            --project-name="$PROJECT_NAME" \
            --branch="$branch" 2>&1); then

            url=$(echo "$output" | grep -oE 'https://[a-zA-Z0-9.-]+\.pages\.dev\S*' | head -1)
            result="${url:-https://${branch}.${PROJECT_NAME}.pages.dev}"
            echo "Success! URL: $result" >&2
            echo "$result"
            return
        else
            echo "Deployment failed on attempt $i: $output" >&2
        fi
        [ $i -lt 3 ] && sleep 10
        i=$((i + 1))
    done

    echo "failed"
}

post_comment() {
    body="$1"
    temp_file=$(mktemp)
    echo "$body" > "$temp_file"

    if command -v gh > /dev/null 2>&1; then
        existing=$(gh api "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" \
            --jq ".[] | select(.body | contains(\"$COMMENT_MARKER\")) | .id" | head -1)

        if [ -n "$existing" ]; then
            gh api --method PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$existing" \
                --field body="$(cat "$temp_file")"
        else
            gh pr comment "$PR_NUMBER" --body-file "$temp_file"
        fi
    else
        echo "GitHub CLI not available, outputting comment:"
        cat "$temp_file"
    fi

    rm -f "$temp_file"
}

# Main execution
if [ "$STATUS" = "starting" ]; then
    comment="$COMMENT_MARKER
## 🌐 Website E2E: ⏳ Running..."
    post_comment "$comment"

elif [ "$STATUS" = "completed" ]; then
    cloudflare_branch=$(echo "$BRANCH_NAME" | tr '[:upper:]' '[:lower:]' | \
        sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')

    WORKFLOW_CONCLUSION="${WORKFLOW_CONCLUSION:-success}"
    WORKFLOW_URL="${WORKFLOW_URL:-}"

    deployment_url=""
    if [ "$WORKFLOW_CONCLUSION" = "success" ] && [ -d "$REPORT_DIR" ]; then
        echo "Found report, deploying..."
        url=$(deploy_report "$REPORT_DIR" "$cloudflare_branch")
        if [ "$url" != "failed" ] && [ -n "$url" ]; then
            deployment_url="$url"
        fi
    fi

    if [ "$WORKFLOW_CONCLUSION" = "success" ]; then
        status_icon="✅"
        status_text="Passed"
    elif [ "$WORKFLOW_CONCLUSION" = "cancelled" ]; then
        status_icon="⚪"
        status_text="Cancelled"
    else
        status_icon="❌"
        status_text="Failed"
    fi

    header="## 🌐 Website E2E: $status_icon $status_text"
    if [ -n "$deployment_url" ]; then
        header="$header — [View Report]($deployment_url)"
    fi

    details="<details>
<summary>Details</summary>

🕐 Completed at: $(date -u '+%m/%d/%Y, %I:%M:%S %p') UTC

**Links**
- [🔄 View Workflow Run]($WORKFLOW_URL)"

    if [ -n "$deployment_url" ]; then
        details="$details
- [📊 View Report]($deployment_url)"
    elif [ "$WORKFLOW_CONCLUSION" != "success" ]; then
        details="$details
- ⚠️ Report deployment skipped (tests did not pass)"
    fi

    details="$details

</details>"

    comment="$COMMENT_MARKER
$header

$details"

    post_comment "$comment"
fi
