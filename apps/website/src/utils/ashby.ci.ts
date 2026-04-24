import { appendFileSync } from 'node:fs'

import type { FetchOutcome } from './ashby'

let hasReported = false

export function resetAshbyReporterForTests(): void {
  hasReported = false
}

export function reportAshbyOutcome(outcome: FetchOutcome): void {
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
    } catch {
      // Writing the summary is best-effort; do not fail the build if the
      // runner's summary file is unavailable (e.g. local dev).
    }
  }
}

function buildAnnotations(outcome: FetchOutcome): string[] {
  if (outcome.status === 'fresh') {
    if (outcome.droppedCount === 0) return []
    const roleCount = outcome.droppedCount === 1 ? 'role' : 'roles'
    const drops = outcome.droppedRoles
      .map((d) => `  - ${d.title ? `"${d.title}"` : '(untitled)'}: ${d.reason}`)
      .join('%0A')
    return [
      `::warning title=Ashby: dropped ${outcome.droppedCount} invalid ${roleCount}::Dropped roles:%0A${drops}%0A%0AAction items:%0A  1. Fix the posting in Ashby admin (e.g. assign a department, fix the URL).%0A  2. If the v1 schema is too strict for a legitimate case, relax the field in apps/website/src/utils/ashby.schema.ts and add a test.%0A  3. These roles will not appear on the careers page until fixed.`
    ]
  }

  if (outcome.status === 'stale') {
    return [staleAnnotation(outcome.reason)]
  }

  return [
    `::error title=Ashby fetch failed and no snapshot is available::Cannot build careers page without data.%0A%0AReason: ${escapeAnnotation(outcome.reason)}%0A%0AAction items:%0A  1. Run \`pnpm --filter @comfyorg/website ashby:refresh-snapshot\` locally with a valid WEBSITE_ASHBY_API_KEY.%0A  2. Commit apps/website/src/data/ashby-roles.snapshot.json.%0A  3. Push and re-run CI.`
  ]
}

function staleAnnotation(reason: string): string {
  const escaped = escapeAnnotation(reason)
  if (reason.startsWith('missing ')) {
    return `::warning title=Ashby integration::${escaped}. Falling back to committed snapshot.%0A%0AAction items:%0A  1. If you're a contributor without key access, this is expected. The snapshot will be used.%0A  2. If this is CI, check that the \`WEBSITE_ASHBY_API_KEY\` secret exists in the repo and is referenced in .github/workflows/ci-website-build.yaml.`
  }
  if (reason.startsWith('HTTP 401') || reason.startsWith('HTTP 403')) {
    return `::error title=Ashby authentication failed::${escaped}. The WEBSITE_ASHBY_API_KEY is missing, invalid, or revoked. Build continues with the last-known-good snapshot.%0A%0AAction items:%0A  1. Open Ashby → Settings → API Keys and confirm the key is active.%0A  2. Update the \`WEBSITE_ASHBY_API_KEY\` secret in GitHub Actions and Vercel.%0A  3. Re-run this workflow.`
  }
  if (reason.startsWith('envelope')) {
    return `::error title=Ashby schema mismatch::${escaped}. The Ashby API contract has likely changed. Build continues with the snapshot, but future updates will fail until the schema is fixed.%0A%0AAction items:%0A  1. Check https://developers.ashbyhq.com/reference for API changelog.%0A  2. Update apps/website/src/utils/ashby.schema.ts to match the new shape.`
  }
  return `::warning title=Ashby API unavailable::${escaped}. Using last-known-good snapshot.%0A%0AAction items:%0A  1. Check https://status.ashbyhq.com%0A  2. Re-run this workflow once Ashby is healthy.`
}

function escapeAnnotation(value: string): string {
  return value.replace(/\r?\n/g, '%0A').replace(/\r/g, '%0D')
}

function buildStepSummary(outcome: FetchOutcome): string {
  const header = '## 💼 Careers (Ashby)\n'
  const rows: Array<[string, string]> = []

  if (outcome.status === 'fresh') {
    rows.push(['Status', '✅ Fresh (fetched from Ashby)'])
    rows.push([
      'Roles',
      String(
        outcome.snapshot.departments.reduce((n, d) => n + d.roles.length, 0)
      )
    ])
    rows.push(['Dropped', String(outcome.droppedCount)])
  } else if (outcome.status === 'stale') {
    rows.push(['Status', '⚠️ Stale (using snapshot — Ashby fetch failed)'])
    rows.push([
      'Roles',
      String(
        outcome.snapshot.departments.reduce((n, d) => n + d.roles.length, 0)
      )
    ])
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
