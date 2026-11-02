#!/bin/bash
set -e

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

: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

if [ "$STATUS" = "completed" ]; then
    : "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required for deployment}"
    : "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required for deployment}"
fi

COMMENT_MARKER="<!-- PLAYWRIGHT_TEST_STATUS -->"
BROWSERS="chromium chromium-2x chromium-0.5x cloud desktop mobile-chrome mobile-safari"
TEST_ROOT="browser_tests"

if ! command -v wrangler > /dev/null 2>&1; then
    echo "Installing wrangler v4..." >&2
    npm install -g wrangler@^4.0.0 >&2 || {
        echo "Failed to install wrangler" >&2
        echo "failed"
        return
    }
fi

if ! command -v tsx > /dev/null 2>&1; then
    echo "Installing tsx..." >&2
    npm install -g tsx >&2 || echo "Failed to install tsx" >&2
fi

create_pages_project() {
    echo "Creating Cloudflare Pages project $1..." >&2
    wrangler pages project create "$1" --production-branch=main >&2 ||
        echo "Failed to create Cloudflare Pages project $1" >&2
}

deploy_report() {
    dir="$1"
    browser="$2"
    branch="$3"

    [ ! -d "$dir" ] && echo "failed" && return

    sanitized_browser="${browser//./-}"
    project="comfyui-playwright-${sanitized_browser}"

    echo "Deploying $browser to project $project on branch $branch..." >&2

    i=1
    while [ $i -le 3 ]; do
        echo "Deployment attempt $i of 3..." >&2
        if output=$(wrangler pages deploy "$dir" \
            --project-name="$project" \
            --branch="$branch" 2>&1); then

            url=$(echo "$output" | grep -oE 'https://[a-zA-Z0-9.-]+\.pages\.dev\S*' | head -1)
            result="${url:-https://${branch}.${project}.pages.dev}"
            echo "Success! URL: $result" >&2
            echo "$result"
            return
        else
            echo "Deployment failed on attempt $i: $output" >&2
            case "$output" in
                *"does not exist"*) create_pages_project "$project" ;;
            esac
        fi
        [ $i -lt 3 ] && sleep 10
        i=$((i + 1))
    done
    
    echo "failed"
}

parse_counts() {
    json="$1"
    if command -v jq > /dev/null 2>&1; then
        echo "$json" | jq -r '[.passed, .failed, .flaky, .skipped, .total] | map(. // 0) | @tsv'
    else
        printf '%s\t%s\t%s\t%s\t%s\n' \
            "$(echo "$json" | sed -n 's/.*"passed":\([0-9]*\).*/\1/p')" \
            "$(echo "$json" | sed -n 's/.*"failed":\([0-9]*\).*/\1/p')" \
            "$(echo "$json" | sed -n 's/.*"flaky":\([0-9]*\).*/\1/p')" \
            "$(echo "$json" | sed -n 's/.*"skipped":\([0-9]*\).*/\1/p')" \
            "$(echo "$json" | sed -n 's/.*"total":\([0-9]*\).*/\1/p')"
    fi
}

count_screenshot_diffs() {
    find snapshot-updates -name manifest.json -exec cat {} + 2>/dev/null |
        jq -s 'map(length) | add // 0'
}

counts_suffix() {
    read -r passed failed flaky skipped total <<< "$(parse_counts "$1")"
    [ "${total:-0}" != "0" ] && echo " (✅ ${passed:-0} / ❌ ${failed:-0} / ⚠️ ${flaky:-0} / ⏭️ ${skipped:-0})"
    return 0
}

