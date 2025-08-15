# Create Frontend Release

This command guides you through creating a comprehensive frontend release with semantic versioning analysis, automated change detection, security scanning, and multi-stage human verification.

<task>
Create a frontend release with version type: $ARGUMENTS

Expected format: Version increment type and optional description
Examples:
- `patch` - Bug fixes only
- `minor` - New features, backward compatible  
- `major` - Breaking changes
- `prerelease` - Alpha/beta/rc releases
- `patch "Critical security fixes"` - With custom description
- `minor --skip-changelog` - Skip automated changelog generation
- `minor --dry-run` - Simulate release without executing

If no arguments provided, the command will always perform prerelease if the current version is prerelease, or patch in other cases. This command will never perform minor or major releases without explicit direction.
</task>

## Prerequisites

Before starting, ensure:
- You have push access to the repository
- GitHub CLI (`gh`) is authenticated  
- You're on a clean main branch working tree
- All intended changes are merged to main
- You understand the scope of changes being released

## Critical Checks Before Starting

### 1. Check Current Version Status
```bash
# Get current version and check if it's a pre-release
CURRENT_VERSION=$(node -p "require('./package.json').version")
if [[ "$CURRENT_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+- ]]; then
  echo "⚠️  Current version $CURRENT_VERSION is a pre-release"
  echo "Consider releasing stable (e.g., 1.24.0-1 → 1.24.0) first"
fi
```

### 2. Find Last Stable Release
```bash
# Get last stable release tag (no pre-release suffix)
LAST_STABLE=$(git tag -l "v*" | grep -v "\-" | sort -V | tail -1)
echo "Last stable release: $LAST_STABLE"
```

## Configuration Options

**Environment Variables:**
- `RELEASE_SKIP_SECURITY_SCAN=true` - Skip security audit
- `RELEASE_AUTO_APPROVE=true` - Skip some confirmation prompts
- `RELEASE_DRY_RUN=true` - Simulate release without executing

## Release Process

### Step 1: Environment Safety Check

1. Verify clean working directory:
   ```bash
   git status --porcelain
   ```
2. Confirm on main branch:
   ```bash
   git branch --show-current
   ```
3. Pull latest changes:
   ```bash
   git pull origin main
   ```
4. Check GitHub CLI authentication:
   ```bash
   gh auth status
   ```
5. Verify npm/PyPI publishing access (dry run)
6. **CONFIRMATION REQUIRED**: Environment ready for release?

### Step 2: Analyze Recent Changes

1. Get current version from package.json
2. **IMPORTANT**: Determine correct base for comparison:
   ```bash
   # If current version is pre-release, use last stable release
   if [[ "$CURRENT_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+- ]]; then
     BASE_TAG=$LAST_STABLE
   else
     BASE_TAG=$(git describe --tags --abbrev=0)
   fi
   ```
3. Find commits since base release (CRITICAL: use --first-parent):
   ```bash
   git log ${BASE_TAG}..HEAD --oneline --no-merges --first-parent
   ```
4. Count total commits:
   ```bash
   COMMIT_COUNT=$(git log ${BASE_TAG}..HEAD --oneline --no-merges --first-parent | wc -l)
   echo "Found $COMMIT_COUNT commits since $BASE_TAG"
   ```
5. Analyze commits for:
   - Breaking changes (BREAKING CHANGE, !, feat())
   - New features (feat:, feature:)
   - Bug fixes (fix:, bugfix:)
   - Documentation changes (docs:)
   - Dependency updates
6. **VERIFY PR TARGET BRANCHES**:
   ```bash
   # Get merged PRs and verify they were merged to main
   gh pr list --state merged --limit 50 --json number,title,baseRefName,mergedAt | \
     jq -r '.[] | select(.baseRefName == "main") | "\(.number): \(.title)"'
   ```
7. **HUMAN ANALYSIS**: Review change summary and verify scope

### Step 3: Version Preview

**Version Preview:**
- Current: `${CURRENT_VERSION}`
- Proposed: Show exact version number
- **CONFIRMATION REQUIRED**: Proceed with version `X.Y.Z`?

### Step 4: Security and Dependency Audit

