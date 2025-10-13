# Snapshot Update from Actual Files (Fast Approach)

**Date:** 2025-10-08
**Status:** Proposed Optimization

## Overview

When Playwright snapshot tests fail, Playwright **already generates the new ("actual") snapshots**. Instead of re-running tests with `--update-snapshots`, we can extract these actual snapshots from the `test-results/` directory and copy them to overwrite the expected snapshots.

**Performance improvement:** ~1-2 minutes → **~10-30 seconds**

## How Playwright Stores Snapshots

### Expected (Baseline) Snapshots

Stored in: `<test-file>-snapshots/<snapshot-name>-<project>-<platform>.png`

**Example:**
```
browser_tests/tests/interaction.spec.ts-snapshots/default-chromium-linux.png
```

### Failed Test Artifacts

When a snapshot test fails, Playwright creates:

```
test-results/<test-hash>/
  ├── <snapshot-name>-actual.png      # The NEW screenshot
  ├── <snapshot-name>-expected.png    # Copy of baseline
  └── <snapshot-name>-diff.png        # Visual diff
```

**Example:**
```
test-results/interaction-default-chromium-67af3c/
  ├── default-1-actual.png
  ├── default-1-expected.png
  └── default-1-diff.png
```

## Current Approach vs. Proposed Approach

### Current: Re-run Tests with `--update-snapshots`

```yaml
# Current workflow (.github/workflows/update-playwright-expectations.yaml)
- name: Re-run failed screenshot tests and update snapshots
  run: |
    # Download manifest of failed tests
    # For each project: chromium, chromium-2x, etc.
      # Run: playwright test --project="$project" --update-snapshots test1.spec.ts:42 test2.spec.ts:87 ...
```