post_comment() {
    body="$1"

    if [ -n "${SUMMARY_FILE:-}" ]; then
        printf '%s\n' "$body" > "$SUMMARY_FILE" || { echo "Failed to write $SUMMARY_FILE" >&2; exit 1; }
        echo "Wrote playwright section to $SUMMARY_FILE" >&2
        return
    fi

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

if [ "$STATUS" = "starting" ]; then
    if [ -n "${SUMMARY_FILE:-}" ]; then
        comment="## 🎭 Playwright: ⏳ Running..."
    else
        comment="$COMMENT_MARKER
## 🎭 Playwright: ⏳ Running..."
    fi
    post_comment "$comment"
    
else
    cloudflare_branch=$(echo "$BRANCH_NAME" | tr '[:upper:]' '[:lower:]' | \
        sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
    
    echo "Looking for reports in: $(pwd)/reports"
    echo "Available reports:"
    ls -la reports/ 2>/dev/null || echo "Reports directory not found"

    temp_dir=$(mktemp -d)
    pids=""
    i=0
    
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    BASE_DIR="$(pwd)"
    
    for browser in $BROWSERS; do
        if [ -d "reports/playwright-report-$browser" ]; then
            echo "Found report for $browser, deploying in parallel..."
            (
                url=$(deploy_report "reports/playwright-report-$browser" "$browser" "$cloudflare_branch")
                echo "$url" > "$temp_dir/$i.url"
                echo "Deployment result for $browser: $url"

                EXTRACT_SCRIPT="$SCRIPT_DIR/extract-playwright-counts.ts"
                REPORT_DIR="$BASE_DIR/reports/playwright-report-$browser"

                if command -v tsx > /dev/null 2>&1 && [ -f "$EXTRACT_SCRIPT" ]; then
                    echo "Extracting counts from $REPORT_DIR using $EXTRACT_SCRIPT" >&2
                    counts=$(tsx "$EXTRACT_SCRIPT" "$REPORT_DIR" "$url" "$TEST_ROOT" || echo '{}')
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
            echo "missing" > "$temp_dir/$i.url"
            echo '{}' > "$temp_dir/$i.counts"
        fi
        i=$((i + 1))
    done
    
    for pid in $pids; do
        wait "$pid"
    done
    
    urls=""
    all_counts=""
    missing_reports=0
    i=0
    for browser in $BROWSERS; do
        if [ -f "$temp_dir/$i.url" ]; then
            url=$(cat "$temp_dir/$i.url")
        else
            url="failed"
        fi
        [ "$url" = "missing" ] && missing_reports=$((missing_reports + 1))
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
    
    rm -rf "$temp_dir"

    total_passed=0
    total_failed=0
    total_flaky=0
    total_skipped=0
    total_tests=0

    IFS='|' read -r -a counts_array <<< "$all_counts"
    for counts_json in "${counts_array[@]}"; do
        [ -z "$counts_json" ] && continue
        read -r passed failed flaky skipped total <<< "$(parse_counts "$counts_json")"
        total_passed=$((total_passed + passed))
        total_failed=$((total_failed + failed))
        total_flaky=$((total_flaky + flaky))
        total_skipped=$((total_skipped + skipped))
        total_tests=$((total_tests + total))
    done
    unset IFS
    
    if [ $total_failed -gt 0 ] || [ $missing_reports -gt 0 ]; then
        status_icon="❌"
    elif [ $total_tests -gt 0 ]; then
        status_icon="✅"
    else
        status_icon="🕵🏻"
    fi
    
    flaky_note=""
    if [ $total_flaky -gt 0 ]; then
        flaky_note=" · $total_flaky flaky"
    fi

    missing_note=""
    if [ $missing_reports -gt 0 ]; then
        missing_note=", $missing_reports missing"
    fi
    
    if [ -n "${SUMMARY_FILE:-}" ]; then
        comment="## 🎭 Playwright: $status_icon $total_passed passed, $total_failed failed$missing_note$flaky_note"
    else
        comment="$COMMENT_MARKER
## 🎭 Playwright: $status_icon $total_passed passed, $total_failed failed$missing_note$flaky_note"
    fi

    if [ $total_failed -gt 0 ]; then
        failed_test_lines=""
        failed_tests_label="$total_failed tests"
        [ "$total_failed" -eq 1 ] && failed_tests_label="1 test"

        for counts_json in "${counts_array[@]}"; do
            [ -z "$counts_json" ] || [ "$counts_json" = "{}" ] && continue
            
            if command -v jq > /dev/null 2>&1; then
                failures=$(echo "$counts_json" | jq -r '.failures // [] | .[]? | "\(.name)|\(.file)|\(.reportUrl // "")"')
                
                if [ -n "$failures" ]; then
                    while IFS='|' read -r test_name test_file report_url; do
                        [ -z "$test_name" ] && continue
                        
                        github_file_url="https://github.com/$GITHUB_REPOSITORY/blob/$GITHUB_SHA/$test_file"
                        
                        test_line="- [$test_name]($github_file_url)"
                        
                        if [ -n "$report_url" ] && [ "$report_url" != "null" ]; then
                            test_line="$test_line: [View test report]($report_url)"
                        fi
                        
                        failed_test_lines="$failed_test_lines
$test_line"
                    done <<< "$failures"
                fi
            fi
        done

        if [ -n "$failed_test_lines" ]; then
            comment="$comment

> ❌ $failed_tests_label failed. Expand the failed tests below, review their reports and fix the failures before merging.

<details>
<summary>Failed tests</summary>

${failed_test_lines#$'\n'}

</details>"
        else
            comment="$comment

> ❌ $failed_tests_label failed. Open the browser reports below, review the failed tests and fix the failures before merging."
        fi
    fi
    
    screenshot_diffs=$(count_screenshot_diffs) || screenshot_diffs=0
    if [ "${screenshot_diffs:-0}" -gt 0 ]; then
        diff_plural="s"
        [ "$screenshot_diffs" -eq 1 ] && diff_plural=""
        comment="$comment

- [ ] Update Playwright expectations ($screenshot_diffs screenshot diff$diff_plural)"
    fi

    comment="$comment

<details>
<summary>📊 Browser Reports</summary>

"
    
    i=0
    deployment_failed=false
    IFS=' ' read -r -a browser_array <<< "$BROWSERS"
    IFS=' ' read -r -a url_array <<< "$urls"
    for counts_json in "${counts_array[@]}"; do
        [ -z "$counts_json" ] && { i=$((i + 1)); continue; }
        browser="${browser_array[$i]:-}"
        url="${url_array[$i]:-}"
        
        if [ "$url" = "missing" ]; then
            comment="$comment
- **${browser}**: ❌ Report missing"
        elif [ "$url" != "failed" ] && [ -n "$url" ]; then
            comment="$comment
- **${browser}**: [View Report](${url})$(counts_suffix "$counts_json")"
        else
            deployment_failed=true
            comment="$comment
- **${browser}**: ❌ Deployment failed"
        fi
        i=$((i + 1))
    done
    unset IFS

    comment="$comment

</details>"

    if [ "$deployment_failed" = true ]; then
        comment="$comment

> ❌ Browser reports are missing. [Open the workflow run]($WORKFLOW_URL), fix report generation or deployment and re-run the job."
    fi

    post_comment "$comment"
fi
