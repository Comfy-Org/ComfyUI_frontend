# Comprehensive PR Review for ComfyUI Frontend

<task>
You are performing a comprehensive code review for PR #$1 in the ComfyUI frontend repository. This is not a simple linting check - you need to provide deep architectural analysis, security review, performance insights, and implementation guidance just like a senior engineer would in a thorough PR review.

Your review should cover:
1. Architecture and design patterns
2. Security vulnerabilities and risks
3. Performance implications
4. Code quality and maintainability
5. Integration with existing systems
6. Best practices and conventions
7. Testing considerations
8. Documentation needs
</task>

Arguments: PR number passed via PR_NUMBER environment variable

## Phase 0: Initialize Variables and Helper Functions

```bash
# Validate PR_NUMBER first thing
if [ -z "$PR_NUMBER" ]; then
  echo "Error: PR_NUMBER environment variable is not set"
  echo "Usage: PR_NUMBER=<number> claude run /comprehensive-pr-review"
  exit 1
fi

# Extract repository information
REPO_INFO=$(gh repo view --json owner,name)
OWNER=$(echo $REPO_INFO | jq -r .owner.login)
REPO=$(echo $REPO_INFO | jq -r .name)

# Get the latest commit SHA from the PR
COMMIT_SHA=$(gh pr view $PR_NUMBER --json commits --jq '.commits[-1].oid')

# Initialize all counters at the start
CRITICAL_COUNT=0
HIGH_COUNT=0
MEDIUM_COUNT=0
LOW_COUNT=0
ARCHITECTURE_ISSUES=0
SECURITY_ISSUES=0
PERFORMANCE_ISSUES=0
QUALITY_ISSUES=0

# Helper function for posting inline review comments
add_inline_comment() {
  local file_path=$1
  local line_number=$2
  local severity=$3  # critical/high/medium/low
  local category=$4  # architecture/security/performance/quality
  local issue=$5
  local context=$6
  local suggestion=$7
  
  # Update counters
  case $severity in
    "critical") ((CRITICAL_COUNT++)) ;;
    "high") ((HIGH_COUNT++)) ;;
    "medium") ((MEDIUM_COUNT++)) ;;
    "low") ((LOW_COUNT++)) ;;
  esac
  
  case $category in
    "architecture") ((ARCHITECTURE_ISSUES++)) ;;
    "security") ((SECURITY_ISSUES++)) ;;
    "performance") ((PERFORMANCE_ISSUES++)) ;;
    "quality") ((QUALITY_ISSUES++)) ;;
  esac
  
  # Format comment body
  local comment_body="**[$category] $severity Priority**

**Issue**: $issue
**Context**: $context  
**Suggestion**: $suggestion"
  
  # Post inline comment using correct GitHub API syntax
  gh api \
    --method POST \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    /repos/$OWNER/$REPO/pulls/$PR_NUMBER/comments \
    -f body="$comment_body" \
    -f commit_id="$COMMIT_SHA" \
    -f path="$file_path" \
    -F line=$line_number \
    -f side="RIGHT" || echo "Failed to add comment to $file_path:$line_number"
}
```

## Phase 1: Environment Setup and PR Context

