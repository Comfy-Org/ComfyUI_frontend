import type { FetchOutcome } from './github'

import {
  createBuildDataReporter,
  describeSnapshotAge,
  escapeAnnotation
} from './buildDataReporter'

const githubStarsReporter = createBuildDataReporter({
  summaryHeading: '## GitHub stars\n',
  buildAnnotations,
  buildSummaryRows
})

export const resetGitHubStarsReporterForTests =
  githubStarsReporter.resetForTests
export const reportGitHubStarsOutcome = githubStarsReporter.report

function buildAnnotations(outcome: FetchOutcome): string[] {
  if (outcome.status === 'fresh') return []

  if (outcome.status === 'stale') {
    return [
      `::warning title=GitHub stars unavailable::${escapeAnnotation(
        outcome.reason
      )}. Using last-known-good snapshot.%0A%0AAction items:%0A  1. Check GitHub API availability/rate limits.%0A  2. Re-run the build once GitHub is healthy.%0A  3. To refresh the fallback value, run \`pnpm --filter @comfyorg/website github-stars:refresh-snapshot\` and commit apps/website/src/data/github-stars.snapshot.json.`
    ]
  }

  return [
    `::error title=GitHub stars fetch failed and no snapshot is available::Cannot render website navigation stars.%0A%0AReason: ${escapeAnnotation(
      outcome.reason
    )}%0A%0AAction items:%0A  1. Run \`pnpm --filter @comfyorg/website github-stars:refresh-snapshot\`.%0A  2. Commit apps/website/src/data/github-stars.snapshot.json.%0A  3. Push and re-run CI.`
  ]
}

function buildSummaryRows(outcome: FetchOutcome): Array<[string, string]> {
  const rows: Array<[string, string]> = []

  if (outcome.status === 'fresh') {
    rows.push(['Status', 'Fresh (fetched from GitHub)'])
    rows.push(['Repository', outcome.snapshot.repository])
    rows.push(['Stars', String(outcome.snapshot.stargazersCount)])
  } else if (outcome.status === 'stale') {
    rows.push(['Status', 'Stale (using snapshot - GitHub fetch failed)'])
    rows.push(['Repository', outcome.snapshot.repository])
    rows.push(['Stars', String(outcome.snapshot.stargazersCount)])
    rows.push(['Reason', outcome.reason])
    rows.push(['Snapshot age', describeSnapshotAge(outcome.snapshot.fetchedAt)])
  } else {
    rows.push(['Status', 'Failed (no snapshot available)'])
    rows.push(['Reason', outcome.reason])
  }

  return rows
}
