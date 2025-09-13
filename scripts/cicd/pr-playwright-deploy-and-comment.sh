#!/bin/bash
set -e

# Deploy Playwright test reports to Cloudflare Pages and comment on PR
# Usage: ./pr-playwright-deploy-and-comment.sh <pr_number> <branch_name> <status> [start_time]

# Input validation
# Validate PR number is numeric
case "$1" in
    ''|*[!0-9]*) 
        echo "Error: PR_NUMBER must be numeric" >&2
        exit 1
        ;;
esac
PR_NUMBER="$1"

# Sanitize and validate branch name (allow alphanumeric, dots, dashes, underscores, slashes)
BRANCH_NAME=$(echo "$2" | sed 's/[^a-zA-Z0-9._/-]//g')
if [ -z "$BRANCH_NAME" ]; then
    echo "Error: Invalid or empty branch name" >&2
    exit 1
fi

# Validate status parameter
STATUS="${3:-completed}"
case "$STATUS" in
    starting|completed) ;;
    *) 
        echo "Error: STATUS must be 'starting' or 'completed'" >&2
        exit 1
        ;;
esac

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

# Install wrangler if not available (output to stderr for debugging)
if ! command -v wrangler > /dev/null 2>&1; then
    echo "Installing wrangler v4..." >&2
    npm install -g wrangler@^4.0.0 >&2 || {
        echo "Failed to install wrangler" >&2
        echo "failed"
        return
    }
fi

# Check if tsx is available, install if not
if ! command -v tsx > /dev/null 2>&1; then
    echo "Installing tsx..." >&2
    npm install -g tsx >&2 || echo "Failed to install tsx" >&2
fi