```bash
# Pre-flight checks
check_prerequisites() {
  # Check gh CLI is available
  if ! command -v gh &> /dev/null; then
    echo "Error: gh CLI is not installed"
    exit 1
  fi
  
  # In GitHub Actions, auth is handled via GITHUB_TOKEN
  if [ -n "$GITHUB_ACTIONS" ] && [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN is not set in GitHub Actions"
    exit 1
  fi
  
  # Check if we're authenticated
  if ! gh auth status &> /dev/null; then
    echo "Error: Not authenticated with GitHub. Run 'gh auth login'"
    exit 1
  fi
  
  # Set repository if not already set
  if [ -z "$REPOSITORY" ]; then
    REPOSITORY="Comfy-Org/ComfyUI_frontend"
  fi
  
  # Check PR exists and is open
  PR_STATE=$(gh pr view $PR_NUMBER --repo $REPOSITORY --json state -q .state 2>/dev/null || echo "NOT_FOUND")
  if [ "$PR_STATE" = "NOT_FOUND" ]; then
    echo "Error: PR #$PR_NUMBER not found in $REPOSITORY"
    exit 1
  elif [ "$PR_STATE" != "OPEN" ]; then
    echo "Error: PR #$PR_NUMBER is not open (state: $PR_STATE)"
    exit 1
  fi
  
  # Check API rate limits
  RATE_REMAINING=$(gh api /rate_limit --jq '.rate.remaining' 2>/dev/null || echo "5000")
  if [ "$RATE_REMAINING" -lt 100 ]; then
    echo "Warning: Low API rate limit: $RATE_REMAINING remaining"
    if [ "$RATE_REMAINING" -lt 50 ]; then
      echo "Error: Insufficient API rate limit for comprehensive review"
      exit 1
    fi
  fi
  
  echo "Pre-flight checks passed"
}

# Run pre-flight checks
check_prerequisites

echo "Starting comprehensive review of PR #$PR_NUMBER"

# Fetch PR information with error handling
echo "Fetching PR information..."
if ! gh pr view $PR_NUMBER --repo $REPOSITORY --json files,title,body,additions,deletions,baseRefName,headRefName > pr_info.json; then
  echo "Error: Failed to fetch PR information"
  exit 1
fi

# Extract branch names
BASE_BRANCH=$(jq -r '.baseRefName' < pr_info.json)
HEAD_BRANCH=$(jq -r '.headRefName' < pr_info.json)

# Checkout PR branch locally for better file inspection
echo "Checking out PR branch..."
git fetch origin "pull/$PR_NUMBER/head:pr-$PR_NUMBER"
git checkout "pr-$PR_NUMBER"

# Get changed files using git locally (much faster)
git diff --name-only "origin/$BASE_BRANCH" > changed_files.txt

# Get the diff using git locally
git diff "origin/$BASE_BRANCH" > pr_diff.txt

# Get detailed file changes with line numbers
git diff --name-status "origin/$BASE_BRANCH" > file_changes.txt

# For API compatibility, create a simplified pr_files.json
echo '[]' > pr_files.json
while IFS=$'\t' read -r status file; do
  if [[ "$status" != "D" ]]; then  # Skip deleted files
    # Get the patch for this file
    patch=$(git diff "origin/$BASE_BRANCH" -- "$file" | jq -Rs .)
    additions=$(git diff --numstat "origin/$BASE_BRANCH" -- "$file" | awk '{print $1}')
    deletions=$(git diff --numstat "origin/$BASE_BRANCH" -- "$file" | awk '{print $2}')
    
    jq --arg file "$file" \
       --arg patch "$patch" \
       --arg additions "$additions" \
       --arg deletions "$deletions" \
       '. += [{
         "filename": $file,
         "patch": $patch,
         "additions": ($additions | tonumber),
         "deletions": ($deletions | tonumber)
       }]' pr_files.json > pr_files.json.tmp
    mv pr_files.json.tmp pr_files.json
  fi
done < file_changes.txt

# Setup caching directory
CACHE_DIR=".claude-review-cache"
mkdir -p "$CACHE_DIR"

# Function to cache analysis results
cache_analysis() {
  local file_path=$1
  local analysis_result=$2
  local file_hash=$(git hash-object "$file_path" 2>/dev/null || echo "no-hash")
  
  if [ "$file_hash" != "no-hash" ]; then
    echo "$analysis_result" > "$CACHE_DIR/${file_hash}.cache"
  fi
}

# Function to get cached analysis
get_cached_analysis() {
  local file_path=$1
  local file_hash=$(git hash-object "$file_path" 2>/dev/null || echo "no-hash")
  
  if [ "$file_hash" != "no-hash" ] && [ -f "$CACHE_DIR/${file_hash}.cache" ]; then
    cat "$CACHE_DIR/${file_hash}.cache"
    return 0
  fi
  return 1
}

# Clean old cache entries (older than 7 days)
find "$CACHE_DIR" -name "*.cache" -mtime +7 -delete 2>/dev/null || true
```

## Phase 2: Load Comprehensive Knowledge Base

