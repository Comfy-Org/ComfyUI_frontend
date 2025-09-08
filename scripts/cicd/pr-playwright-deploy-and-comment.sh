#!/bin/sh
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
# Use dot notation for artifact names (as Playwright creates them)
BROWSERS="chromium chromium-2x chromium-0.5x mobile-chrome"

# Deploy a single browser report
deploy_report() {
    dir="$1"
    browser="$2"
    branch="$3"
    
    [ ! -d "$dir" ] && echo "failed" && return
    
    # Install wrangler if not available
    if ! command -v wrangler > /dev/null 2>&1; then
        echo "Installing wrangler..."
        npm install -g wrangler
    fi
    
    # Project name with dots converted to dashes for Cloudflare
    sanitized_browser=$(echo "$browser" | sed 's/\./-/g')
    project="comfyui-playwright-${sanitized_browser}"
    
    echo "Deploying $browser to project $project on branch $branch..."
    
    # Try deployment up to 3 times
    i=1
    while [ $i -le 3 ]; do
        echo "Deployment attempt $i of 3..."
        if output=$(npx wrangler pages deploy "$dir" \
            --project-name="$project" \
            --branch="$branch" 2>&1); then
            
            # Extract URL from output
            url=$(echo "$output" | grep -oE 'https://[a-z0-9.-]+\.pages\.dev' | head -1)
            result="${url:-https://${branch}.${project}.pages.dev}"
            echo "Success! URL: $result"
            echo "$result"
            return
        else
            echo "Deployment failed on attempt $i: $output"
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
    
    echo "Looking for reports in: $(pwd)/reports"
    echo "Available reports:"
    ls -la reports/ 2>/dev/null || echo "Reports directory not found"
    
    # Deploy all reports and collect URLs
    urls=""
    for browser in $BROWSERS; do
        if [ -d "reports/playwright-report-$browser" ]; then
            echo "Found report for $browser, deploying..."
            url=$(deploy_report "reports/playwright-report-$browser" "$browser" "$sanitized_branch")
            echo "Deployment result for $browser: $url"
        else
            echo "Report not found for $browser at reports/playwright-report-$browser"
            url="failed"
        fi
        # Append URL to list (space-separated)
        if [ -z "$urls" ]; then
            urls="$url"
        else
            urls="$urls $url"
        fi
    done
    
    # Generate completion comment
    comment="$COMMENT_MARKER
## 🎭 Playwright Test Results

✅ **Tests completed successfully!**

⏰ Completed at: $(date -u '+%m/%d/%Y, %I:%M:%S %p') UTC

### 📊 Test Reports by Browser"
    
    # Add browser results
    i=0
    for browser in $BROWSERS; do
        # Get URL at position i
        url=$(echo "$urls" | cut -d' ' -f$((i + 1)))
        
        if [ "$url" != "failed" ] && [ -n "$url" ]; then
            comment="$comment
- ✅ **${browser}**: [View Report](${url})"
        else
            comment="$comment
- ❌ **${browser}**: Deployment failed"
        fi
        i=$((i + 1))
    done
    
    comment="$comment

---
🎉 Click on the links above to view detailed test results for each browser configuration."
    
    post_comment "$comment"
fi