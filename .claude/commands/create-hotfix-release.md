# Create Hotfix Release

This command guides you through creating a patch/hotfix release for ComfyUI Frontend with comprehensive safety checks and human confirmations at each step.

<task>
Create a hotfix release by cherry-picking commits or PR commits from main to a core branch: $ARGUMENTS

Expected format: Comma-separated list of commits or PR numbers
Examples: 
- `abc123,def456,ghi789` (commits)
- `#1234,#5678` (PRs)
- `abc123,#1234,def456` (mixed)

If no arguments provided, the command will help identify the correct core branch and guide you through selecting commits/PRs.
</task>

## Prerequisites

Before starting, ensure:
- You have push access to the repository
- GitHub CLI (`gh`) is authenticated
- You're on a clean working tree
- You understand the commits/PRs you're cherry-picking

## Hotfix Release Process

### Step 1: Identify Target Core Branch

1. Fetch the current ComfyUI requirements.txt from master branch:
   ```bash
   curl -s https://raw.githubusercontent.com/comfyanonymous/ComfyUI/master/requirements.txt | grep "comfyui-frontend-package"
   ```
2. Extract the `comfyui-frontend-package` version (e.g., `comfyui-frontend-package==1.23.4`)
3. Parse version to get major.minor (e.g., `1.23.4` → `1.23`)
4. Determine core branch: `core/<major>.<minor>` (e.g., `core/1.23`)
5. Verify the core branch exists: `git ls-remote origin refs/heads/core/*`
6. **CONFIRMATION REQUIRED**: Is `core/X.Y` the correct target branch?

### Step 2: Parse and Validate Arguments

1. Parse the comma-separated list of commits/PRs
2. For each item:
   - If starts with `#`: Treat as PR number
   - Otherwise: Treat as commit hash
3. For PR numbers:
   - Fetch PR details using `gh pr view <number>`
   - Extract the merge commit if PR is merged
   - If PR has multiple commits, list them all
   - **CONFIRMATION REQUIRED**: Use merge commit or cherry-pick individual commits?
4. Validate all commit hashes exist in the repository

### Step 3: Analyze Target Changes

1. For each commit/PR to cherry-pick:
   - Display commit hash, author, date
   - Show PR title and number (if applicable)
   - Display commit message
   - Show files changed and diff statistics
   - Check if already in core branch: `git branch --contains <commit>`
2. Identify potential conflicts by checking changed files
3. **CONFIRMATION REQUIRED**: Proceed with these commits?

### Step 4: Create Hotfix Branch

1. Checkout the core branch (e.g., `core/1.23`)
2. Pull latest changes: `git pull origin core/X.Y`
3. Display current version from package.json
4. Create hotfix branch: `hotfix/<version>-<timestamp>`
   - Example: `hotfix/1.23.4-20241120`
5. **CONFIRMATION REQUIRED**: Created branch correctly?

### Step 5: Cherry-pick Changes

For each commit:
1. Attempt cherry-pick: `git cherry-pick <commit>`
2. If conflicts occur:
   - Display conflict details
   - Show conflicting sections
   - Provide resolution guidance
   - **CONFIRMATION REQUIRED**: Conflicts resolved correctly?
3. After successful cherry-pick:
   - Show the changes: `git show HEAD`
   - Run validation: `npm run typecheck && npm run lint`
4. **CONFIRMATION REQUIRED**: Cherry-pick successful and valid?

### Step 6: Create PR to Core Branch

1. Push the hotfix branch: `git push origin hotfix/<version>-<timestamp>`
2. Create PR using gh CLI:
   ```bash
   gh pr create --base core/X.Y --head hotfix/<version>-<timestamp> \
     --title "[Hotfix] Cherry-pick fixes to core/X.Y" \
     --body "Cherry-picked commits: ..."
   ```
3. Add appropriate labels (but NOT "Release" yet)
4. PR body should include:
   - List of cherry-picked commits/PRs
   - Original issue references
   - Testing instructions
   - Impact assessment