1. Run security audit:
   ```bash
   npm audit --audit-level moderate
   ```
2. Check for known vulnerabilities in dependencies
3. Scan for hardcoded secrets or credentials:
   ```bash
   git log -p ${BASE_TAG}..HEAD | grep -iE "(password|key|secret|token)" || echo "No sensitive data found"
   ```
4. Verify no sensitive data in recent commits
5. **SECURITY REVIEW**: Address any critical findings before proceeding?

### Step 5: Pre-Release Testing

1. Run complete test suite:
   ```bash
   npm run test:unit
   npm run test:component
   ```
2. Run type checking:
   ```bash
   npm run typecheck
   ```
3. Run linting (may have issues with missing packages):
   ```bash
   npm run lint || echo "Lint issues - verify if critical"
   ```
4. Test build process:
   ```bash
   npm run build
   npm run build:types
   ```
5. **QUALITY GATE**: All tests and builds passing?

### Step 6: Breaking Change Analysis

1. Analyze API changes in:
   - Public TypeScript interfaces
   - Extension APIs
   - Component props
   - CLAUDE.md guidelines
2. Check for:
   - Removed public functions/classes
   - Changed function signatures
   - Deprecated feature removals
   - Configuration changes
3. Generate breaking change summary
4. **COMPATIBILITY REVIEW**: Breaking changes documented and justified?

### Step 7: Analyze Dependency Updates

1. **Check significant dependency updates:**
   ```bash
   # Extract all dependency changes for major version bumps
   OTHER_DEP_CHANGES=""
   
   # Compare major dependency versions (you can extend this list)
   MAJOR_DEPS=("vue" "vite" "@vitejs/plugin-vue" "typescript" "pinia")
   
   for dep in "${MAJOR_DEPS[@]}"; do
     PREV_VER=$(echo "$PREV_PACKAGE_JSON" | grep -o "\"$dep\": \"[^\"]*\"" | grep -o '[0-9][^"]*' | head -1 || echo "")
     CURR_VER=$(echo "$CURRENT_PACKAGE_JSON" | grep -o "\"$dep\": \"[^\"]*\"" | grep -o '[0-9][^"]*' | head -1 || echo "")
     
     if [ "$PREV_VER" != "$CURR_VER" ] && [ -n "$PREV_VER" ] && [ -n "$CURR_VER" ]; then
       # Check if it's a major version change
       PREV_MAJOR=$(echo "$PREV_VER" | cut -d. -f1 | sed 's/[^0-9]//g')
       CURR_MAJOR=$(echo "$CURR_VER" | cut -d. -f1 | sed 's/[^0-9]//g')
       
       if [ "$PREV_MAJOR" != "$CURR_MAJOR" ]; then
         OTHER_DEP_CHANGES="${OTHER_DEP_CHANGES}\n- **${dep}**: ${PREV_VER} → ${CURR_VER} (Major version change)"
       fi
     fi
   done
   ```

### Step 8: Generate Comprehensive Release Notes

1. Extract commit messages since base release:
   ```bash
   git log ${BASE_TAG}..HEAD --oneline --no-merges --first-parent > commits.txt
   ```
2. **CRITICAL**: Verify PR inclusion by checking merge location:
   ```bash
   # For each significant PR mentioned, verify it's on main
   for PR in ${SIGNIFICANT_PRS}; do
     COMMIT=$(gh pr view $PR --json mergeCommit -q .mergeCommit.oid)
     git branch -r --contains $COMMIT | grep -q "origin/main" || \
       echo "WARNING: PR #$PR not on main branch!"
   done
   ```
