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

## Phase 1: Environment Setup and PR Context

```bash
# Set up GitHub token for API calls
export GH_TOKEN=${GITHUB_TOKEN:-}

# Pre-flight checks
check_prerequisites() {
  # In GitHub Actions, auth is handled via GITHUB_TOKEN
  if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN is not set"
    exit 1
  fi
  
  # Get PR number from environment (set by workflow)
  if [ -z "$PR_NUMBER" ]; then
    echo "Error: PR_NUMBER environment variable is not set"
    exit 1
  fi
  
  # Check PR exists and is open
  PR_STATE=$(gh pr view $PR_NUMBER --json state -q .state 2>/dev/null || echo "NOT_FOUND")
  if [ "$PR_STATE" = "NOT_FOUND" ]; then
    echo "Error: PR #$PR_NUMBER not found"
    exit 1
  elif [ "$PR_STATE" != "OPEN" ]; then
    echo "Error: PR #$PR_NUMBER is not open (state: $PR_STATE)"
    exit 1
  fi
  
  # Check API rate limits
  RATE_REMAINING=$(gh api /rate_limit --jq '.rate.remaining')
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

# Fetch PR information
gh pr view $PR_NUMBER --json files,title,body,additions,deletions,baseRefName,headRefName > pr_info.json
gh pr diff $PR_NUMBER > pr_diff.txt
gh pr diff $PR_NUMBER --name-only > changed_files.txt

# Get the actual changes with line numbers
gh api repos/$REPOSITORY/pulls/$PR_NUMBER/files > pr_files.json

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
# Create knowledge directory
mkdir -p review_knowledge

# 1. Load project summary from comfy-claude-prompt-library
echo "Loading ComfyUI Frontend project knowledge..."
curl -s https://raw.githubusercontent.com/Comfy-Org/comfy-claude-prompt-library/master/project-summaries-for-agents/comfyui-frontend-summary.md > review_knowledge/project_summary.md

# 2. Load REPOSITORY_GUIDE.md for deep architectural understanding
curl -s https://raw.githubusercontent.com/Comfy-Org/comfy-claude-prompt-library/master/project-summaries-for-agents/ComfyUI_frontend/REPOSITORY_GUIDE.md > review_knowledge/repository_guide.md

# 3. Discover and load relevant knowledge folders
echo "Discovering available knowledge folders..."
# Fetch the knowledge directory listing
KNOWLEDGE_FOLDERS=$(curl -s https://api.github.com/repos/Comfy-Org/comfy-claude-prompt-library/contents/.claude/knowledge | jq -r '.[] | select(.type=="dir") | .name')

echo "Available knowledge folders: $KNOWLEDGE_FOLDERS"

# Analyze changed files to determine which knowledge folders might be relevant
CHANGED_FILES=$(cat changed_files.txt)

# For each knowledge folder, check if it might be relevant to the PR
for folder in $KNOWLEDGE_FOLDERS; do
  # Simple heuristic: if folder name appears in changed file paths or PR context
  if echo "$CHANGED_FILES $PR_TITLE $PR_BODY" | grep -qi "$folder"; then
    echo "Loading knowledge folder: $folder"
    # Fetch all files in that knowledge folder
    curl -s https://api.github.com/repos/Comfy-Org/comfy-claude-prompt-library/contents/.claude/knowledge/$folder | \
      jq -r '.[] | select(.type=="file") | .download_url' | \
      while read url; do
        filename=$(basename "$url")
        curl -s "$url" > "review_knowledge/${folder}_${filename}"
      done
  fi
done

# 4. Load validation rules from the repository
echo "Loading validation rules..."
VALIDATION_FILES=$(curl -s https://api.github.com/repos/Comfy-Org/comfy-claude-prompt-library/contents/.claude/commands/validation | jq -r '.[] | select(.name | contains("frontend") or contains("security") or contains("performance")) | .download_url')

for url in $VALIDATION_FILES; do
  filename=$(basename "$url")
  curl -s "$url" > "review_knowledge/validation_${filename}"
done

# 5. Load local project guidelines
if [ -f "CLAUDE.md" ]; then
  cp CLAUDE.md review_knowledge/local_claude.md
fi
if [ -f ".github/CLAUDE.md" ]; then
  cp .github/CLAUDE.md review_knowledge/github_claude.md
fi
```

## Phase 3: Deep Analysis Instructions

Now perform a comprehensive analysis. This is NOT a superficial check - analyze like a senior engineer would:

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

### 3.3 Security Deep Dive
Beyond obvious vulnerabilities:
- Authentication/authorization implications
- Data validation completeness
- State management security
- Cross-origin concerns
- Extension security boundaries