```bash
# Don't create knowledge directory until we know we need it
KNOWLEDGE_FOUND=false

# Use local cache for knowledge base to avoid repeated downloads
KNOWLEDGE_CACHE_DIR=".claude-knowledge-cache"
mkdir -p "$KNOWLEDGE_CACHE_DIR"

# Option to use cloned prompt library for better performance
PROMPT_LIBRARY_PATH="../comfy-claude-prompt-library"
if [ -d "$PROMPT_LIBRARY_PATH" ]; then
  echo "Using local prompt library at $PROMPT_LIBRARY_PATH"
  USE_LOCAL_PROMPT_LIBRARY=true
else
  echo "No local prompt library found, will use GitHub API"
  USE_LOCAL_PROMPT_LIBRARY=false
fi

# Function to fetch with cache
fetch_with_cache() {
  local url=$1
  local output_file=$2
  local cache_file="$KNOWLEDGE_CACHE_DIR/$(echo "$url" | sed 's/[^a-zA-Z0-9]/_/g')"
  
  # Check if cached version exists and is less than 1 day old
  if [ -f "$cache_file" ] && [ $(find "$cache_file" -mtime -1 2>/dev/null | wc -l) -gt 0 ]; then
    # Create knowledge directory only when we actually have content
    if [ "$KNOWLEDGE_FOUND" = "false" ]; then
      mkdir -p review_knowledge
      KNOWLEDGE_FOUND=true
    fi
    cp "$cache_file" "$output_file"
    echo "Using cached version of $(basename "$output_file")"
    return 0
  fi
  
  # Try to fetch fresh version
  if curl -s -f "$url" > "$output_file.tmp"; then
    # Create knowledge directory only when we actually have content
    if [ "$KNOWLEDGE_FOUND" = "false" ]; then
      mkdir -p review_knowledge
      KNOWLEDGE_FOUND=true
    fi
    mv "$output_file.tmp" "$output_file"
    cp "$output_file" "$cache_file"
    echo "Downloaded fresh version of $(basename "$output_file")"
    return 0
  else
    # If fetch failed but we have a cache, use it
    if [ -f "$cache_file" ]; then
      if [ "$KNOWLEDGE_FOUND" = "false" ]; then
        mkdir -p review_knowledge
        KNOWLEDGE_FOUND=true
      fi
      cp "$cache_file" "$output_file"
      echo "Using stale cache for $(basename "$output_file") (download failed)"
      return 0
    fi
    echo "Failed to load $(basename "$output_file")"
    return 1
  fi
}

# Load REPOSITORY_GUIDE.md for deep architectural understanding
echo "Loading ComfyUI Frontend repository guide..."
if [ "$USE_LOCAL_PROMPT_LIBRARY" = "true" ] && [ -f "$PROMPT_LIBRARY_PATH/project-summaries-for-agents/ComfyUI_frontend/REPOSITORY_GUIDE.md" ]; then
  if [ "$KNOWLEDGE_FOUND" = "false" ]; then
    mkdir -p review_knowledge
    KNOWLEDGE_FOUND=true
  fi
  cp "$PROMPT_LIBRARY_PATH/project-summaries-for-agents/ComfyUI_frontend/REPOSITORY_GUIDE.md" "review_knowledge/repository_guide.md"
  echo "Loaded repository guide from local prompt library"
else
  fetch_with_cache "https://raw.githubusercontent.com/Comfy-Org/comfy-claude-prompt-library/master/project-summaries-for-agents/ComfyUI_frontend/REPOSITORY_GUIDE.md" "review_knowledge/repository_guide.md"
fi

# 3. Discover and load relevant knowledge folders from GitHub API
echo "Discovering available knowledge folders..."
KNOWLEDGE_API_URL="https://api.github.com/repos/Comfy-Org/comfy-claude-prompt-library/contents/.claude/knowledge"
if KNOWLEDGE_FOLDERS=$(curl -s "$KNOWLEDGE_API_URL" | jq -r '.[] | select(.type=="dir") | .name' 2>/dev/null); then
  echo "Available knowledge folders: $KNOWLEDGE_FOLDERS"
  
  # Analyze changed files to determine which knowledge folders might be relevant
  CHANGED_FILES=$(cat changed_files.txt)
  PR_TITLE=$(jq -r '.title' < pr_info.json)
  PR_BODY=$(jq -r '.body // ""' < pr_info.json)
  
  # For each knowledge folder, check if it might be relevant to the PR
  for folder in $KNOWLEDGE_FOLDERS; do
    # Simple heuristic: if folder name appears in changed file paths or PR context
    if echo "$CHANGED_FILES $PR_TITLE $PR_BODY" | grep -qi "$folder"; then
      echo "Loading knowledge folder: $folder"
      # Fetch all files in that knowledge folder
      FOLDER_API_URL="https://api.github.com/repos/Comfy-Org/comfy-claude-prompt-library/contents/.claude/knowledge/$folder"
      curl -s "$FOLDER_API_URL" | jq -r '.[] | select(.type=="file") | .download_url' 2>/dev/null | \
        while read url; do
          if [ -n "$url" ]; then
            filename=$(basename "$url")
            fetch_with_cache "$url" "review_knowledge/${folder}_${filename}"
          fi
        done
    fi
  done
else
  echo "Could not discover knowledge folders"
fi

# 4. Load validation rules from the repository
echo "Loading validation rules..."
VALIDATION_API_URL="https://api.github.com/repos/Comfy-Org/comfy-claude-prompt-library/contents/.claude/commands/validation"
if VALIDATION_FILES=$(curl -s "$VALIDATION_API_URL" | jq -r '.[] | select(.name | contains("frontend") or contains("security") or contains("performance")) | .download_url' 2>/dev/null); then
  for url in $VALIDATION_FILES; do
    if [ -n "$url" ]; then
      filename=$(basename "$url")
      fetch_with_cache "$url" "review_knowledge/validation_${filename}"
    fi
  done
else
  echo "Could not load validation rules"
fi

# 5. Load local project guidelines
if [ -f "CLAUDE.md" ]; then
  if [ "$KNOWLEDGE_FOUND" = "false" ]; then
    mkdir -p review_knowledge
    KNOWLEDGE_FOUND=true
  fi
  cp CLAUDE.md review_knowledge/local_claude.md
fi
if [ -f ".github/CLAUDE.md" ]; then
  if [ "$KNOWLEDGE_FOUND" = "false" ]; then
    mkdir -p review_knowledge
    KNOWLEDGE_FOUND=true
  fi
  cp .github/CLAUDE.md review_knowledge/github_claude.md
fi
```

