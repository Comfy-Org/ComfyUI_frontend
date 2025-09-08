#!/bin/bash
set -e

# Deploy Playwright test reports to Cloudflare Pages and comment on PR
# Usage: ./pr-playwright-deploy-and-comment.sh <pr_number> <branch_name> <status> [start_time]

PR_NUMBER="$1"
BRANCH_NAME="$2"
STATUS="${3:-completed}"
START_TIME="${4:-$(date -u '+%m/%d/%Y, %I:%M:%S %p')}"

# Required environment variables
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

# Cloudflare variables only required for deployment
if [ "$STATUS" = "completed" ]; then
    : "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required for deployment}"
    : "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required for deployment}"
fi

# Configuration
COMMENT_MARKER="<!-- PLAYWRIGHT_TEST_STATUS -->"
BROWSERS=("chromium" "chromium-2x" "chromium-0-5x" "mobile-chrome")

# Deploy a single browser report
deploy_report() {
    local dir="$1"
    local browser="$2"
    local branch="$3"
    
    [ ! -d "$dir" ] && echo "failed" && return
    
    # Project name with dots converted to dashes
    local project="comfyui-playwright-${browser//\./-}"
    
    echo "Deploying $browser..."
    
    # Try deployment up to 3 times
    for i in {1..3}; do
        if output=$(npx wrangler pages deploy "$dir" \
            --project-name="$project" \
            --branch="$branch" 2>&1); then
            
            # Extract URL from output
            url=$(echo "$output" | grep -oE 'https://[a-z0-9.-]+\.pages\.dev' | head -1)
            echo "${url:-https://${branch}.${project}.pages.dev}"
            return
        fi
        [ $i -lt 3 ] && sleep 10
    done
    
    echo "failed"
}

# Post or update GitHub comment
post_comment() {
    local body="$1"
    local temp_file=$(mktemp)
    echo "$body" > "$temp_file"
    
    if command -v gh &> /dev/null; then
        # Find existing comment
        existing=$(gh pr view "$PR_NUMBER" --comments --json comments \
            --jq ".comments[] | select(.body | contains(\"$COMMENT_MARKER\")) | .id" | head -1)
        
        if [ -n "$existing" ]; then
            gh pr comment "$PR_NUMBER" --edit-last --body-file "$temp_file"
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
    comment=$(cat <<EOF
$COMMENT_MARKER
## 🎭 Playwright Test Results

<img alt='loading' src='https://github.com/user-attachments/assets/755c86ee-e445-4ea8-bc2c-cca85df48686' width='14px' height='14px'/> **Tests are starting...**

⏰ Started at: $START_TIME UTC

### 🚀 Running Tests
- 🧪 **chromium**: Running tests...
- 🧪 **chromium-0.5x**: Running tests...
- 🧪 **chromium-2x**: Running tests...
- 🧪 **mobile-chrome**: Running tests...

---
⏱️ Please wait while tests are running...
EOF
)
    post_comment "$comment"
    
else
    # Deploy and post completion comment
    sanitized_branch=$(echo "$BRANCH_NAME" | tr '[:upper:]' '[:lower:]' | \
        sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
    
    # Deploy all reports
    declare -a urls
    for browser in "${BROWSERS[@]}"; do
        if [ -d "reports/playwright-report-$browser" ]; then
            url=$(deploy_report "reports/playwright-report-$browser" "$browser" "$sanitized_branch")
            urls+=("$url")
        else
            urls+=("failed")
        fi
    done
    
    # Generate completion comment
    comment=$(cat <<EOF
$COMMENT_MARKER
## 🎭 Playwright Test Results

✅ **Tests completed successfully!**

⏰ Completed at: $(date -u '+%m/%d/%Y, %I:%M:%S %p') UTC

### 📊 Test Reports by Browser
EOF
)
    
    for i in "${!BROWSERS[@]}"; do
        if [ "${urls[$i]}" != "failed" ] && [ -n "${urls[$i]}" ]; then
            comment+=$'\n'"- ✅ **${BROWSERS[$i]}**: [View Report](${urls[$i]})"
        else
            comment+=$'\n'"- ❌ **${BROWSERS[$i]}**: Deployment failed"
        fi
    done
    
    comment+=$'\n\n'"---"$'\n'"🎉 Click on the links above to view detailed test results for each browser configuration."
    
    post_comment "$comment"
fi