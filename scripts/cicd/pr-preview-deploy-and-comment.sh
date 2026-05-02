#!/bin/bash
set -e

# Deploy frontend preview to Cloudflare Pages and comment on PR
# Usage: ./pr-preview-deploy-and-comment.sh <pr_number> <status>

# Input validation
# Validate PR number is numeric
case "$1" in
    ''|*[!0-9]*)
        echo "Error: PR_NUMBER must be numeric" >&2
        exit 1
        ;;
esac
PR_NUMBER="$1"

# Validate status parameter
STATUS="${2:-completed}"
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

# Cloudflare variables only required for deployment
if [ "$STATUS" = "completed" ]; then
    : "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required for deployment}"
    : "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required for deployment}"
fi

# Configuration
COMMENT_MARKER="<!-- COMFYUI_PREVIEW_DEPLOY -->"

# Resolve wrangler invocation: prefer a locally-available binary, otherwise
# run via pnpm dlx to honour the repo's package-manager policy.
if command -v wrangler > /dev/null 2>&1; then
    WRANGLER="wrangler"
else
    WRANGLER="pnpm dlx wrangler@^4.0.0"
fi

# Deploy frontend preview, WARN: ensure inputs are sanitized before calling this function
deploy_preview() {
    dir="$1"
    branch="$2"
    
    [ ! -d "$dir" ] && echo "failed" && return
    
    project="comfy-ui"
    
    echo "Deploying frontend preview to project $project on branch $branch..." >&2
    
    # Try deployment up to 3 times
    i=1
    while [ $i -le 3 ]; do
        echo "Deployment attempt $i of 3..." >&2
        # Branch is already sanitized, use it directly
        if output=$($WRANGLER pages deploy "$dir" \
            --project-name="$project" \
            --branch="$branch" 2>&1); then

            # Prefer the branch alias URL over the deployment hash URL so the
            # link in the PR comment stays stable across redeploys.
            branch_url="https://${branch}.${project}.pages.dev"
            if echo "$output" | grep -qF "$branch_url"; then
                result="$branch_url"
            else
                # Fall back to first pages.dev URL in wrangler output
                url=$(echo "$output" | grep -oE 'https://[a-zA-Z0-9.-]+\.pages\.dev\S*' | head -1)
                result="${url:-$branch_url}"
            fi
            echo "Success! URL: $result" >&2
            echo "$result"  # Only this goes to stdout for capture
            return
        else
            echo "Deployment failed on attempt $i: $output" >&2
        fi
        [ $i -lt 3 ] && sleep 10
        i=$((i + 1))
    done
    
    echo "failed"
}

# Post or update GitHub comment
post_comment() {
    body="$1"
    temp_file=$(mktemp)
    echo "$body" > "$temp_file"
    
    if command -v gh > /dev/null 2>&1; then
        # Find existing comment ID
        existing=$(gh api "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" \
            --jq ".[] | select(.body | contains(\"$COMMENT_MARKER\")) | .id" | head -1)
        
        if [ -n "$existing" ]; then
            # Update specific comment by ID
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
    # Post starting comment
    comment="$COMMENT_MARKER
## 🌐 Frontend Preview: <img alt='loading' src='https://github.com/user-attachments/assets/755c86ee-e445-4ea8-bc2c-cca85df48686' width='14px' height='14px'/> Building..."
    post_comment "$comment"
    
elif [ "$STATUS" = "completed" ]; then
    # Deploy and post completion comment
    # Convert branch name to Cloudflare-compatible format (lowercase, only alphanumeric and dashes)
    # Falls back to pr-$PR_NUMBER if BRANCH_NAME is unset
    if [ -n "$BRANCH_NAME" ]; then
        cloudflare_branch=$(echo "$BRANCH_NAME" | tr '[:upper:]' '[:lower:]' | \
            sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
    else
        cloudflare_branch="pr-$PR_NUMBER"
    fi
    
    echo "Looking for frontend build in: $(pwd)/dist"
    
    # Deploy preview if build exists
    deployment_url="Not deployed"
    if [ -d "dist" ]; then
        echo "Found frontend build, deploying..."
        url=$(deploy_preview "dist" "$cloudflare_branch")
        if [ "$url" != "failed" ] && [ -n "$url" ]; then
            deployment_url="[🌐 Open Preview]($url)"
        else
            deployment_url="Deployment failed"
        fi
    else
        echo "Frontend build not found at dist"
    fi
    
    # Get workflow conclusion from environment or default to success
    WORKFLOW_CONCLUSION="${WORKFLOW_CONCLUSION:-success}"
    WORKFLOW_URL="${WORKFLOW_URL:-}"
    
    # Generate compact header based on conclusion
    if [ "$WORKFLOW_CONCLUSION" = "success" ]; then
        status_icon="✅"
        status_text="Built"
    elif [ "$WORKFLOW_CONCLUSION" = "skipped" ]; then
        status_icon="⏭️"
        status_text="Skipped"
    elif [ "$WORKFLOW_CONCLUSION" = "cancelled" ]; then
        status_icon="🚫"
        status_text="Cancelled"
    else
        status_icon="❌"
        status_text="Failed"
    fi

    # Build compact header with optional preview link
    header="## 🌐 Frontend Preview: $status_icon $status_text"
    if [ "$deployment_url" != "Not deployed" ] && [ "$deployment_url" != "Deployment failed" ] && [ "$WORKFLOW_CONCLUSION" = "success" ]; then
        header="$header — $deployment_url"
    fi

    # Build details section
    details="<details>
<summary>Details</summary>

⏰ Completed at: $(date -u '+%m/%d/%Y, %I:%M:%S %p') UTC

**Links**
- [📊 View Workflow Run]($WORKFLOW_URL)"

    if [ "$deployment_url" != "Not deployed" ]; then
        if [ "$deployment_url" = "Deployment failed" ]; then
            details="$details
- ❌ Preview deployment failed"
        elif [ "$WORKFLOW_CONCLUSION" != "success" ]; then
            details="$details
- ⚠️ Build failed — $deployment_url"
        fi
    elif [ "$WORKFLOW_CONCLUSION" != "success" ]; then
        details="$details
- ⏭️ Preview deployment skipped (build did not succeed)"
    fi

    details="$details

</details>"

    comment="$COMMENT_MARKER
$header

$details"
    
    post_comment "$comment"
fi