# Deploy a single browser report, WARN: ensure inputs are sanitized before calling this function
deploy_report() {
    dir="$1"
    browser="$2"
    branch="$3"
    
    [ ! -d "$dir" ] && echo "failed" && return
    
    
    # Project name with dots converted to dashes for Cloudflare
    sanitized_browser=$(echo "$browser" | sed 's/\./-/g')
    project="comfyui-playwright-${sanitized_browser}"
    
    echo "Deploying $browser to project $project on branch $branch..." >&2
    
    # Try deployment up to 3 times
    i=1
    while [ $i -le 3 ]; do
        echo "Deployment attempt $i of 3..." >&2
        # Branch and project are already sanitized, use them directly
        # Branch was sanitized at script start, project uses sanitized_browser
        if output=$(wrangler pages deploy "$dir" \
            --project-name="$project" \
            --branch="$branch" 2>&1); then
            
            # Extract URL from output (improved regex for valid URL characters)
            url=$(echo "$output" | grep -oE 'https://[a-zA-Z0-9.-]+\.pages\.dev\S*' | head -1)
            result="${url:-https://${branch}.${project}.pages.dev}"
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
            # Create new comment
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
    # Convert branch name to Cloudflare-compatible format (lowercase, only alphanumeric and dashes)
    cloudflare_branch=$(echo "$BRANCH_NAME" | tr '[:upper:]' '[:lower:]' | \
        sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
    
    echo "Looking for reports in: $(pwd)/reports"
    echo "Available reports:"
    ls -la reports/ 2>/dev/null || echo "Reports directory not found"
    
    # Deploy all reports in parallel and collect URLs + test counts
    temp_dir=$(mktemp -d)
    pids=""
    i=0
    
    # Store current working directory for absolute paths
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    BASE_DIR="$(pwd)"
    
    # Start parallel deployments and count extractions
    for browser in $BROWSERS; do
        if [ -d "reports/playwright-report-$browser" ]; then
            echo "Found report for $browser, deploying in parallel..."
            (
                url=$(deploy_report "reports/playwright-report-$browser" "$browser" "$cloudflare_branch")
                echo "$url" > "$temp_dir/$i.url"
                echo "Deployment result for $browser: $url"
                
                # Extract test counts using tsx (TypeScript executor)
                EXTRACT_SCRIPT="$SCRIPT_DIR/extract-playwright-counts.ts"
                REPORT_DIR="$BASE_DIR/reports/playwright-report-$browser"
                
                if command -v tsx > /dev/null 2>&1 && [ -f "$EXTRACT_SCRIPT" ]; then
                    echo "Extracting counts from $REPORT_DIR using $EXTRACT_SCRIPT" >&2
                    counts=$(tsx "$EXTRACT_SCRIPT" "$REPORT_DIR" 2>&1 || echo '{}')
                    echo "Extracted counts for $browser: $counts" >&2
                    echo "$counts" > "$temp_dir/$i.counts"
                else
                    echo "Script not found or tsx not available: $EXTRACT_SCRIPT" >&2
                    echo '{}' > "$temp_dir/$i.counts"
                fi
            ) &
            pids="$pids $!"
        else
            echo "Report not found for $browser at reports/playwright-report-$browser"
            echo "failed" > "$temp_dir/$i.url"
            echo '{}' > "$temp_dir/$i.counts"
        fi
        i=$((i + 1))
    done
    
    # Wait for all deployments to complete
    for pid in $pids; do
        wait $pid
    done
    
    # Collect URLs and counts in order
    urls=""
    all_counts=""
    i=0
    for browser in $BROWSERS; do
        if [ -f "$temp_dir/$i.url" ]; then
            url=$(cat "$temp_dir/$i.url")
        else
            url="failed"
        fi
        if [ -z "$urls" ]; then
            urls="$url"
        else
            urls="$urls $url"
        fi
        
        if [ -f "$temp_dir/$i.counts" ]; then
            counts=$(cat "$temp_dir/$i.counts")
            echo "Read counts for $browser from $temp_dir/$i.counts: $counts" >&2
        else
            counts="{}"
            echo "No counts file found for $browser at $temp_dir/$i.counts" >&2
        fi
        if [ -z "$all_counts" ]; then
            all_counts="$counts"
        else
            all_counts="$all_counts|$counts"
        fi
        
        i=$((i + 1))
    done
    
    # Clean up temp directory
    rm -rf "$temp_dir"
    
    # Calculate total test counts across all browsers
    total_passed=0
    total_failed=0
    total_flaky=0
    total_skipped=0
    total_tests=0
    
    # Parse counts and calculate totals
    IFS='|'
    set -- $all_counts
    for counts_json; do
        if [ "$counts_json" != "{}" ] && [ -n "$counts_json" ]; then
            # Parse JSON counts using simple grep/sed if jq is not available
            if command -v jq > /dev/null 2>&1; then
                passed=$(echo "$counts_json" | jq -r '.passed // 0')
                failed=$(echo "$counts_json" | jq -r '.failed // 0')
                flaky=$(echo "$counts_json" | jq -r '.flaky // 0')
                skipped=$(echo "$counts_json" | jq -r '.skipped // 0')
                total=$(echo "$counts_json" | jq -r '.total // 0')
            else
                # Fallback parsing without jq
                passed=$(echo "$counts_json" | sed -n 's/.*"passed":\([0-9]*\).*/\1/p')
                failed=$(echo "$counts_json" | sed -n 's/.*"failed":\([0-9]*\).*/\1/p')
                flaky=$(echo "$counts_json" | sed -n 's/.*"flaky":\([0-9]*\).*/\1/p')
                skipped=$(echo "$counts_json" | sed -n 's/.*"skipped":\([0-9]*\).*/\1/p')
                total=$(echo "$counts_json" | sed -n 's/.*"total":\([0-9]*\).*/\1/p')
            fi
            
            total_passed=$((total_passed + ${passed:-0}))
            total_failed=$((total_failed + ${failed:-0}))
            total_flaky=$((total_flaky + ${flaky:-0}))
            total_skipped=$((total_skipped + ${skipped:-0}))
            total_tests=$((total_tests + ${total:-0}))
        fi
    done
    unset IFS
    
    # Determine overall status
    if [ $total_failed -gt 0 ]; then
        status_icon="❌"
        status_text="Some tests failed"
    elif [ $total_flaky -gt 0 ]; then
        status_icon="⚠️"
        status_text="Tests passed with flaky tests"
    elif [ $total_tests -gt 0 ]; then
        status_icon="✅"
        status_text="All tests passed!"
    else
        status_icon="🕵🏻"
        status_text="No test results found"
    fi
    
    # Generate completion comment
    comment="$COMMENT_MARKER
## 🎭 Playwright Test Results

$status_icon **$status_text**

⏰ Completed at: $(date -u '+%m/%d/%Y, %I:%M:%S %p') UTC"

    # Add summary counts if we have test data
    if [ $total_tests -gt 0 ]; then
        comment="$comment

### 📈 Summary
- **Total Tests:** $total_tests
- **Passed:** $total_passed ✅
- **Failed:** $total_failed $([ $total_failed -gt 0 ] && echo '❌' || echo '')
- **Flaky:** $total_flaky $([ $total_flaky -gt 0 ] && echo '⚠️' || echo '')
- **Skipped:** $total_skipped $([ $total_skipped -gt 0 ] && echo '⏭️' || echo '')"
    fi
    
    comment="$comment

### 📊 Test Reports by Browser"
    
    # Add browser results with individual counts
    i=0
    IFS='|'
    set -- $all_counts
    for counts_json; do
        # Get browser name
        browser=$(echo "$BROWSERS" | cut -d' ' -f$((i + 1)))
        # Get URL at position i
        url=$(echo "$urls" | cut -d' ' -f$((i + 1)))
        
        if [ "$url" != "failed" ] && [ -n "$url" ]; then
            # Parse individual browser counts
            if [ "$counts_json" != "{}" ] && [ -n "$counts_json" ]; then
                if command -v jq > /dev/null 2>&1; then
                    b_passed=$(echo "$counts_json" | jq -r '.passed // 0')
                    b_failed=$(echo "$counts_json" | jq -r '.failed // 0')
                    b_flaky=$(echo "$counts_json" | jq -r '.flaky // 0')
                    b_skipped=$(echo "$counts_json" | jq -r '.skipped // 0')
                    b_total=$(echo "$counts_json" | jq -r '.total // 0')
                else
                    b_passed=$(echo "$counts_json" | sed -n 's/.*"passed":\([0-9]*\).*/\1/p')
                    b_failed=$(echo "$counts_json" | sed -n 's/.*"failed":\([0-9]*\).*/\1/p')
                    b_flaky=$(echo "$counts_json" | sed -n 's/.*"flaky":\([0-9]*\).*/\1/p')
                    b_skipped=$(echo "$counts_json" | sed -n 's/.*"skipped":\([0-9]*\).*/\1/p')
                    b_total=$(echo "$counts_json" | sed -n 's/.*"total":\([0-9]*\).*/\1/p')
                fi
                
                if [ -n "$b_total" ] && [ "$b_total" != "0" ]; then
                    counts_str=" • ✅ $b_passed / ❌ $b_failed / ⚠️ $b_flaky / ⏭️ $b_skipped"
                else
                    counts_str=""
                fi
            else
                counts_str=""
            fi
            
            comment="$comment
- ✅ **${browser}**: [View Report](${url})${counts_str}"
        else
            comment="$comment
- ❌ **${browser}**: Deployment failed"
        fi
        i=$((i + 1))
    done
    unset IFS
    
    comment="$comment

---
🎉 Click on the links above to view detailed test results for each browser configuration."
    
    post_comment "$comment"
fi