### 3.4 Performance Analysis
- Bundle size impact
- Render performance implications
- Memory leak potential
- Network request optimization
- State management efficiency

### 3.5 Integration Concerns
- Breaking changes to internal APIs
- Extension compatibility
- Backward compatibility
- Migration requirements

## Phase 4: Create Detailed Review Comments

For each issue found, create a detailed inline comment with:
1. Clear explanation of the issue
2. Why it matters in this specific context
3. Concrete suggestion for improvement
4. Code example when applicable

```bash
# Helper function for comprehensive comments
post_review_comment() {
  local file_path=$1
  local line_number=$2
  local severity=$3  # critical/high/medium/low
  local category=$4  # architecture/security/performance/quality
  local issue=$5
  local context=$6
  local suggestion=$7
  local example=$8
  
  local body="### [$category] $severity Priority

**Issue**: $issue

**Context**: $context

**Suggestion**: $suggestion"

  if [ -n "$example" ]; then
    body="$body

**Example**:
\`\`\`typescript
$example
\`\`\`"
  fi

  body="$body

*Related: See [repository guide](https://github.com/Comfy-Org/comfy-claude-prompt-library/blob/master/project-summaries-for-agents/ComfyUI_frontend/REPOSITORY_GUIDE.md) for patterns*"

  gh api -X POST /repos/$REPOSITORY/pulls/$PR_NUMBER/comments \
    -f path="$file_path" \
    -f line=$line_number \
    -f body="$body" \
    -f commit_id="$COMMIT_SHA" \
    -f side='RIGHT' || echo "Failed to post comment at $file_path:$line_number"
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
PR_TITLE=$(jq -r '.title' < pr_info.json)
PR_BODY=$(jq -r '.body' < pr_info.json)

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

## Phase 7: Generate Comprehensive Summary

After all inline comments, create a detailed summary:

```bash
# Initialize metrics tracking
REVIEW_START_TIME=$(date +%s)

# Count different types of issues
CRITICAL_COUNT=0
HIGH_COUNT=0
MEDIUM_COUNT=0
LOW_COUNT=0

# Track categories
ARCHITECTURE_ISSUES=0
SECURITY_ISSUES=0
PERFORMANCE_ISSUES=0
QUALITY_ISSUES=0

# Track files reviewed
FILE_COUNT=$(wc -l < changed_files.txt)
ADDITIONS=$(jq -r '.additions' < pr_info.json)
DELETIONS=$(jq -r '.deletions' < pr_info.json)

# Create the comprehensive summary
gh pr review $PR_NUMBER --comment --body "# Comprehensive PR Review

## Review Summary

**PR**: $PR_TITLE (#$PR_NUMBER)
**Impact**: $ADDITIONS additions, $DELETIONS deletions across $FILE_COUNT files

### Issue Distribution
- Critical: $CRITICAL_COUNT
- High: $HIGH_COUNT
- Medium: $MEDIUM_COUNT
- Low: $LOW_COUNT

### Category Breakdown
- Architecture: $ARCHITECTURE_ISSUES issues
- Security: $SECURITY_ISSUES issues
- Performance: $PERFORMANCE_ISSUES issues
- Code Quality: $QUALITY_ISSUES issues

## Key Findings

### Architecture & Design
[Detailed architectural analysis based on repository patterns]

### Security Considerations
[Security implications beyond basic vulnerabilities]

### Performance Impact
[Performance analysis including bundle size, render impact]

### Integration Points
[How this affects other systems, extensions, etc.]

## Positive Observations
[What was done well, good patterns followed]

## References
- [Repository Architecture Guide](https://github.com/Comfy-Org/comfy-claude-prompt-library/blob/master/project-summaries-for-agents/ComfyUI_frontend/REPOSITORY_GUIDE.md)
- [Frontend Standards](https://github.com/Comfy-Org/comfy-claude-prompt-library/blob/master/.claude/commands/validation/frontend-code-standards.md)
- [Security Guidelines](https://github.com/Comfy-Org/comfy-claude-prompt-library/blob/master/.claude/commands/validation/security-audit.md)

## Next Steps
1. Address critical issues before merge
2. Consider architectural feedback for long-term maintainability
3. Add tests for uncovered scenarios
4. Update documentation if needed

---
*This is a comprehensive automated review. For architectural decisions requiring human judgment, please request additional manual review.*"
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
    }' | jq -s '. as $new | ($METRICS_FILE | @json | fromjson) + $new' "$METRICS_FILE" > "$METRICS_FILE.tmp"
  mv "$METRICS_FILE.tmp" "$METRICS_FILE"
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