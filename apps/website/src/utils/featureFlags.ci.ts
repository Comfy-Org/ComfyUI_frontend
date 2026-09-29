import type { FetchOutcome } from './featureFlags'

import {
  describeSnapshotAge,
  escapeAnnotation,
  formatStepSummary,
  writeSnapshotReport
} from './snapshotReporter'

let hasReported = false

export function resetFeatureFlagsReporterForTests(): void {
  hasReported = false
}

export function reportFeatureFlagsOutcome(outcome: FetchOutcome): void {
  if (hasReported) return
  hasReported = true

  writeSnapshotReport({
    annotations: buildAnnotations(outcome),
    summary: buildStepSummary(outcome),
    warningPrefix: 'feature-flags reporter: failed to write GITHUB_STEP_SUMMARY'
  })
}

function buildAnnotations(outcome: FetchOutcome): string[] {
  switch (outcome.status) {
    case 'fresh':
      return []
    case 'stale':
      return [staleAnnotation(outcome.reason)]
    case 'failed':
      return [
        `::error title=Feature flags fetch failed and no snapshot is available::Cannot build site without feature flags.%0A%0AReason: ${escapeAnnotation(outcome.reason)}%0A%0AAction items:%0A  1. Run \`pnpm --filter @comfyorg/website feature-flags:refresh-snapshot\` locally.%0A  2. Commit apps/website/src/data/feature-flags.snapshot.json.%0A  3. Push and re-run CI.`
      ]
  }
}

function staleAnnotation(reason: string): string {
  const escaped = escapeAnnotation(reason)
  if (reason.startsWith('schema')) {
    return `::error title=Feature flags schema mismatch::${escaped}. The /features API contract has likely changed. Build continues with the snapshot, but future updates will fail until the schema is fixed.%0A%0AAction items:%0A  1. Inspect the response at https://api.comfy.org/features.%0A  2. Update apps/website/src/utils/featureFlags.schema.ts to match the new shape.`
  }
  if (reason.startsWith('HTTP 401') || reason.startsWith('HTTP 403')) {
    return `::error title=Feature flags authentication failed::${escaped}. The /features endpoint should be public; check the backend. Build continues with the last-known-good snapshot.`
  }
  return `::warning title=Feature flags API unavailable::${escaped}. Using last-known-good snapshot.%0A%0AAction items:%0A  1. Check the status of https://api.comfy.org/features.%0A  2. Re-run this workflow once the API is healthy.`
}

function buildStepSummary(outcome: FetchOutcome): string {
  const rows: Array<[string, string]> = []
  switch (outcome.status) {
    case 'fresh':
      rows.push(['Status', '✅ Fresh (fetched from /features)'])
      rows.push(['cloudFreeTier', String(outcome.snapshot.flags.cloudFreeTier)])
      break
    case 'stale':
      rows.push([
        'Status',
        '⚠️ Stale (using snapshot — /features fetch failed)'
      ])
      rows.push(['cloudFreeTier', String(outcome.snapshot.flags.cloudFreeTier)])
      rows.push(['Reason', outcome.reason])
      rows.push([
        'Snapshot age',
        describeSnapshotAge(outcome.snapshot.fetchedAt)
      ])
      break
    case 'failed':
      rows.push(['Status', '❌ Failed (no snapshot available)'])
      rows.push(['Reason', outcome.reason])
  }
  return formatStepSummary('## 🚩 Feature Flags (/features)\n', rows)
}