3. Create standardized release notes using this exact template:
   ```bash
   cat > release-notes-${NEW_VERSION}.md << 'EOF'
   ## ⚠️ Breaking Changes
   <!-- List breaking changes if any, otherwise remove this entire section -->
   - Breaking change description (#PR_NUMBER)

   ---

   ## What's Changed

   ### 🚀 Features
   <!-- List features here, one per line with PR reference -->
   - Feature description (#PR_NUMBER)

   ### 🐛 Bug Fixes
   <!-- List bug fixes here, one per line with PR reference -->
   - Bug fix description (#PR_NUMBER)

   ### 🔧 Maintenance
   <!-- List refactoring, chore, and other maintenance items -->
   - Maintenance item description (#PR_NUMBER)

   ### 📚 Documentation
   <!-- List documentation changes if any, remove section if empty -->
   - Documentation update description (#PR_NUMBER)

   ### ⬆️ Dependencies
   <!-- List dependency updates -->
   - Updated dependency from vX.X.X to vY.Y.Y (#PR_NUMBER)

   **Full Changelog**: https://github.com/Comfy-Org/ComfyUI_frontend/compare/${BASE_TAG}...v${NEW_VERSION}
   EOF
   ```
4. **Parse commits and populate template:**
   - Group commits by conventional commit type (feat:, fix:, chore:, etc.)
   - Extract PR numbers from commit messages
   - For breaking changes, analyze if changes affect:
     - Public APIs (app object, api module)
     - Extension/workspace manager APIs
     - Node schema, workflow schema, or other public schemas
     - Any other public-facing interfaces
   - For dependency updates, list version changes with PR numbers
   - Remove empty sections (e.g., if no documentation changes)
   - Ensure consistent bullet format: `- Description (#PR_NUMBER)`
5. **CONTENT REVIEW**: Release notes follow standard format?

### Step 9: Create Version Bump PR

**For standard version bumps (patch/minor/major):**
```bash
# Trigger the workflow
gh workflow run version-bump.yaml -f version_type=${VERSION_TYPE}

# Workflow runs quickly - usually creates PR within 30 seconds
echo "Workflow triggered. Waiting for PR creation..."
```

**For releasing a stable version:**
1. Must manually create branch and update version:
   ```bash
   git checkout -b version-bump-${NEW_VERSION}
   # Edit package.json to remove pre-release suffix
   git add package.json
   git commit -m "${NEW_VERSION}"
   git push origin version-bump-${NEW_VERSION}
   ```

2. Wait for PR creation (if using workflow) or create manually:
   ```bash
   # For workflow-created PRs - wait and find it
   sleep 30
   # Look for PR from comfy-pr-bot (not github-actions)
   PR_NUMBER=$(gh pr list --author comfy-pr-bot --limit 1 --json number --jq '.[0].number')
   
   # Verify we got the PR
   if [ -z "$PR_NUMBER" ]; then
     echo "PR not found yet. Checking recent PRs..."
     gh pr list --limit 5 --json number,title,author
   fi
   
   # For manual PRs
   gh pr create --title "${NEW_VERSION}" \
     --body-file release-notes-${NEW_VERSION}.md \
     --label "Release"
   ```
3. **Update PR with release notes:**
   ```bash
   # For workflow-created PRs, update the body with our release notes
   gh pr edit ${PR_NUMBER} --body-file release-notes-${NEW_VERSION}.md
   ```
4. **PR REVIEW**: Version bump PR created with standardized release notes?

### Step 10: Critical Release PR Verification

1. **CRITICAL**: Verify PR has "Release" label:
   ```bash
   gh pr view ${PR_NUMBER} --json labels | jq -r '.labels[].name' | grep -q "Release" || \
     echo "ERROR: Release label missing! Add it immediately!"
   ```
2. Check for update-locales commits:
   ```bash
   # WARNING: update-locales may add [skip ci] which blocks release workflow!
   gh pr view ${PR_NUMBER} --json commits | grep -q "skip ci" && \
     echo "WARNING: [skip ci] detected - release workflow may not trigger!"
   ```
3. Verify version number in package.json
4. Review all changed files
5. Ensure no unintended changes included
6. Wait for required PR checks:
   ```bash
   gh pr checks ${PR_NUMBER} --watch
   ```
7. **FINAL CODE REVIEW**: Release label present and no [skip ci]?

### Step 11: Pre-Merge Validation

1. **Review Requirements**: Release PRs require approval
2. Monitor CI checks - watch for update-locales
3. **CRITICAL WARNING**: If update-locales adds [skip ci], the release workflow won't trigger!
4. Check no new commits to main since PR creation
5. **DEPLOYMENT READINESS**: Ready to merge?

### Step 12: Execute Release