5. **CONFIRMATION REQUIRED**: PR created correctly?

### Step 7: Wait for Tests

1. Monitor PR checks: `gh pr checks`
2. Display test results as they complete
3. If any tests fail:
   - Show failure details
   - Analyze if related to cherry-picks
   - **DECISION REQUIRED**: Fix and continue, or abort?
4. Wait for all required checks to pass
5. **CONFIRMATION REQUIRED**: All tests passing?

### Step 8: Merge Hotfix PR

1. Verify all checks have passed
2. Check for required approvals
3. Merge the PR: `gh pr merge --merge`
4. Delete the hotfix branch
5. **CONFIRMATION REQUIRED**: PR merged successfully?

### Step 9: Create Version Bump

1. Checkout the core branch: `git checkout core/X.Y`
2. Pull latest changes: `git pull origin core/X.Y`
3. Read current version from package.json
4. Determine patch version increment:
   - Current: `1.23.4` → New: `1.23.5`
5. Create release branch named with new version: `release/1.23.5`
6. Update version in package.json to `1.23.5`
7. Commit: `git commit -m "[release] Bump version to 1.23.5"`
8. **CONFIRMATION REQUIRED**: Version bump correct?

### Step 10: Create Release PR

1. Push release branch: `git push origin release/1.23.5`
2. Create PR with Release label:
   ```bash
   gh pr create --base core/X.Y --head release/1.23.5 \
     --title "[Release] v1.23.5" \
     --body "..." \
     --label "Release"
   ```
3. **CRITICAL**: Verify "Release" label is added
4. PR description should include:
   - Version: `1.23.4` → `1.23.5`
   - Included fixes (link to previous PR)
   - Release notes for users
5. **CONFIRMATION REQUIRED**: Release PR has "Release" label?

### Step 11: Monitor Release Process

1. Wait for PR checks to pass
2. **FINAL CONFIRMATION**: Ready to trigger release by merging?
3. Merge the PR: `gh pr merge --merge`
4. Monitor release workflow:
   ```bash
   gh run list --workflow=release.yaml --limit=1
   gh run watch
   ```
5. Track progress:
   - GitHub release draft/publication
   - PyPI upload
   - npm types publication

### Step 12: Post-Release Verification

1. Verify GitHub release:
   ```bash
   gh release view v1.23.5
   ```
2. Check PyPI package:
   ```bash
   pip index versions comfyui-frontend-package | grep 1.23.5
   ```
3. Verify npm package:
   ```bash
   npm view @comfyorg/comfyui-frontend-types@1.23.5
   ```
4. Generate release summary with:
   - Version released
   - Commits included
   - Issues fixed
   - Distribution status
5. **CONFIRMATION REQUIRED**: Release completed successfully?

## Safety Checks

Throughout the process:
- Always verify core branch matches ComfyUI's requirements.txt
- For PRs: Ensure using correct commits (merge vs individual)
- Check version numbers follow semantic versioning
- **Critical**: "Release" label must be on version bump PR
- Validate cherry-picks don't break core branch stability
- Keep audit trail of all operations

## Rollback Procedures

If something goes wrong:
- Before push: `git reset --hard origin/core/X.Y`
- After PR creation: Close PR and start over
- After failed release: Create new patch version with fixes
- Document any issues for future reference

## Important Notes

- Core branch version will be behind main - this is expected
- The "Release" label triggers the PyPI/npm publication
- PR numbers must include the `#` prefix
- Mixed commits/PRs are supported but review carefully
- Always wait for full test suite before proceeding

## Expected Timeline

- Step 1-3: ~10 minutes (analysis)
- Steps 4-6: ~15-30 minutes (cherry-picking)
- Step 7: ~10-20 minutes (tests)
- Steps 8-10: ~10 minutes (version bump)
- Step 11-12: ~15-20 minutes (release)
- Total: ~60-90 minutes

This process ensures a safe, verified hotfix release with multiple confirmation points and clear tracking of what changes are being released.