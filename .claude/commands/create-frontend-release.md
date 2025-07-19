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
   npm run test:browser
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

### Step 7: Generate and Save Changelog

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
3. Group by type:
   - 🚀 **Features** (feat:)
   - 🐛 **Bug Fixes** (fix:)
   - 💥 **Breaking Changes** (BREAKING CHANGE)
   - 📚 **Documentation** (docs:)
   - 🔧 **Maintenance** (chore:, refactor:)
   - ⬆️ **Dependencies** (deps:, dependency updates)
4. Include PR numbers and links
5. Add issue references (Fixes #123)
6. **Save changelog locally:**
   ```bash
   # Save to dated file for history
   echo "$CHANGELOG" > release-notes-${NEW_VERSION}-$(date +%Y%m%d).md
   
   # Save to current for easy access
   echo "$CHANGELOG" > CURRENT_RELEASE_NOTES.md
   ```
7. **CHANGELOG REVIEW**: Verify all PRs listed are actually on main branch

### Step 8: Create Enhanced Release Notes

1. Create comprehensive user-facing release notes including:
   - **What's New**: Major features and improvements
   - **Bug Fixes**: User-visible fixes
   - **Breaking Changes**: Migration guide if applicable
   - **Dependencies**: Major dependency updates
   - **Performance**: Notable performance improvements
   - **Contributors**: Thank contributors for their work
2. Reference related documentation updates
3. Include screenshots for UI changes (if available)
4. **Save release notes:**
   ```bash
   # Enhanced release notes for GitHub
   echo "$RELEASE_NOTES" > github-release-notes-${NEW_VERSION}.md
   ```
5. **CONTENT REVIEW**: Release notes clear and helpful for users?

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
     --body-file enhanced-pr-description.md \
     --label "Release"
   ```
3. **Create enhanced PR description:**
   ```bash
   cat > enhanced-pr-description.md << EOF
   # Release v${NEW_VERSION}

   ## Version Change
   \`${CURRENT_VERSION}\` → \`${NEW_VERSION}\` (${VERSION_TYPE})

   ## Changelog
   ${CHANGELOG}

   ## Breaking Changes
   ${BREAKING_CHANGES}

   ## Testing Performed
   - ✅ Full test suite (unit, component, browser)
   - ✅ TypeScript compilation
   - ✅ Linting checks
   - ✅ Build verification
   - ✅ Security audit

   ## Distribution Channels
   - GitHub Release (with dist.zip)
   - PyPI Package (comfyui-frontend-package)
   - npm Package (@comfyorg/comfyui-frontend-types)

   ## Post-Release Tasks
   - [ ] Verify all distribution channels
   - [ ] Update external documentation
   - [ ] Monitor for issues
   EOF
   ```
4. Update PR with enhanced description:
   ```bash
   gh pr edit ${PR_NUMBER} --body-file enhanced-pr-description.md
   ```
5. Add changelog as comment for easy reference:
   ```bash
   gh pr comment ${PR_NUMBER} --body-file CURRENT_RELEASE_NOTES.md
   ```
6. **PR REVIEW**: Version bump PR created and enhanced correctly?

### Step 11: Critical Release PR Verification

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

### Step 12: Pre-Merge Validation

1. **Review Requirements**: Release PRs require approval
2. Monitor CI checks - watch for update-locales
3. **CRITICAL WARNING**: If update-locales adds [skip ci], the release workflow won't trigger!
4. Check no new commits to main since PR creation
5. **DEPLOYMENT READINESS**: Ready to merge?

### Step 13: Execute Release

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

### Step 14: Enhance GitHub Release

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
   # Update release with our enhanced notes
   gh release edit v${NEW_VERSION} \
     --title "🚀 ComfyUI Frontend v${NEW_VERSION}" \
     --notes-file github-release-notes-${NEW_VERSION}.md \
     --latest
   
   # Add any additional assets if needed
   # gh release upload v${NEW_VERSION} additional-assets.zip
   ```

3. **Verify release details:**
   ```bash
   gh release view v${NEW_VERSION}
   ```

### Step 15: Verify Multi-Channel Distribution

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

### Step 16: Post-Release Monitoring Setup

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
   - \`release-notes-${NEW_VERSION}-$(date +%Y%m%d).md\` - Detailed changelog
   - \`github-release-notes-${NEW_VERSION}.md\` - GitHub release notes
   - \`post-release-checklist.md\` - Follow-up tasks
   EOF
   ```

4. **RELEASE COMPLETION**: All post-release setup completed?

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
2. **🧪 Quality Gate**: Full test suite, linting, type checking
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

## Common Issues and Solutions

### Issue: Pre-release Version Confusion
**Problem**: Not sure whether to promote pre-release or create new version
**Solution**: 
- Follow semver standards: a prerelease version is followed by a normal release.  It should have the same major, minor, and patch versions as the prerelease.

### Issue: Wrong Commit Count
**Problem**: Changelog includes commits from other branches
**Solution**: Always use `--first-parent` flag with git log

**Update**: Sometimes update-locales doesn't add [skip ci] - always verify!

### Issue: Missing PRs in Changelog
**Problem**: PR was merged to different branch
**Solution**: Verify PR merge target with:
```bash
gh pr view ${PR_NUMBER} --json baseRefName
```

### Issue: Release Failed Due to [skip ci]
**Problem**: Release workflow didn't trigger after merge
**Prevention**: Always avoid this scenario
- Ensure that `[skip ci]` or similar flags are NOT in the `HEAD` commit message of the PR
  - Push a new, empty commit to the PR
- Always double-check this immediately before merging

**Recovery Strategy**:
1. Revert version in a new PR (e.g., 1.24.0 → 1.24.0-1)
2. Merge the revert PR
3. Run version bump workflow again
4. This creates a fresh PR without [skip ci]
Benefits: Cleaner than creating extra version numbers

## Key Learnings & Notes

1. **PR Author**: Version bump PRs are created by `comfy-pr-bot`, not `github-actions`
2. **Workflow Speed**: Version bump workflow typically completes in ~20-30 seconds
3. **Update-locales Behavior**: Inconsistent - sometimes adds [skip ci], sometimes doesn't
4. **Recovery Options**: Reverting version is cleaner than creating extra versions