## Phase 3: Deep Analysis Instructions

Perform a comprehensive analysis covering these areas:

### 3.1 Architectural Analysis
Based on the repository guide and project summary, evaluate:
- Does this change align with the established architecture patterns?
- Are domain boundaries respected?
- Is the extension system used appropriately?
- Are components properly organized by feature?
- Does it follow the established service/composable/store patterns?

### 3.2 Code Quality Beyond Linting
- Cyclomatic complexity and cognitive load
- SOLID principles adherence
- DRY violations that aren't caught by simple duplication checks
- Proper abstraction levels
- Interface design and API clarity
- No leftover debug code (console.log, commented code, TODO comments)

### 3.3 Library Usage Enforcement
CRITICAL: Never re-implement functionality that exists in our standard libraries:
- **Tailwind CSS**: Use utility classes instead of custom CSS or style attributes
- **PrimeVue**: Never re-implement components that exist in PrimeVue (buttons, modals, dropdowns, etc.)
- **VueUse**: Never re-implement composables that exist in VueUse (useLocalStorage, useDebounceFn, etc.)
- **Lodash**: Never re-implement utility functions (debounce, throttle, cloneDeep, etc.)
- **Common components**: Reuse components from src/components/common/
- **DOMPurify**: Always use for HTML sanitization
- **Fuse.js**: Use for fuzzy search functionality
- **Marked**: Use for markdown parsing
- **Pinia**: Use for global state management, not custom solutions
- **Zod**: Use for form validation with zodResolver pattern
- **Tiptap**: Use for rich text/markdown editing
- **Xterm.js**: Use for terminal emulation
- **Axios**: Use for HTTP client initialization

### 3.4 Security Deep Dive
Beyond obvious vulnerabilities:
- Authentication/authorization implications
- Data validation completeness
- State management security
- Cross-origin concerns
- Extension security boundaries

### 3.5 Performance Analysis
- Render performance implications
- Layout thrashing prevention
- Memory leak potential
- Network request optimization
- State management efficiency

### 3.6 Integration Concerns
- Breaking changes to internal APIs
- Extension compatibility
- Backward compatibility
- Migration requirements

