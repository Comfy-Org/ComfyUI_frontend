#!/bin/bash
set -e

# Script to deploy Playwright test reports to Cloudflare Pages and comment on PR
# Usage: ./pr-playwright-deploy-and-comment.sh <pr_number> <branch_name> <status> <start_time>

PR_NUMBER="$1"
BRANCH_NAME="$2"
STATUS="${3:-completed}"  # "starting" or "completed"
START_TIME="$4"

# Required environment variables
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

# Cloudflare variables only required for deployment (completed status)
if [ "$STATUS" = "completed" ]; then
    : "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required for deployment}"
    : "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required for deployment}"
fi

# Configuration
DATE_FORMAT='+%m/%d/%Y, %I:%M:%S %p'
COMMENT_MARKER="<!-- PLAYWRIGHT_TEST_STATUS -->"
BROWSERS=("chromium" "chromium-2x" "chromium-0-5x" "mobile-chrome")

# Function to sanitize branch name for Cloudflare deployment
sanitize_branch() {
    echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g'
}

# Function to deploy a single browser report
deploy_browser_report() {
    local browser_dir="$1"
    local browser="$2"
    local branch="$3"
    
    # Convert numeric multiplier patterns (e.g., 0.5x, 2.0x) to use dashes for project name
    local project_name="comfyui-playwright-$(echo "$browser" | sed 's/\([0-9]\)\.\([0-9]\)/\1-\2/g')"
    
    echo "Deploying $browser to project $project_name..."
    
    # Deploy with retry logic
    local retry_count=0
    local max_retries=3
    local success=false
    local url=""
    
    while [ $retry_count -lt $max_retries ] && [ "$success" = false ]; do
        retry_count=$((retry_count + 1))
        echo "Attempt $retry_count of $max_retries for $browser..."
        
        # Capture output and deploy
        if output=$(npx wrangler pages deploy "$browser_dir" \
            --project-name="$project_name" \
            --branch="$branch" 2>&1); then
            success=true
            # Extract URL from output
            url=$(echo "$output" | grep -oE 'https://[a-z0-9.-]+\.pages\.dev' | head -1)
            if [ -z "$url" ]; then
                # Fallback URL construction
                url="https://${branch}.${project_name}.pages.dev"
            fi
            echo "✅ Deployed $browser successfully: $url"
        else
            echo "❌ Deployment failed for $browser on attempt $retry_count"
            if [ $retry_count -lt $max_retries ]; then
                sleep 10
            fi
        fi
    done
    
    echo "$url"
}

# Function to generate comment body for starting status
generate_starting_comment() {
    local time="$1"
    
    cat <<EOF
$COMMENT_MARKER
## 🎭 Playwright Test Results

<img alt='comfy-loading-gif' src='https://github.com/user-attachments/assets/755c86ee-e445-4ea8-bc2c-cca85df48686' width='14px' height='14px' style='vertical-align: middle; margin-right: 4px;' /> **Tests are starting...**

⏰ Started at: $time UTC

### 🚀 Running Tests
- 🧪 **chromium**: Running tests...
- 🧪 **chromium-0.5x**: Running tests...
- 🧪 **chromium-2x**: Running tests...
- 🧪 **mobile-chrome**: Running tests...

---
⏱️ Please wait while tests are running across all browsers...
EOF
}

# Function to generate comment body for completed status
generate_completed_comment() {
    local time="$1"
    shift
    local deployment_urls=("$@")
    
    cat <<EOF
$COMMENT_MARKER
## 🎭 Playwright Test Results

✅ **Tests completed successfully!**

⏰ Completed at: $time UTC

### 📊 Test Reports by Browser
EOF
    
    for i in "${!BROWSERS[@]}"; do
        local browser="${BROWSERS[$i]}"
        local url="${deployment_urls[$i]}"
        
        if [ -n "$url" ] && [ "$url" != "failed" ]; then
            echo "- ✅ **$browser**: [View Report]($url)"
        else
            echo "- ❌ **$browser**: Deployment failed"
        fi
    done
    
    cat <<EOF

---
🎉 Click on the links above to view detailed test results for each browser configuration.
EOF
}

# Function to post or update GitHub comment
post_github_comment() {
    local pr_number="$1"
    local comment_body="$2"
    
    # Create a temporary file for the comment
    local temp_file=$(mktemp)
    echo "$comment_body" > "$temp_file"
    
    # Use GitHub CLI to create or update comment
    if command -v gh &> /dev/null; then
        # Check if comment exists
        existing_comment=$(gh pr view "$pr_number" --comments --json comments \
            --jq ".comments[] | select(.body | contains(\"$COMMENT_MARKER\")) | .id" | head -1)
        
        if [ -n "$existing_comment" ]; then
            # Update existing comment
            gh pr comment "$pr_number" --edit-last --body-file "$temp_file"
        else
            # Create new comment
            gh pr comment "$pr_number" --body-file "$temp_file"
        fi
    else
        echo "GitHub CLI not available, outputting comment to stdout:"
        cat "$temp_file"
    fi
    
    rm -f "$temp_file"
}

# Main execution
main() {
    local sanitized_branch=$(sanitize_branch "$BRANCH_NAME")
    local current_time=$(date -u "$DATE_FORMAT")
    
    if [ "$STATUS" = "starting" ]; then
        # Generate and post starting comment
        local comment=$(generate_starting_comment "${START_TIME:-$current_time}")
        post_github_comment "$PR_NUMBER" "$comment"
        
    elif [ "$STATUS" = "completed" ]; then
        # Deploy reports and collect URLs
        local deployment_urls=()
        
        # Check if reports directory exists
        if [ -d "reports" ]; then
            for browser in "${BROWSERS[@]}"; do
                local browser_dir="reports/playwright-report-$browser"
                
                if [ -d "$browser_dir" ]; then
                    url=$(deploy_browser_report "$browser_dir" "$browser" "$sanitized_branch")
                    deployment_urls+=("$url")
                else
                    echo "Warning: Report directory not found for $browser"
                    deployment_urls+=("failed")
                fi
            done
        else
            echo "Error: Reports directory not found"
            for browser in "${BROWSERS[@]}"; do
                deployment_urls+=("failed")
            done
        fi
        
        # Generate and post completed comment
        local comment=$(generate_completed_comment "$current_time" "${deployment_urls[@]}")
        post_github_comment "$PR_NUMBER" "$comment"
    fi
}

# Run main function
main