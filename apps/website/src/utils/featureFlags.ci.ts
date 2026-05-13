import { appendFileSync } from 'node:fs'

import type { FetchOutcome } from './featureFlags'

let hasReported = false

export function resetFeatureFlagsReporterForTests(): void {
  hasReported = false
}

export function reportFeatureFlagsOutcome(outcome: FetchOutcome): void {
  if (hasReported) return
  hasReported = true

  const lines = buildAnnotations(outcome)
  for (const line of lines) {
    process.stdout.write(`${line}\n`)
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (summaryPath) {
    try {
      appendFileSync(summaryPath, buildStepSummary(outcome))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(
        `feature-flags reporter: failed to write GITHUB_STEP_SUMMARY: ${message}\n`
      )
    }
  }
}

function buildAnnotations(outcome: FetchOutcome): string[] {
  if (outcome.status === 'fresh') return []

  if (outcome.status === 'stale') {
    return [staleAnnotation(outcome.reason)]
  }

  return [
    `::error title=Feature flags fetch failed and no snapshot is available::Cannot build site without feature flags.%0A%0AReason: ${escapeAnnotation(outcome.reason)}%0A%0AAction items:%0A  1. Run \`pnpm --filter @comfyorg/website feature-flags:refresh-snapshot\` locally.%0A  2. Commit apps/website/src/data/feature-flags.snapshot.json.%0A  3. Push and re-run CI.`
  ]
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

function escapeAnnotation(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}

function buildStepSummary(outcome: FetchOutcome): string {
  const header = '## 🚩 Feature Flags (/features)\n'
  const rows: Array<[string, string]> = []

  if (outcome.status === 'fresh') {
    rows.push(['Status', '✅ Fresh (fetched from /features)'])
    rows.push(['cloudFreeTier', String(outcome.snapshot.flags.cloudFreeTier)])
  } else if (outcome.status === 'stale') {
    rows.push(['Status', '⚠️ Stale (using snapshot — /features fetch failed)'])
    rows.push(['cloudFreeTier', String(outcome.snapshot.flags.cloudFreeTier)])
    rows.push(['Reason', outcome.reason])
    rows.push(['Snapshot age', describeSnapshotAge(outcome.snapshot.fetchedAt)])
  } else {
    rows.push(['Status', '❌ Failed (no snapshot available)'])
    rows.push(['Reason', outcome.reason])
  }

  const table =
    '| | |\n|---|---|\n' +
    rows.map(([k, v]) => `| **${k}** | ${v} |`).join('\n') +
    '\n'

  return `${header}${table}\n`
}

function describeSnapshotAge(fetchedAt: string): string {
  const fetched = new Date(fetchedAt).getTime()
  if (Number.isNaN(fetched)) return 'unknown'
  const days = Math.floor((Date.now() - fetched) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day'
  return `${days} days`
}
