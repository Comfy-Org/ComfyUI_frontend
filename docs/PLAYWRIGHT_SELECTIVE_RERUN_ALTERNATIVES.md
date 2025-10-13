# Playwright Selective Test Rerun Alternatives

This document analyzes alternatives for selectively re-running only failed Playwright tests for snapshot updates, comparing native Playwright features with the current custom manifest approach used in this project.

## Table of Contents
- [Current Approach](#current-approach)
- [Native Playwright Features](#native-playwright-features)
- [Playwright Reporter Options](#playwright-reporter-options)
- [GitHub Actions Integration Patterns](#github-actions-integration-patterns)
- [Third-Party Solutions](#third-party-solutions)
- [Comparison and Recommendations](#comparison-and-recommendations)

---

## Current Approach

### Implementation
The project currently uses a **custom manifest-based approach** that:

1. **Generates a manifest** of failed screenshot tests after CI runs
   - Script: `scripts/cicd/build-failed-screenshot-manifest.ts`
   - Parses JSON report to find tests with failed screenshot assertions
   - Creates per-project text files: `ci-rerun/{project}.txt`
   - Format: `file_path:line_number` (e.g., `browser_tests/menu.test.ts:42`)

2. **Stores manifest as GitHub artifact**
   - Artifact name: `failed-screenshot-tests`
   - Retention: 7 days
   - Only uploaded when chromium sharded tests fail

3. **Downloads manifest in update workflow**
   - Workflow: `.github/workflows/update-playwright-expectations.yaml`
   - Triggered by: PR label "New Browser Test Expectations" or `/update-playwright` comment
   - Falls back to full test suite if manifest not found

4. **Re-runs only failed tests**
   ```bash
   for f in ci-rerun/*.txt; do
     project="$(basename "$f" .txt)"
     mapfile -t lines < "$f"
     # Filter empty lines
     pnpm exec playwright test --project="$project" --update-snapshots "${filtered[@]}"
   done
   ```

### Advantages
- ✅ Works across workflow runs and different trigger mechanisms
- ✅ Survives beyond single workflow execution
- ✅ Precise control over which tests to re-run
- ✅ Supports multiple projects with separate manifests
- ✅ Works with sharded test runs (merged report)
- ✅ Platform-agnostic approach (works on any CI/CD platform)

### Disadvantages
- ❌ Custom implementation requires maintenance
- ❌ Requires parsing JSON report format (could break with Playwright updates)
- ❌ Additional artifact storage needed
- ❌ More complex than native solutions

---

## Native Playwright Features

### 1. `--last-failed` CLI Flag

**Availability:** Playwright v1.44.0+ (May 2024)

#### How It Works
```bash
# First run - execute all tests
npx playwright test

# Second run - only re-run failed tests
npx playwright test --last-failed
```

Playwright maintains a `.last-run.json` file in the `test-results/` directory that tracks failed tests.

#### CLI Examples
```bash
# Run only failed tests from last run
npx playwright test --last-failed

# Update snapshots for only failed tests
npx playwright test --last-failed --update-snapshots

# Combine with project filtering
npx playwright test --last-failed --project=chromium

# Debug failed tests
npx playwright test --last-failed --debug
```

#### File Location and Format
- **Location:** `test-results/.last-run.json`
- **Format:** JSON object containing failed test information
- **Structure:** Contains a `failedTests: []` array with test identifiers
- **Persistence:** Cleared when all tests pass on subsequent run

#### Advantages
- ✅ Built into Playwright (no custom code)
- ✅ Simple CLI flag
- ✅ Automatically maintained by Playwright
- ✅ Works with all Playwright features (debug, UI mode, etc.)

#### Limitations
- ❌ **Not designed for CI/CD distributed testing** (per Playwright maintainers)
- ❌ **Intended for local development only** ("inner loop scenario")
- ❌ Cleared on new test runs (doesn't persist across clean environments)
- ❌ **GitHub Actions starts with clean environment** - `.last-run.json` not available on retry
- ❌ **Doesn't work with sharded tests** - each shard creates its own `.last-run.json`
- ❌ No native way to merge `.last-run.json` across shards
- ❌ Not designed for cross-workflow persistence

#### CI/CD Workaround (Not Recommended)
To use `--last-failed` in GitHub Actions, you would need to:

```yaml
- name: Run Playwright tests
  id: playwright-test
  run: npx playwright test

- name: Upload last run state
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: last-run-state
    path: test-results/.last-run.json

# In retry workflow:
- name: Download last run state
  uses: actions/download-artifact@v4
  with:
    name: last-run-state
    path: test-results/

- name: Rerun failed tests
  run: npx playwright test --last-failed --update-snapshots
```

**Why This Isn't Ideal:**
- Playwright maintainers explicitly state this is not the intended use case
- Doesn't work well with sharded tests (multiple `.last-run.json` files)
- Requires manual artifact management
- More complex than the current custom approach for this use case

### 2. File:Line Syntax for Specific Tests

Playwright supports running tests at specific line numbers:

```bash
# Run a specific test at line 42
npx playwright test tests/example.spec.ts:42

# Multiple tests
npx playwright test tests/file1.spec.ts:10 tests/file2.spec.ts:25

# With snapshot updates
npx playwright test tests/example.spec.ts:42 --update-snapshots

# With project selection
npx playwright test --project=chromium tests/example.spec.ts:42
```

This is **exactly the format** the current custom manifest uses, making it compatible with Playwright's native CLI.

### 3. Test Filtering Options

```bash
# Filter by grep pattern
npx playwright test -g "screenshot"

# Inverse grep
npx playwright test --grep-invert "mobile"

# By project
npx playwright test --project=chromium

# Multiple projects
npx playwright test --project=chromium --project=firefox

# Specific directory
npx playwright test tests/screenshots/
```

---

## Playwright Reporter Options

### 1. JSON Reporter

**Purpose:** Machine-readable test results

#### Configuration
```typescript
// playwright.config.ts
export default defineConfig({
  reporter: [
    ['json', { outputFile: 'results.json' }]
  ]
})
```

Or via environment variable:
```bash
PLAYWRIGHT_JSON_OUTPUT_NAME=results.json npx playwright test --reporter=json
```

#### Output Structure
```json
{
  "stats": {
    "expected": 100,
    "unexpected": 5,
    "flaky": 2,
    "skipped": 3
  },
  "suites": [
    {
      "title": "Test Suite",
      "specs": [
        {
          "file": "browser_tests/example.test.ts",
          "line": 42,
          "tests": [
            {
              "projectId": "chromium",
              "results": [
                {
                  "status": "failed",
                  "attachments": [
                    { "contentType": "image/png" }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

**This is the format** the current `build-failed-screenshot-manifest.ts` script parses.

#### Advantages
- ✅ Stable, documented JSON schema (`@playwright/test/reporter`)
- ✅ Includes all test metadata (file, line, project, status, attachments)
- ✅ Can be used programmatically
- ✅ Supports multiple reporters simultaneously

#### Current Project Usage
```yaml
# In tests-ci.yaml
PLAYWRIGHT_JSON_OUTPUT_NAME=playwright-report/report.json \
pnpm exec playwright test --project=${{ matrix.browser }} \
  --reporter=list \
  --reporter=html \
  --reporter=json
```

### 2. Blob Reporter

**Purpose:** Merging sharded test reports

#### Configuration
```typescript
// playwright.config.ts
export default defineConfig({
  reporter: process.env.CI ? 'blob' : 'html'
})
```

#### Usage with Sharding
```bash
# Run sharded test with blob output
npx playwright test --shard=1/4 --reporter=blob

# Merge blob reports
npx playwright merge-reports --reporter=html ./all-blob-reports
npx playwright merge-reports --reporter=json ./all-blob-reports
```

#### Current Project Usage
```yaml
# Sharded chromium tests
- run: pnpm exec playwright test --project=chromium --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }} --reporter=blob
  env:
    PLAYWRIGHT_BLOB_OUTPUT_DIR: ../blob-report

# Merge reports job
- run: |
    pnpm exec playwright merge-reports --reporter=html ./all-blob-reports
    PLAYWRIGHT_JSON_OUTPUT_NAME=playwright-report/report.json \
    pnpm exec playwright merge-reports --reporter=json ./all-blob-reports
```

#### Advantages
- ✅ Designed for distributed testing
- ✅ Can merge into any reporter format (HTML, JSON, etc.)
- ✅ Preserves all test information across shards

#### Blob Reporter and `--last-failed`
- ❌ Blob reports **do not contain** a merged `.last-run.json`
- ❌ Each shard creates its own `.last-run.json` that isn't included in blob
- ❌ GitHub issue [#30924](https://github.com/microsoft/playwright/issues/30924) requests this feature (currently unsupported)

### 3. Multiple Reporters

You can use multiple reporters simultaneously:

```typescript
export default defineConfig({
  reporter: [
    ['list'],           // Terminal output
    ['html'],           // Browse results
    ['json', { outputFile: 'results.json' }],  // Programmatic parsing
    ['junit', { outputFile: 'results.xml' }]   // CI integration
  ]
})
```

Or via CLI:
```bash
npx playwright test --reporter=list --reporter=html --reporter=json
```

---

## GitHub Actions Integration Patterns

### Pattern 1: Comment-Triggered Workflow (JupyterLab Approach)

**Example:** [jupyterlab/jupyterlab-git](https://github.com/jupyterlab/jupyterlab-git/blob/main/.github/workflows/update-integration-tests.yml)

```yaml
name: Update Playwright Snapshots

on:
  issue_comment:
    types: [created, edited]

permissions:
  contents: write
  pull-requests: write

jobs:
  update-snapshots:
    # Only run for authorized users on PRs with specific comment
    if: >
      (github.event.issue.author_association == 'OWNER' ||
       github.event.issue.author_association == 'COLLABORATOR' ||
       github.event.issue.author_association == 'MEMBER'
      ) && github.event.issue.pull_request &&
      contains(github.event.comment.body, 'please update snapshots')
    runs-on: ubuntu-latest

    steps:
    - name: React to the triggering comment
      run: gh api repos/${{ github.repository }}/issues/comments/${{ github.event.comment.id }}/reactions --raw-field 'content=+1'
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    - name: Checkout
      uses: actions/checkout@v4
      with:
        token: ${{ secrets.GITHUB_TOKEN }}

    - name: Checkout PR branch
      run: gh pr checkout ${{ github.event.issue.number }}
      env:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    - name: Setup and run tests
      run: |
        npm ci
        npx playwright install --with-deps
        npx playwright test --update-snapshots

    - name: Commit and push
      run: |
        git config user.name 'github-actions'
        git config user.email 'github-actions@github.com'
        git add .
        git diff --cached --quiet || git commit -m "Update snapshots"
        git push
```

#### Advantages
- ✅ Simple comment-based trigger
- ✅ Visual feedback (reaction on comment)
- ✅ Authorization checks built-in
- ✅ Auto-commits to PR branch

#### Limitations
- ❌ Runs **all** tests with `--update-snapshots` (not selective)
- ❌ No integration with failed test information from CI

### Pattern 2: Label-Based Trigger + Manifest (Current Approach)

```yaml
name: Update Playwright Expectations

on:
  pull_request:
    types: [labeled]
  issue_comment:
    types: [created]

jobs:
  test:
    if: >
      ( github.event_name == 'pull_request' &&
        github.event.label.name == 'New Browser Test Expectations' ) ||
      ( github.event.issue.pull_request &&
        startsWith(github.event.comment.body, '/update-playwright') )

    steps:
      # ... setup steps ...

      - name: Locate failed screenshot manifest artifact
        id: locate-manifest
        uses: actions/github-script@v8
        with:
          script: |
            const { owner, repo } = context.repo
            let headSha = ''
            if (context.eventName === 'pull_request') {
              headSha = context.payload.pull_request.head.sha
            } else if (context.eventName === 'issue_comment') {
              const prNumber = context.payload.issue.number
              const pr = await github.rest.pulls.get({ owner, repo, pull_number: prNumber })
              headSha = pr.data.head.sha
            }

            const { data } = await github.rest.actions.listWorkflowRuns({
              owner, repo,
              workflow_id: 'tests-ci.yaml',
              head_sha: headSha,
              per_page: 1,
            })
            const run = data.workflow_runs?.[0]

            let has = 'false'
            if (run) {
              const { data: { artifacts = [] } } = await github.rest.actions.listWorkflowRunArtifacts({
                owner, repo, run_id: run.id
              })
              if (artifacts.some(a => a.name === 'failed-screenshot-tests' && !a.expired))
                has = 'true'
            }
            core.setOutput('has_manifest', has)

      - name: Download failed screenshot manifest
        if: steps.locate-manifest.outputs.has_manifest == 'true'
        uses: actions/download-artifact@v4
        with:
          run-id: ${{ steps.locate-manifest.outputs.run_id }}
          name: failed-screenshot-tests
          path: ComfyUI_frontend/ci-rerun

      - name: Re-run failed screenshot tests
        run: |
          if [ ! -d ci-rerun ]; then
            echo "No manifest found; running full suite"
            pnpm exec playwright test --update-snapshots
            exit 0
          fi

          for f in ci-rerun/*.txt; do
            project="$(basename "$f" .txt)"
            mapfile -t lines < "$f"
            filtered=()
            for l in "${lines[@]}"; do
              [ -n "$l" ] && filtered+=("$l")
            done

            if [ ${#filtered[@]} -gt 0 ]; then
              echo "Re-running ${#filtered[@]} tests for project $project"
              pnpm exec playwright test --project="$project" --update-snapshots "${filtered[@]}"
            fi
          done
```

#### Advantages
- ✅ **Selective** - only re-runs failed screenshot tests
- ✅ Works across different trigger mechanisms (label or comment)
- ✅ Fallback to full suite if manifest not found
- ✅ Per-project manifests support multiple browser configurations
- ✅ Handles sharded tests via merged report

### Pattern 3: WordPress/Openverse Approach (Always Update)

Proposed pattern (not fully implemented):
1. CI always runs with `--update-snapshots` flag
2. If snapshots change, create/update a secondary branch
3. Open PR targeting the original PR branch
4. Developer reviews snapshot changes before merging

#### Advantages
- ✅ Always generates correct snapshots
- ✅ Snapshot changes are visible in separate PR
- ✅ No test failures due to mismatched snapshots

#### Limitations
- ❌ Creates multiple PRs
- ❌ More complex merge workflow
- ❌ Potential for snapshot changes to mask real issues

### Pattern 4: Manual Workflow Dispatch

```yaml
name: Update Snapshots

on:
  workflow_dispatch:
    inputs:
      update-snapshots:
        description: 'Update snapshots'
        type: boolean
        default: false
      test-pattern:
        description: 'Test pattern (optional)'
        type: string
        required: false

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup
        run: |
          npm ci
          npx playwright install --with-deps

      - name: Run tests
        run: |
          if [ "${{ inputs.update-snapshots }}" = "true" ]; then
            FLAGS="--update-snapshots"
          fi

          PATTERN="${{ inputs.test-pattern }}"
          npx playwright test ${PATTERN} ${FLAGS}
```

#### Advantages
- ✅ Full manual control
- ✅ Can specify test patterns
- ✅ Simple to understand

#### Limitations
- ❌ Requires manual triggering
- ❌ Not integrated with CI failures

---

## Third-Party Solutions

### Currents.dev - Last Failed GitHub Action

**Repository:** [currents-dev/playwright-last-failed](https://github.com/currents-dev/playwright-last-failed)

#### Purpose
Helps run last failed Playwright tests using Currents' cloud-based caching service.

#### Usage
```yaml
- name: Playwright Last Failed action
  id: last-failed-action
  uses: currents-dev/playwright-last-failed@v1
  with:
    pw-output-dir: test-results
    matrix-index: ${{ matrix.shard }}
    matrix-total: ${{ strategy.job-total }}
```

#### How It Works
- Uses Currents' cloud service to persist failed test information
- Supports sharded tests via matrix parameters
- Enables selective rerun of failed tests across workflow retries

#### Advantages
- ✅ Works with sharded tests
- ✅ Persists across workflow runs
- ✅ Supports GitHub Actions retry mechanism
- ✅ Handles distributed testing

#### Limitations
- ❌ **Requires Currents subscription** (third-party paid service)
- ❌ Dependency on external service
- ❌ Data sent to third-party cloud
- ❌ Additional cost
- ❌ Vendor lock-in

#### Recommendation
**Not suitable for this project** due to:
- External service dependency
- Cost implications
- The current custom solution is already working well

---

## Comparison and Recommendations

### Feature Matrix

| Feature | Current Approach | `--last-failed` | Currents | Comment Trigger Only |
|---------|-----------------|-----------------|----------|---------------------|
| Works with sharded tests | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| Persists across workflows | ✅ Yes | ❌ No | ✅ Yes | N/A |
| Selective reruns | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No (runs all) |
| No external dependencies | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| Simple implementation | ⚠️ Medium | ✅ Simple | ✅ Simple | ✅ Simple |
| Maintenance overhead | ⚠️ Medium | ✅ Low | ✅ Low | ✅ Low |
| Works in CI/CD | ✅ Yes | ⚠️ Workaround | ✅ Yes | ✅ Yes |
| Cost | ✅ Free | ✅ Free | ❌ Paid | ✅ Free |
| Supports multiple projects | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

### Why `--last-failed` Isn't Suitable (Currently)

1. **Not designed for CI/CD:** Playwright maintainers explicitly state it's for "inner loop scenario (local development)"
2. **Doesn't work with sharded tests:** Each shard creates its own `.last-run.json` with no native merge
3. **Clean environment issue:** GitHub Actions starts fresh, losing `.last-run.json`
4. **Feature request pending:** GitHub issue [#30924](https://github.com/microsoft/playwright/issues/30924) requests blob report integration (not yet implemented)

### Recommendations

#### Short Term: Keep Current Approach
**Verdict: The current custom manifest approach is the best solution for this project's needs.**

**Reasons:**
1. ✅ **Works perfectly with sharded tests** - merges results across 8 shards
2. ✅ **Persists across workflows** - artifact storage for 7 days
3. ✅ **Selective reruns** - only failed screenshot tests
4. ✅ **No external dependencies** - fully self-contained
5. ✅ **Uses stable Playwright JSON format** - typed via `@playwright/test/reporter`
6. ✅ **Already working well** - proven in production

**Minor Improvements:**
```typescript
// Add version check to warn if JSON schema changes
import { version } from '@playwright/test/package.json'
if (major(version) !== 1) {
  console.warn('Playwright major version changed - verify JSON schema compatibility')
}

// Add more robust error handling
try {
  const report: JSONReport = JSON.parse(raw)
} catch (error) {
  throw new Error(`Failed to parse Playwright JSON report: ${error.message}`)
}

// Consider adding tests for the manifest builder
// e.g., tests/cicd/build-failed-screenshot-manifest.test.ts
```

#### Long Term: Monitor Playwright Development

**Watch for these features:**
1. **Blob report + `.last-run.json` merge** - GitHub issue [#30924](https://github.com/microsoft/playwright/issues/30924)
2. **Native CI/CD support for `--last-failed`** - may never happen (by design)
3. **Report merging improvements** - GitHub issue [#33094](https://github.com/microsoft/playwright/issues/33094)

**Migration path if native support improves:**
```yaml
# Future potential approach (if Playwright adds this feature)
- name: Merge reports with last-run
  run: |
    npx playwright merge-reports --reporter=html ./all-blob-reports
    npx playwright merge-reports --reporter=last-failed ./all-blob-reports

- name: Upload merged last-run
  uses: actions/upload-artifact@v4
  with:
    name: last-run-state
    path: test-results/.last-run.json

# In update workflow
- name: Download last-run state
  uses: actions/download-artifact@v4
  with:
    name: last-run-state
    path: test-results/

- name: Update snapshots for failed tests
  run: npx playwright test --last-failed --update-snapshots
```

**However, this is speculative** - Playwright maintainers have indicated `--last-failed` is not intended for CI/CD.

#### Alternative: Simplify to Full Suite Reruns

If the custom manifest becomes too complex to maintain, consider:

```yaml
- name: Re-run ALL screenshot tests
  run: |
    # Simple grep-based filtering for screenshot tests
    npx playwright test -g "screenshot" --update-snapshots
```

**Trade-offs:**
- ✅ Much simpler
- ✅ No custom scripts
- ❌ Slower (runs all screenshot tests, not just failed ones)
- ❌ Potentially updates snapshots that weren't actually failing

---

## Conclusion

The current custom manifest approach is **well-designed** and **appropriate** for this project's requirements:

1. **Handles sharded tests** - critical for CI performance
2. **Selective reruns** - saves time and resources
3. **Stable implementation** - uses documented Playwright JSON schema
4. **No external dependencies** - fully controlled

While `--last-failed` is a nice feature for **local development**, Playwright's own documentation and maintainer comments confirm it's **not suitable for distributed CI/CD testing**, which is exactly what this project needs.

The only potentially better solution (Currents) requires a paid external service, which adds cost and complexity without significant benefits over the current approach.

**Recommendation: Keep the current implementation**, with minor improvements to error handling and documentation. Monitor Playwright development for native improvements, but don't expect `--last-failed` to become a viable alternative for this use case.

---

## References

### Official Playwright Documentation
- [Command Line](https://playwright.dev/docs/test-cli)
- [Reporters](https://playwright.dev/docs/test-reporters)
- [Test Sharding](https://playwright.dev/docs/test-sharding)
- [CI/CD Setup](https://playwright.dev/docs/ci-intro)

### Community Resources
- [Playwright Solutions: How to Run Failures Only](https://playwrightsolutions.com/how-to-run-failures-only-from-the-last-playwright-run/)
- [Medium: How to Run Only Last Failed Tests](https://medium.com/@testerstalk/how-to-run-only-last-failed-tests-in-playwright-e5e41472594a)
- [Medium: Streamlining Visual Regression Testing](https://medium.com/@haleywardo/streamlining-playwright-visual-regression-testing-with-github-actions-e077fd33c27c)

### GitHub Issues
- [#30924 - Last-failed with blob reports](https://github.com/microsoft/playwright/issues/30924)
- [#33094 - Merging main run with --last-failed](https://github.com/microsoft/playwright/issues/33094)
- [#28254 - Feature request for --last-failed](https://github.com/microsoft/playwright/issues/28254)

### Example Implementations
- [JupyterLab Git - Update Integration Tests](https://github.com/jupyterlab/jupyterlab-git/blob/main/.github/workflows/update-integration-tests.yml)
- [WordPress Openverse - Discussion #4535](https://github.com/WordPress/openverse/issues/4535)

### Third-Party Tools
- [Currents - Playwright Last Failed Action](https://github.com/currents-dev/playwright-last-failed)
- [Currents - Re-run Only Failed Tests](https://docs.currents.dev/guides/re-run-only-failed-tests)
