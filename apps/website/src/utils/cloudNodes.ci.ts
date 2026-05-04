import { appendFileSync } from 'node:fs'

import type { FetchOutcome } from './cloudNodes'

let hasReported = false

export function resetCloudNodesReporterForTests(): void {
  hasReported = false
}

export function reportCloudNodesOutcome(outcome: FetchOutcome): void {
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
    const nodeCount = outcome.droppedCount === 1 ? 'node' : 'nodes'
    const drops = outcome.droppedNodes
      .map((d) => `  - ${d.name ? `"${d.name}"` : '(unnamed)'}: ${d.reason}`)
      .join('%0A')
    return [
      `::warning title=Cloud nodes: dropped ${outcome.droppedCount} invalid ${nodeCount}::Dropped nodes:%0A${drops}%0A%0AAction items:%0A  1. Verify node definitions returned by cloud /api/object_info.%0A  2. If a valid node shape changed, update @comfyorg/object-info-parser/src/schemas/nodeDefSchema.ts and add tests.%0A  3. Dropped nodes are not shown on /cloud/nodes until fixed.`
    ]
  }

  if (outcome.status === 'stale') {
    return [staleAnnotation(outcome.reason)]
  }

  return [
    `::error title=Cloud nodes fetch failed and no snapshot is available::Cannot build cloud nodes page without data.%0A%0AReason: ${escapeAnnotation(outcome.reason)}%0A%0AAction items:%0A  1. Run \`pnpm --filter @comfyorg/website cloud-nodes:refresh-snapshot\` locally with a valid WEBSITE_CLOUD_API_KEY.%0A  2. Commit apps/website/src/data/cloud-nodes.snapshot.json.%0A  3. Push and re-run CI.`
  ]
}

function staleAnnotation(reason: string): string {
  const escaped = escapeAnnotation(reason)
  if (reason.startsWith('missing ')) {
    return `::warning title=Cloud nodes integration::${escaped}. Falling back to committed snapshot.%0A%0AAction items:%0A  1. If you're a contributor without key access, this is expected. The snapshot will be used.%0A  2. If this is CI, check that the \`WEBSITE_CLOUD_API_KEY\` secret exists in the repo and is referenced in .github/workflows/ci-website-build.yaml.`
  }
  if (reason.startsWith('HTTP 401') || reason.startsWith('HTTP 403')) {
    return `::error title=Cloud nodes authentication failed::${escaped}. The WEBSITE_CLOUD_API_KEY is missing, invalid, or revoked. Build continues with the last-known-good snapshot.%0A%0AAction items:%0A  1. Verify the Cloud API key is active and scoped for /api/object_info.%0A  2. Update the \`WEBSITE_CLOUD_API_KEY\` secret in GitHub Actions and Vercel.%0A  3. Re-run this workflow.`
  }
  if (reason.startsWith('envelope')) {
    return `::error title=Cloud nodes schema mismatch::${escaped}. The Cloud API contract likely changed. Build continues with the snapshot, but future updates will fail until schema is fixed.%0A%0AAction items:%0A  1. Check cloud/services/ingest/openapi.yaml for /api/object_info changes.%0A  2. Update apps/website/src/utils/cloudNodes.schema.ts and @comfyorg/object-info-parser schema as needed.`
  }
  return `::warning title=Cloud nodes API unavailable::${escaped}. Using last-known-good snapshot.%0A%0AAction items:%0A  1. Check cloud service health.%0A  2. Re-run this workflow once cloud.comfy.org is healthy.`
}

function escapeAnnotation(value: string): string {
  return value.replace(/\r?\n/g, '%0A').replace(/\r/g, '%0D')
}

function buildStepSummary(outcome: FetchOutcome): string {
  const header = '## ☁️ Cloud nodes\n'
  const rows: Array<[string, string]> = []

  if (outcome.status === 'fresh') {
    rows.push(['Status', '✅ Fresh (fetched from Cloud API)'])
    rows.push(['Packs', String(outcome.snapshot.packs.length)])
    rows.push([
      'Nodes',
      String(outcome.snapshot.packs.reduce((n, p) => n + p.nodes.length, 0))
    ])
    rows.push(['Dropped', String(outcome.droppedCount)])
  } else if (outcome.status === 'stale') {
    rows.push(['Status', '⚠️ Stale (using snapshot — Cloud fetch failed)'])
    rows.push(['Packs', String(outcome.snapshot.packs.length)])
    rows.push([
      'Nodes',
      String(outcome.snapshot.packs.reduce((n, p) => n + p.nodes.length, 0))
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
