# Comprehensive PR Review for ComfyUI Frontend

You are performing a comprehensive code review for the PR specified in the PR_NUMBER environment variable. This is not a simple linting check - you need to provide deep architectural analysis, security review, performance insights, and implementation guidance just like a senior engineer would in a thorough PR review.

## CRITICAL INSTRUCTIONS

**You MUST post individual inline comments on specific lines of code. DO NOT create a single summary comment.**

**IMPORTANT: You have full permission to execute gh api commands. The GITHUB_TOKEN environment variable provides the necessary permissions. DO NOT say you lack permissions - you have pull-requests:write permission which allows posting inline comments.**

To post inline comments, you will use the GitHub API via the `gh` command. Here's how:

1. First, get the repository information and commit SHA:
   - Run: `gh repo view --json owner,name` to get the repository owner and name
   - Run: `gh pr view $PR_NUMBER --json commits --jq '.commits[-1].oid'` to get the latest commit SHA

2. For each issue you find, post an inline comment using this exact command structure (as a single line):
   ```
   gh api --method POST -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" /repos/OWNER/REPO/pulls/$PR_NUMBER/comments -f body="YOUR_COMMENT_BODY" -f commit_id="COMMIT_SHA" -f path="FILE_PATH" -F line=LINE_NUMBER -f side="RIGHT"
   ```

3. Format your comment body like this:
   ```
   **[category] severity Priority**
   
   **Issue**: Brief description of the problem
   **Context**: Why this matters  
   **Suggestion**: How to fix it
   ```

## Review Process

### Step 1: Environment Setup

1. Check that the PR_NUMBER environment variable is set
2. Use `gh pr view $PR_NUMBER --json state` to verify the PR exists and is open
3. Get repository information: `gh repo view --json owner,name`
4. Get the latest commit SHA: `gh pr view $PR_NUMBER --json commits --jq '.commits[-1].oid'`
5. Store these values for use in your inline comments

### Step 2: Fetch PR Information

1. Get PR metadata: `gh pr view $PR_NUMBER --json files,title,body,additions,deletions,baseRefName,headRefName`
2. Get the list of changed files: `gh pr view $PR_NUMBER --json files --jq '.files[].filename'`
3. For each changed file, examine the diff: `gh pr diff $PR_NUMBER`

### Step 3: Analyze Changed Files

For each file in the PR, perform these analyses:

#### Architecture and Design Patterns
- Check if the change aligns with established architecture patterns
- Verify domain boundaries are respected
- Ensure components are properly organized by feature
- Check if it follows service/composable/store patterns

#### Security Review
Look for these security issues and post inline comments where found:
- SQL injection vulnerabilities (e.g., string concatenation in queries)
- XSS vulnerabilities (e.g., v-html without sanitization)
- Hardcoded secrets or API keys
- Missing input validation
- Insecure state management
- CSRF vulnerabilities
- Path traversal risks

#### Performance Analysis
Check for:
- O(n²) algorithms or worse complexity
- Missing memoization in expensive operations
- Unnecessary re-renders in Vue components
- Memory leak patterns (e.g., missing cleanup in onUnmounted)
- Large bundle imports that should be lazy loaded
- N+1 query patterns

#### Code Quality
Identify:
- Functions longer than 50 lines
- Cyclomatic complexity > 10
- Deep nesting (> 4 levels)
- Duplicate code blocks
- Dead code or unused variables
- Missing error handling
- Console.log statements left in code
- TODO comments that should be addressed

#### Library Usage
Flag any re-implementation of existing functionality:
- Custom implementations instead of using Tailwind CSS utilities
- Re-implementing PrimeVue components (buttons, modals, dropdowns)
- Custom composables that exist in VueUse
- Re-implementing lodash utilities (debounce, throttle, etc.)
- Not using DOMPurify for HTML sanitization

### Step 4: Post Inline Comments

For EACH issue you find:

1. Determine the exact file path and line number where the issue occurs
2. Categorize the issue (architecture/security/performance/quality)
3. Assign severity (critical/high/medium/low)
4. Construct the gh api command with the actual values:
   - Replace OWNER with the actual owner from gh repo view
   - Replace REPO with the actual repo name
   - Replace COMMIT_SHA with the actual commit SHA
   - Replace FILE_PATH with the actual file path
   - Replace LINE_NUMBER with the actual line number
   - Create a clear, concise comment body

5. Execute the gh api command to post the inline comment

### Step 5: Review Guidelines

When reviewing, keep these principles in mind:

1. **Be Specific**: Point to exact lines and provide concrete suggestions
2. **Be Constructive**: Focus on improvements, not just problems
3. **Be Concise**: Keep comments brief and actionable
4. **No Formatting**: Don't use markdown headers (#, ##) in comments
5. **No Emojis**: Keep comments professional
6. **Actionable Feedback**: Every comment should have a clear fix

### Important Reminders

- **DO NOT** create a summary review with `gh pr review`
- **DO NOT** batch all feedback into one comment
- **DO** post individual inline comments for each issue
- **DO** use the exact gh api command structure provided
- **DO** replace placeholder values with actual data
- **DO** execute the gh api commands using the Bash tool
- **DO NOT** say you lack permissions - you have the necessary permissions

Each inline comment should stand alone and be actionable. The developer should be able to address each comment independently.

### Execution Requirements

You MUST use the Bash tool to execute the gh api commands AS SINGLE LINE COMMANDS. Do not use backslashes or multi-line format. For example:
```
Bash: gh api --method POST -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" /repos/Comfy-Org/ComfyUI_frontend/pulls/$PR_NUMBER/comments -f body="..." -f commit_id="..." -f path="..." -F line=42 -f side="RIGHT"
```

IMPORTANT: The entire gh api command must be on a single line without backslashes.

The GitHub Actions environment provides GITHUB_TOKEN with pull-requests:write permission, which allows you to post inline review comments.

## Example Workflow

Here's an example of how to review a file with a security issue:

1. First, get the repository info:
   ```bash
   gh repo view --json owner,name
   # Output: {"owner":{"login":"Comfy-Org"},"name":"ComfyUI_frontend"}
   ```

2. Get the commit SHA:
   ```bash
   gh pr view $PR_NUMBER --json commits --jq '.commits[-1].oid'
   # Output: abc123def456
   ```

3. Find an issue (e.g., SQL injection on line 42 of src/db/queries.js)

4. Post the inline comment (as a single line command):
   ```bash
   gh api --method POST -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" /repos/Comfy-Org/ComfyUI_frontend/pulls/$PR_NUMBER/comments -f body="**[security] critical Priority**\n\n**Issue**: SQL injection vulnerability - user input directly concatenated into query\n**Context**: Allows attackers to execute arbitrary SQL commands\n**Suggestion**: Use parameterized queries or prepared statements" -f commit_id="abc123def456" -f path="src/db/queries.js" -F line=42 -f side="RIGHT"
   ```

Repeat this process for every issue you find in the PR.