**Time:** ~2-5 minutes (depends on # of failed tests)

**Why slow:**
- Re-executes tests (browser startup, navigation, interactions)
- Waits for elements, animations, etc.
- Generates HTML report
- Each test takes 5-15 seconds

### Proposed: Copy Actual → Expected

```yaml
# Proposed workflow
- name: Download test artifacts (includes test-results/)
- name: Copy actual snapshots to expected locations
  run: pnpm tsx scripts/cicd/update-snapshots-from-actuals.ts
- name: Commit and push
```

**Time:** ~10-30 seconds (just file operations)

**Why fast:**
- No test execution
- No browser startup
- Just file copying
- Parallel file operations

## Implementation Plan

### Step 1: Modify tests-ci.yaml

Currently, test artifacts upload only the `playwright-report/` directory.

**Add test-results/ to artifacts:**

```yaml
# .github/workflows/tests-ci.yaml
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: playwright-results-${{ matrix.browser }}  # New artifact
    path: |
      ComfyUI_frontend/test-results/**/*-actual.png
      ComfyUI_frontend/test-results/**/*-expected.png
      ComfyUI_frontend/test-results/**/*-diff.png
    retention-days: 7
```

**Optimization:** Only upload actual snapshots for failed tests (saves artifact storage)

### Step 2: Create Script to Map Actuals → Expected

**File:** `scripts/cicd/update-snapshots-from-actuals.ts`

```typescript
import type { JSONReport, JSONReportTestResult } from '@playwright/test/reporter'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

interface SnapshotMapping {
  actualPath: string      // test-results/.../snapshot-1-actual.png
  expectedPath: string    // browser_tests/tests/foo.spec.ts-snapshots/snapshot-chromium-linux.png
  testFile: string
  testName: string
  project: string
}

async function main() {
  const reportPath = path.join('playwright-report', 'report.json')

  if (!fs.existsSync(reportPath)) {
    console.log('No report.json found - no failed tests to update')
    return
  }

  const raw = await fsp.readFile(reportPath, 'utf8')
  const report: JSONReport = JSON.parse(raw)

  const mappings: SnapshotMapping[] = []

  // Parse JSON report to extract snapshot paths
  function collectFailedSnapshots(suite: any) {
    if (!suite) return

    for (const childSuite of suite.suites ?? []) {
      collectFailedSnapshots(childSuite)
    }

    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        const lastResult = test.results[test.results.length - 1]

        if (lastResult?.status !== 'failed') continue

        // Check if test has image attachments (indicates screenshot test)
        const imageAttachments = lastResult.attachments.filter(
          (att: any) => att?.contentType?.startsWith('image/')
        )

        if (imageAttachments.length === 0) continue

        // Extract snapshot mapping from attachments
        for (const attachment of imageAttachments) {
          const attachmentPath = attachment.path

          if (!attachmentPath || !attachmentPath.includes('-actual.png')) {
            continue
          }

          // Parse test-results path to determine expected location
          // test-results/interaction-default-chromium-67af3c/default-1-actual.png
          // → browser_tests/tests/interaction.spec.ts-snapshots/default-chromium-linux.png

          const actualPath = attachmentPath
          const expectedPath = inferExpectedPath(actualPath, spec.file, test.projectId)

          if (expectedPath) {
            mappings.push({
              actualPath,
              expectedPath,
              testFile: spec.file,
              testName: test.annotations[0]?.description || test.title,
              project: test.projectId
            })
          }
        }
      }
    }
  }

  collectFailedSnapshots(report)

  if (mappings.length === 0) {
    console.log('No failed snapshot tests found')
    return
  }

  console.log(`Found ${mappings.length} snapshots to update`)

  // Copy actual → expected
  let successCount = 0
  let errorCount = 0

  for (const mapping of mappings) {
    try {
      if (!fs.existsSync(mapping.actualPath)) {
        console.warn(`⚠️  Actual file not found: ${mapping.actualPath}`)
        errorCount++
        continue
      }

      // Ensure expected directory exists
      const expectedDir = path.dirname(mapping.expectedPath)
      await fsp.mkdir(expectedDir, { recursive: true })

      // Copy actual → expected
      await fsp.copyFile(mapping.actualPath, mapping.expectedPath)

      console.log(`✓ Updated: ${path.basename(mapping.expectedPath)}`)
      successCount++
    } catch (error) {
      console.error(`✗ Failed to update ${mapping.expectedPath}:`, error)
      errorCount++
    }
  }

  console.log(`\n✅ Successfully updated ${successCount} snapshots`)
  if (errorCount > 0) {
    console.log(`⚠️  Failed to update ${errorCount} snapshots`)
    process.exit(1)
  }
}

/**
 * Infer the expected snapshot path from the actual path
 *
 * Actual: test-results/interaction-default-chromium-67af3c/default-1-actual.png
 * Expected: browser_tests/tests/interaction.spec.ts-snapshots/default-chromium-linux.png
 */
function inferExpectedPath(actualPath: string, testFile: string, projectId: string): string | null {
  try {
    // Extract snapshot name from actual path
    // "default-1-actual.png" → "default"
    const actualFilename = path.basename(actualPath)
    const snapshotName = actualFilename.replace(/-\d+-actual\.png$/, '')

    // Determine platform (linux, darwin, win32)
    const platform = process.platform === 'linux' ? 'linux'
                   : process.platform === 'darwin' ? 'darwin'
                   : 'win32'

    // Build expected path
    const testDir = path.dirname(testFile)
    const testBasename = path.basename(testFile)
    const snapshotsDir = path.join(testDir, `${testBasename}-snapshots`)
    const expectedFilename = `${snapshotName}-${projectId}-${platform}.png`

    return path.join(snapshotsDir, expectedFilename)
  } catch (error) {
    console.error(`Failed to infer expected path for ${actualPath}:`, error)
    return null
  }
}

main().catch((err) => {
  console.error('Failed to update snapshots:', err)
  process.exit(1)
})
```

### Step 3: Better Approach - Use Playwright's Attachment Metadata

The JSON reporter actually includes the **expected snapshot path** in the attachments!

**Simplified script:**

```typescript
async function main() {
  const report: JSONReport = JSON.parse(await fsp.readFile('playwright-report/report.json', 'utf8'))

  const updates: Array<{ actual: string; expected: string }> = []

  for (const result of getAllTestResults(report)) {
    if (result.status !== 'failed') continue

    for (const attachment of result.attachments) {
      // Playwright includes both actual and expected in attachments
      if (attachment.name?.includes('-actual') && attachment.path) {
        const actualPath = attachment.path

        // Find corresponding expected attachment
        const expectedAttachment = result.attachments.find(
          att => att.name === attachment.name.replace('-actual', '-expected')
        )

        if (expectedAttachment?.path) {
          // The expected path in attachment points to the test-results copy
          // But we can infer the real expected path from the attachment metadata
          const expectedPath = inferRealExpectedPath(expectedAttachment)
          updates.push({ actual: actualPath, expected: expectedPath })
        }
      }
    }
  }

  // Copy files
  for (const { actual, expected } of updates) {
    await fsp.copyFile(actual, expected)
    console.log(`✓ Updated: ${path.relative(process.cwd(), expected)}`)
  }
}
```

### Step 4: Update GitHub Actions Workflow

```yaml
# .github/workflows/update-playwright-expectations.yaml
name: Update Playwright Expectations

on:
  issue_comment:
    types: [created]

jobs:
  update:
    if: |
      github.event.issue.pull_request &&
      contains(github.event.comment.body, '/update-snapshots') &&
      contains(fromJSON('["OWNER", "MEMBER", "COLLABORATOR"]'),
               github.event.comment.author_association)
    runs-on: ubuntu-latest
    steps:
      - name: React to comment
        uses: actions/github-script@v8
        with:
          script: |
            github.rest.reactions.createForIssueComment({
              comment_id: context.payload.comment.id,
              content: '+1'
            })

      - name: Checkout PR
        run: gh pr checkout ${{ github.event.issue.number }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Frontend
        uses: ./.github/actions/setup-frontend

      - name: Get latest failed test run
        id: get-run
        uses: actions/github-script@v8
        with:
          script: |
            const pr = await github.rest.pulls.get({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.payload.issue.number
            })

            const runs = await github.rest.actions.listWorkflowRuns({
              owner: context.repo.owner,
              repo: context.repo.repo,
              workflow_id: 'tests-ci.yaml',
              head_sha: pr.data.head.sha,
              per_page: 1
            })

            core.setOutput('run_id', runs.data.workflow_runs[0]?.id || '')

      - name: Download test results
        uses: actions/download-artifact@v4
        with:
          run-id: ${{ steps.get-run.outputs.run_id }}
          pattern: playwright-results-*
          path: ComfyUI_frontend/test-results
          merge-multiple: true

      - name: Download JSON report
        uses: actions/download-artifact@v4
        with:
          run-id: ${{ steps.get-run.outputs.run_id }}
          pattern: playwright-report-*
          path: ComfyUI_frontend/playwright-report
          merge-multiple: true

      - name: Update snapshots from actuals
        working-directory: ComfyUI_frontend
        run: pnpm tsx scripts/cicd/update-snapshots-from-actuals.ts

      - name: Commit and push
        working-directory: ComfyUI_frontend
        run: |
          git config user.name 'github-actions'
          git config user.email 'github-actions@github.com'
          git add browser_tests/**/*-snapshots/*.png

          if git diff --cached --quiet; then
            echo "No snapshot changes detected"
          else
            git commit -m "[automated] Update test expectations"
            git push
          fi
```

## Performance Comparison

### Current Approach: Re-run Tests

| Step | Time |
|------|------|
| Download manifest | 5s |
| Install Playwright browsers | 20s |
| Re-run 50 failed tests | 2-3 min |
| Generate report | 10s |
| Commit and push | 10s |
| **Total** | **~3-4 min** |

### Proposed Approach: Copy Actuals

| Step | Time |
|------|------|
| Download test-results artifacts | 10s |
| Download JSON report | 2s |
| Run copy script | 5s |
| Commit and push | 10s |
| **Total** | **~30s** |

**Speedup: 6-8x faster** ⚡

## Advantages

✅ **Much faster** - No test re-execution
✅ **Simpler** - No need for manifest generation
✅ **Fewer dependencies** - No Playwright browser install needed
✅ **Less resource usage** - No ComfyUI server, no browser processes
✅ **More reliable** - File operations are deterministic
✅ **Already tested** - The snapshots were generated during the actual test run

## Disadvantages / Edge Cases

❌ **New snapshots** - If a test creates a snapshot for the first time, there's no existing expected file. This is rare and can be handled by fallback to re-running.

❌ **Deleted tests** - Old snapshots won't be cleaned up automatically. Could add a cleanup step.

❌ **Multiple projects** - Each project (chromium, chromium-2x, mobile-chrome) generates separate actuals. The script needs to handle all of them.

❌ **Artifact storage** - Storing test-results/ increases artifact size. Mitigation: Only upload `-actual.png` files, not traces/videos.

## Hybrid Approach (Recommended)

Use the fast copy approach **with fallback**:

```yaml
- name: Update snapshots
  run: |
    # Try fast approach first
    if pnpm tsx scripts/cicd/update-snapshots-from-actuals.ts; then
      echo "✓ Updated snapshots from actuals"
    else
      echo "⚠ Fast update failed, falling back to re-running tests"
      # Fallback to current approach
      pnpm exec playwright test --update-snapshots --project=chromium ...
    fi
```

## Implementation Checklist

- [ ] Create `scripts/cicd/update-snapshots-from-actuals.ts`
- [ ] Update `tests-ci.yaml` to upload `test-results/` artifacts
- [ ] Update `update-playwright-expectations.yaml` to use new script
- [ ] Add fallback logic for edge cases
- [ ] Test with actual PR
- [ ] Update documentation
- [ ] Consider switching from label trigger → comment trigger (`/update-snapshots`)

## Related Links

- **Playwright snapshot docs:** https://playwright.dev/docs/test-snapshots
- **JSON reporter types:** `@playwright/test/reporter`
- **GitHub Actions artifacts:** https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts
- **Issue #22064:** Playwright feature request for better snapshot file alignment

## Conclusion

This approach is **significantly faster** and **simpler** than re-running tests. The main trade-off is artifact storage size, but this can be mitigated by only uploading actual snapshots (not traces/videos).

**Recommendation:** Implement this as the primary approach with fallback to re-running tests for edge cases.
