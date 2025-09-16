#!/bin/bash
set -e

# Deploy Storybook to Cloudflare Pages and comment on PR
# Usage: ./pr-storybook-deploy-and-comment.sh <pr_number> <branch_name> <status> [start_time]

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
COMMENT_MARKER="<!-- STORYBOOK_BUILD_STATUS -->"

# Install wrangler if not available (output to stderr for debugging)
if ! command -v wrangler > /dev/null 2>&1; then
    echo "Installing wrangler v4..." >&2
    npm install -g wrangler@^4.0.0 >&2 || {
        echo "Failed to install wrangler" >&2
        echo "failed"
        return
    }
fi

# Deploy Storybook report, WARN: ensure inputs are sanitized before calling this function
deploy_storybook() {
    dir="$1"
    branch="$2"
    
    [ ! -d "$dir" ] && echo "failed" && return
    
    project="comfy-storybook"
    
    echo "Deploying Storybook to project $project on branch $branch..." >&2
    
    # Try deployment up to 3 times
    i=1
    while [ $i -le 3 ]; do
        echo "Deployment attempt $i of 3..." >&2
        # Branch is already sanitized, use it directly
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
    # Check if this is a version-bump branch
    IS_VERSION_BUMP="false"
    if echo "$BRANCH_NAME" | grep -q "^version-bump-"; then
        IS_VERSION_BUMP="true"
    fi
    
    # Post starting comment with appropriate message
    if [ "$IS_VERSION_BUMP" = "true" ]; then
        comment=$(cat <<EOF
$COMMENT_MARKER
## 🎨 Storybook Build Status

<img alt='loading' src='https://github.com/user-attachments/assets/755c86ee-e445-4ea8-bc2c-cca85df48686' width='14px' height='14px'/> **Build is starting...**

⏰ Started at: $START_TIME UTC

### 🚀 Building Storybook
- 📦 Installing dependencies...
- 🔧 Building Storybook components...
- 🎨 Running Chromatic visual tests...

---
⏱️ Please wait while the Storybook build is in progress...
EOF
)
    else
        comment=$(cat <<EOF
$COMMENT_MARKER
## 🎨 Storybook Build Status

<img alt='loading' src='https://github.com/user-attachments/assets/755c86ee-e445-4ea8-bc2c-cca85df48686' width='14px' height='14px'/> **Build is starting...**

⏰ Started at: $START_TIME UTC

### 🚀 Building Storybook
- 📦 Installing dependencies...
- 🔧 Building Storybook components...
- 🌐 Preparing deployment to Cloudflare Pages...

---
⏱️ Please wait while the Storybook build is in progress...
EOF
)
    fi
    post_comment "$comment"
    
elif [ "$STATUS" = "completed" ]; then
    # Deploy and post completion comment
    # Convert branch name to Cloudflare-compatible format (lowercase, only alphanumeric and dashes)
    cloudflare_branch=$(echo "$BRANCH_NAME" | tr '[:upper:]' '[:lower:]' | \
        sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
    
    echo "Looking for Storybook build in: $(pwd)/storybook-static"
    
    # Deploy Storybook if build exists
    deployment_url="Not deployed"
    if [ -d "storybook-static" ]; then
        echo "Found Storybook build, deploying..."
        url=$(deploy_storybook "storybook-static" "$cloudflare_branch")
        if [ "$url" != "failed" ] && [ -n "$url" ]; then
            deployment_url="[View Storybook]($url)"
        else
            deployment_url="Deployment failed"
        fi
    else
        echo "Storybook build not found at storybook-static"
    fi
    
    # Get workflow conclusion from environment or default to success
    WORKFLOW_CONCLUSION="${WORKFLOW_CONCLUSION:-success}"
    WORKFLOW_URL="${WORKFLOW_URL:-}"
    
    # Generate completion comment based on conclusion
    if [ "$WORKFLOW_CONCLUSION" = "success" ]; then
        status_icon="✅"
        status_text="Build completed successfully!"
        footer_text="🎉 Your Storybook is ready for review!"
    elif [ "$WORKFLOW_CONCLUSION" = "skipped" ]; then
        status_icon="⏭️"
        status_text="Build skipped."
        footer_text="ℹ️ Chromatic was skipped for this PR."
    elif [ "$WORKFLOW_CONCLUSION" = "cancelled" ]; then
        status_icon="🚫"
        status_text="Build cancelled."
        footer_text="ℹ️ The Chromatic run was cancelled."
    else
        status_icon="❌"
        status_text="Build failed!"
        footer_text="⚠️ Please check the workflow logs for error details."
    fi
    
    comment="$COMMENT_MARKER
## 🎨 Storybook Build Status

$status_icon **$status_text**

⏰ Completed at: $(date -u '+%m/%d/%Y, %I:%M:%S %p') UTC

### 🔗 Links
- [📊 View Workflow Run]($WORKFLOW_URL)"
    
    # Add deployment status
    if [ "$deployment_url" != "Not deployed" ]; then
        if [ "$deployment_url" = "Deployment failed" ]; then
            comment="$comment
- ❌ Storybook deployment failed"
        elif [ "$WORKFLOW_CONCLUSION" = "success" ]; then
            comment="$comment
- 🎨 $deployment_url"
        else
            comment="$comment
- ⚠️ Build failed - $deployment_url"
        fi
    elif [ "$WORKFLOW_CONCLUSION" != "success" ]; then
        comment="$comment
- ⏭️ Storybook deployment skipped (build did not succeed)"
    fi
    
    comment="$comment

---
$footer_text"
    
    post_comment "$comment"
fi