1. **FINAL CONFIRMATION**: Merge PR to trigger release?
2. Merge the Release PR:
   ```bash
   gh pr merge ${PR_NUMBER} --merge
   ```
3. **IMMEDIATELY CHECK**: Did release workflow trigger?
   ```bash
   sleep 10
   gh run list --workflow=release.yaml --limit=1
   ```
4. **For Minor/Major Version Releases**: The create-release-candidate-branch workflow will automatically:
   - Create a `core/x.yy` branch for the PREVIOUS minor version
   - Apply branch protection rules
   - Document the feature freeze policy
   ```bash
   # Monitor branch creation (for minor/major releases)
   gh run list --workflow=create-release-candidate-branch.yaml --limit=1
   ```
4. If workflow didn't trigger due to [skip ci]:
   ```bash
   echo "ERROR: Release workflow didn't trigger!"
   echo "Options:"
   echo "1. Create patch release (e.g., 1.24.1) to trigger workflow"
   echo "2. Investigate manual release options"
   ```
5. If workflow triggered, monitor execution:
   ```bash
   WORKFLOW_RUN_ID=$(gh run list --workflow=release.yaml --limit=1 --json databaseId --jq '.[0].databaseId')
   gh run watch ${WORKFLOW_RUN_ID}
   ```

### Step 13: Enhance GitHub Release

1. Wait for automatic release creation:
   ```bash
   # Wait for release to be created
   while ! gh release view v${NEW_VERSION} >/dev/null 2>&1; do
     echo "Waiting for release creation..."
     sleep 10
   done
   ```

2. **Enhance the GitHub release:**
   ```bash
   # Update release with our release notes
   gh release edit v${NEW_VERSION} \
     --title "🚀 ComfyUI Frontend v${NEW_VERSION}" \
     --notes-file release-notes-${NEW_VERSION}.md \
     --latest
   
   # Add any additional assets if needed
   # gh release upload v${NEW_VERSION} additional-assets.zip
   ```

3. **Verify release details:**
   ```bash
   gh release view v${NEW_VERSION}
   ```

### Step 14: Verify Multi-Channel Distribution

1. **GitHub Release:**
   ```bash
   gh release view v${NEW_VERSION} --json assets,body,createdAt,tagName
   ```
   - ✅ Check release notes
   - ✅ Verify dist.zip attachment
   - ✅ Confirm release marked as latest (for main branch)

2. **PyPI Package:**
   ```bash
   # Check PyPI availability (may take a few minutes)
   for i in {1..10}; do
     if curl -s https://pypi.org/pypi/comfyui-frontend-package/json | jq -r '.releases | keys[]' | grep -q ${NEW_VERSION}; then
       echo "✅ PyPI package available"
       break
     fi
     echo "⏳ Waiting for PyPI package... (attempt $i/10)"
     sleep 30
   done
   ```

3. **npm Package:**
   ```bash
   # Check npm availability
   for i in {1..10}; do
     if npm view @comfyorg/comfyui-frontend-types@${NEW_VERSION} version >/dev/null 2>&1; then
       echo "✅ npm package available"
       break
     fi
     echo "⏳ Waiting for npm package... (attempt $i/10)"
     sleep 30
   done
   ```

4. **DISTRIBUTION VERIFICATION**: All channels published successfully?

### Step 15: Post-Release Monitoring Setup

1. **Monitor immediate release health:**
   ```bash
   # Check for immediate issues
   gh issue list --label "bug" --state open --limit 5 --json title,number,createdAt
   
   # Monitor download metrics (if accessible)
   gh release view v${NEW_VERSION} --json assets --jq '.assets[].downloadCount'
   ```

2. **Update documentation tracking:**
   ```bash
   cat > post-release-checklist.md << EOF
   # Post-Release Checklist for v${NEW_VERSION}

   ## Immediate Tasks (Next 24 hours)
   - [ ] Monitor error rates and user feedback
   - [ ] Watch for critical issues
   - [ ] Verify documentation is up to date
   - [ ] Check community channels for questions

   ## Short-term Tasks (Next week)
   - [ ] Update external integration guides
   - [ ] Monitor adoption metrics
   - [ ] Gather user feedback
   - [ ] Plan next release cycle

   ## Long-term Tasks
   - [ ] Analyze release process improvements
   - [ ] Update release templates based on learnings
   - [ ] Document any new patterns discovered

   ## Key Metrics to Track
   - Download counts: GitHub, PyPI, npm
   - Issue reports related to v${NEW_VERSION}
   - Community feedback and adoption
   - Performance impact measurements
   EOF
   ```