## Phase 4: Create Detailed Review Comments

CRITICAL: Keep comments extremely concise and effective. Use only as many words as absolutely necessary.
- NO markdown formatting (no #, ##, ###, **, etc.)
- NO emojis
- Get to the point immediately
- Burden the reader as little as possible

For each issue found, create a concise inline comment with:
1. What's wrong (one line)
2. Why it matters (one line)
3. How to fix it (one line)
4. Code example only if essential

```bash
# Alternative helper function with more formatting (DEPRECATED - use add_inline_comment instead)
# This function is kept for reference but should not be used
post_review_comment_deprecated() {
  echo "WARNING: post_review_comment is deprecated. Use add_inline_comment instead."
  local file_path=$1
  local line_number=$2
  local severity=$3
  local category=$4
  local issue=$5
  local context=$6
  local suggestion=$7
  
  # Call the correct function instead
  add_inline_comment "$file_path" "$line_number" "$severity" "$category" "$issue" "$context" "$suggestion"
}
```

## Phase 5: Validation Rules Application

Apply ALL validation rules from the loaded knowledge, but focus on the changed lines:

### From Frontend Standards
- Vue 3 Composition API patterns
- Component communication patterns
- Proper use of composables
- TypeScript strict mode compliance
- Bundle optimization

### From Security Audit
- Input validation
- XSS prevention
- CSRF protection
- Secure state management
- API security

### From Performance Check
- Render optimization
- Memory management
- Network efficiency
- Bundle size impact

## Phase 6: Contextual Review Based on PR Type

Analyze the PR description and changes to determine the type:

```bash
# Extract PR metadata with error handling
if [ ! -f pr_info.json ]; then
  echo "Error: pr_info.json not found"
  exit 1
fi

PR_TITLE=$(jq -r '.title // "Unknown"' < pr_info.json)
PR_BODY=$(jq -r '.body // ""' < pr_info.json)
FILE_COUNT=$(wc -l < changed_files.txt)
ADDITIONS=$(jq -r '.additions // 0' < pr_info.json)
DELETIONS=$(jq -r '.deletions // 0' < pr_info.json)

# Determine PR type and apply specific review criteria
if echo "$PR_TITLE $PR_BODY" | grep -qiE "(feature|feat)"; then
  echo "Detected feature PR - applying feature review criteria"
  # Check for tests, documentation, backward compatibility
elif echo "$PR_TITLE $PR_BODY" | grep -qiE "(fix|bug)"; then
  echo "Detected bug fix - checking root cause and regression tests"
  # Verify fix addresses root cause, includes tests
elif echo "$PR_TITLE $PR_BODY" | grep -qiE "(refactor)"; then
  echo "Detected refactoring - ensuring behavior preservation"
  # Check that tests still pass, no behavior changes
fi
```

## Phase 7: Complete Inline Review (NO SUMMARY COMMENTS)

Focus ONLY on inline comments. Do NOT create summary reviews that become giant comments.

```bash
# Initialize metrics tracking
REVIEW_START_TIME=$(date +%s)

# Debug: Show review completion stats
echo "Review completed with:"
echo "- Critical: $CRITICAL_COUNT"  
echo "- High: $HIGH_COUNT"
echo "- Medium: $MEDIUM_COUNT"
echo "- Low: $LOW_COUNT"
echo "- Total inline comments posted: $((CRITICAL_COUNT + HIGH_COUNT + MEDIUM_COUNT + LOW_COUNT))"

# IMPORTANT: Do NOT create summary reviews - only inline comments should be posted
# The comprehensive review should consist ENTIRELY of inline comments on specific lines
# Summary reviews create the "mega comment" problem we're trying to avoid

echo "Review complete - all feedback provided via inline comments"
```

## Important: Think Deeply

When reviewing:
1. **Think hard** about architectural implications
2. Consider how changes affect the entire system
3. Look for subtle bugs and edge cases
4. Evaluate maintainability over time
5. Consider extension developer experience
6. Think about migration paths

This is a COMPREHENSIVE review, not a linting pass. Provide the same quality feedback a senior engineer would give after careful consideration.

## Phase 8: Track Review Metrics

After completing the review, save metrics for analysis:

```bash
# Calculate review duration
REVIEW_END_TIME=$(date +%s)
REVIEW_DURATION=$((REVIEW_END_TIME - REVIEW_START_TIME))

# Calculate total issues
TOTAL_ISSUES=$((CRITICAL_COUNT + HIGH_COUNT + MEDIUM_COUNT + LOW_COUNT))

# Create metrics directory if it doesn't exist
METRICS_DIR=".claude/review-metrics"
mkdir -p "$METRICS_DIR"

# Generate metrics file
METRICS_FILE="$METRICS_DIR/metrics-$(date +%Y%m).json"

# Create or update monthly metrics file
if [ -f "$METRICS_FILE" ]; then
  # Append to existing file
  jq -n \
    --arg pr "$PR_NUMBER" \
    --arg title "$PR_TITLE" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg duration "$REVIEW_DURATION" \
    --arg files "$FILE_COUNT" \
    --arg additions "$ADDITIONS" \
    --arg deletions "$DELETIONS" \
    --arg total "$TOTAL_ISSUES" \
    --arg critical "$CRITICAL_COUNT" \
    --arg high "$HIGH_COUNT" \
    --arg medium "$MEDIUM_COUNT" \
    --arg low "$LOW_COUNT" \
    --arg architecture "$ARCHITECTURE_ISSUES" \
    --arg security "$SECURITY_ISSUES" \
    --arg performance "$PERFORMANCE_ISSUES" \
    --arg quality "$QUALITY_ISSUES" \
    '{
      pr_number: $pr,
      pr_title: $title,
      timestamp: $timestamp,
      review_duration_seconds: ($duration | tonumber),
      files_reviewed: ($files | tonumber),
      lines_added: ($additions | tonumber),
      lines_deleted: ($deletions | tonumber),
      issues: {
        total: ($total | tonumber),
        by_severity: {
          critical: ($critical | tonumber),
          high: ($high | tonumber),
          medium: ($medium | tonumber),
          low: ($low | tonumber)
        },
        by_category: {
          architecture: ($architecture | tonumber),
          security: ($security | tonumber),
          performance: ($performance | tonumber),
          quality: ($quality | tonumber)
        }
      }
    }' > "$METRICS_FILE.new"
  
  # Merge with existing data
  jq -s '.[0] + [.[1]]' "$METRICS_FILE" "$METRICS_FILE.new" > "$METRICS_FILE.tmp"
  mv "$METRICS_FILE.tmp" "$METRICS_FILE"
  rm "$METRICS_FILE.new"
else
  # Create new file
  jq -n \
    --arg pr "$PR_NUMBER" \
    --arg title "$PR_TITLE" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg duration "$REVIEW_DURATION" \
    --arg files "$FILE_COUNT" \
    --arg additions "$ADDITIONS" \
    --arg deletions "$DELETIONS" \
    --arg total "$TOTAL_ISSUES" \
    --arg critical "$CRITICAL_COUNT" \
    --arg high "$HIGH_COUNT" \
    --arg medium "$MEDIUM_COUNT" \
    --arg low "$LOW_COUNT" \
    --arg architecture "$ARCHITECTURE_ISSUES" \
    --arg security "$SECURITY_ISSUES" \
    --arg performance "$PERFORMANCE_ISSUES" \
    --arg quality "$QUALITY_ISSUES" \
    '[{
      pr_number: $pr,
      pr_title: $title,
      timestamp: $timestamp,
      review_duration_seconds: ($duration | tonumber),
      files_reviewed: ($files | tonumber),
      lines_added: ($additions | tonumber),
      lines_deleted: ($deletions | tonumber),
      issues: {
        total: ($total | tonumber),
        by_severity: {
          critical: ($critical | tonumber),
          high: ($high | tonumber),
          medium: ($medium | tonumber),
          low: ($low | tonumber)
        },
        by_category: {
          architecture: ($architecture | tonumber),
          security: ($security | tonumber),
          performance: ($performance | tonumber),
          quality: ($quality | tonumber)
        }
      }
    }]' > "$METRICS_FILE"
fi

echo "Review metrics saved to $METRICS_FILE"
```

This creates monthly metrics files (e.g., `metrics-202407.json`) that track:
- Which PRs were reviewed
- How long reviews took
- Types and severity of issues found
- Trends over time

You can later analyze these to see patterns and improve your development process.