3. **Create release summary:**
   ```bash
   cat > release-summary-${NEW_VERSION}.md << EOF
   # Release Summary: ComfyUI Frontend v${NEW_VERSION}

   **Released:** $(date)
   **Type:** ${VERSION_TYPE}
   **Duration:** ~${RELEASE_DURATION} minutes
   **Release Commit:** ${RELEASE_COMMIT}

   ## Metrics
   - **Commits Included:** ${COMMITS_COUNT}
   - **Contributors:** ${CONTRIBUTORS_COUNT}
   - **Files Changed:** ${FILES_CHANGED}
   - **Lines Added/Removed:** +${LINES_ADDED}/-${LINES_REMOVED}

   ## Distribution Status
   - ✅ GitHub Release: Published
   - ✅ PyPI Package: Available
   - ✅ npm Types: Available

   ## Next Steps
   - Monitor for 24-48 hours
   - Address any critical issues immediately
   - Plan next release cycle

   ## Files Generated
   - \`release-notes-${NEW_VERSION}.md\` - Comprehensive release notes
   - \`post-release-checklist.md\` - Follow-up tasks
   - \`gtm-summary-${NEW_VERSION}.md\` - Marketing team notification
   EOF
   ```

4. **RELEASE COMPLETION**: All post-release setup completed?

### Step 16: Generate GTM Feature Summary

1. **Extract and analyze PR data:**
   ```bash
   echo "📊 Checking for marketing-worthy features..."
   
   # Extract all PR data inline
   PR_DATA=$(
     PR_LIST=$(git log ${BASE_TAG}..HEAD --grep="Merge pull request" --pretty=format:"%s" | grep -oE "#[0-9]+" | tr -d '#' | sort -u)
     
     echo "["
     first=true
     for PR in $PR_LIST; do
       [[ "$first" == true ]] && first=false || echo ","
       gh pr view $PR --json number,title,author,body,files,labels,closedAt 2>/dev/null || continue
     done
     echo "]"
   )
   
   # Save for analysis
   echo "$PR_DATA" > prs-${NEW_VERSION}.json
   ```

2. **Analyze for GTM-worthy features:**
   ```
   <task>
   Review these PRs to identify if ANY would interest a marketing/growth team.
   
   Consider if a PR:
   - Changes something users directly interact with or experience
   - Makes something noticeably better, faster, or easier
   - Introduces capabilities users have been asking for
   - Has visual assets (screenshots, GIFs, videos) that could be shared
   - Tells a compelling story about improvement or innovation
   - Would make users excited if they heard about it
   
   Many releases contain only technical improvements, bug fixes, or internal changes - 
   that's perfectly normal. Only flag PRs that would genuinely interest end users.
   
   If you find marketing-worthy PRs, note:
   - PR number, title, and author
   - Any media links from the description
   - One sentence on why it's worth showcasing
   
   If nothing is marketing-worthy, just say "No marketing-worthy features in this release."
   </task>
   
   PR data: [contents of prs-${NEW_VERSION}.json]
   ```

3. **Generate GTM notification (only if needed):**
   ```
   If there are marketing-worthy features, create a message for #gtm with:
   
   🚀 Frontend Release v${NEW_VERSION}
   
   Timeline: Available now in nightly, ~2-3 weeks for core
   
   Features worth showcasing:
   [List the selected PRs with media links and authors]
   
   Testing: --front-end-version ${NEW_VERSION}
   
   If there are NO marketing-worthy features, generate:
   "No marketing-worthy features in v${NEW_VERSION} - mostly internal improvements and bug fixes."
   ```

4. **Save the output:**
   ```bash
   # Claude generates the GTM summary and saves it
   # Save to gtm-summary-${NEW_VERSION}.md
   
   # Check if notification is needed
   if grep -q "No marketing-worthy features" gtm-summary-${NEW_VERSION}.md; then
     echo "✅ No GTM notification needed for this release"
     echo "📄 Summary saved to: gtm-summary-${NEW_VERSION}.md"
   else
     echo "📋 GTM summary saved to: gtm-summary-${NEW_VERSION}.md"
     echo "📤 Share this file in #gtm channel to notify the team"
   fi
   ```

## Advanced Safety Features

### Rollback Procedures

**Pre-Merge Rollback:**
```bash
# Close version bump PR and reset
gh pr close ${PR_NUMBER}
git reset --hard origin/main
git clean -fd
```

**Post-Merge Rollback:**
```bash
# Create immediate patch release with reverts
git revert ${RELEASE_COMMIT}
# Follow this command again with patch version
```

**Emergency Procedures:**
```bash
# Document incident
cat > release-incident-${NEW_VERSION}.md << EOF
# Release Incident Report

**Version:** ${NEW_VERSION}
**Issue:** [Describe the problem]
**Impact:** [Severity and scope]
**Resolution:** [Steps taken]
**Prevention:** [Future improvements]
EOF

# Contact package registries for critical issues
echo "For critical security issues, consider:"
echo "- PyPI: Contact support for package yanking"
echo "- npm: Use 'npm unpublish' within 72 hours"
echo "- GitHub: Update release with warning notes"
```

### Quality Gates Summary

The command implements multiple quality gates:

1. **🔒 Security Gate**: Vulnerability scanning, secret detection
2. **🧪 Quality Gate**: Unit and component tests, linting, type checking
3. **📋 Content Gate**: Changelog accuracy, release notes quality
4. **🔄 Process Gate**: Release timing verification
5. **✅ Verification Gate**: Multi-channel publishing confirmation
6. **📊 Monitoring Gate**: Post-release health tracking

## Common Scenarios

### Scenario 1: Regular Feature Release
```bash
/project:create-frontend-release minor
```
- Analyzes features since last release
- Generates changelog automatically
- Creates comprehensive release notes

### Scenario 2: Critical Security Patch
```bash
/project:create-frontend-release patch "Security fixes for CVE-2024-XXXX"
```
- Expedited security scanning
- Enhanced monitoring setup

### Scenario 3: Major Version with Breaking Changes
```bash
/project:create-frontend-release major
```
- Comprehensive breaking change analysis
- Migration guide generation

### Scenario 4: Pre-release Testing
```bash
/project:create-frontend-release prerelease
```
- Creates alpha/beta/rc versions
- Draft release status
- Python package specs require that prereleases use alpha/beta/rc as the preid

## Critical Implementation Notes

When executing this release process, pay attention to these key aspects:

### Version Handling
- For pre-release versions (e.g., 1.24.0-rc.1), the next stable release should be the same version without the suffix (1.24.0)
- Never skip version numbers - follow semantic versioning strictly

### Commit History Analysis
- **ALWAYS** use `--first-parent` flag with git log to avoid including commits from merged feature branches
- Verify PR merge targets before including them in changelogs:
  ```bash
  gh pr view ${PR_NUMBER} --json baseRefName
  ```

### Release Workflow Triggers
- The "Release" label on the PR is **CRITICAL** - without it, PyPI/npm publishing won't occur
- Check for `[skip ci]` in commit messages before merging - this blocks the release workflow
- If you encounter `[skip ci]`, push an empty commit to override it:
  ```bash
  git commit --allow-empty -m "Trigger release workflow"
  ```

### PR Creation Details
- Version bump PRs come from `comfy-pr-bot`, not `github-actions`
- The workflow typically completes in 20-30 seconds
- Always wait for the PR to be created before trying to edit it

### Breaking Changes Detection
- Analyze changes to public-facing APIs:
  - The `app` object and its methods
  - The `api` module exports
  - Extension and workspace manager interfaces
  - Node schema, workflow schema, and other public schemas
- Any modifications to these require marking as breaking changes

### Recovery Procedures
If the release workflow fails to trigger:
1. Create a revert PR to restore the previous version
2. Merge the revert
3. Re-run the version bump workflow
4. This approach is cleaner than creating extra version numbers

