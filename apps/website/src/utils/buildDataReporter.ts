import { appendFileSync } from 'node:fs'

import type { BuildDataOutcome } from './buildDataSource'

type SummaryRows = Array<[string, string]>

interface BuildDataReporterConfig<
  TSnapshot,
  TFreshData extends object = object
> {
  summaryHeading: string
  buildAnnotations: (
    outcome: BuildDataOutcome<TSnapshot, TFreshData>
  ) => string[]
  buildSummaryRows: (
    outcome: BuildDataOutcome<TSnapshot, TFreshData>
  ) => SummaryRows
}

export function createBuildDataReporter<
  TSnapshot,
  TFreshData extends object = object
>(config: BuildDataReporterConfig<TSnapshot, TFreshData>) {
  let hasReported = false

  function resetForTests(): void {
    hasReported = false
  }

  function report(outcome: BuildDataOutcome<TSnapshot, TFreshData>): void {
    if (hasReported) return
    hasReported = true

    const lines = config.buildAnnotations(outcome)
    for (const line of lines) {
      process.stdout.write(`${line}\n`)
    }

    const summaryPath = process.env.GITHUB_STEP_SUMMARY
    if (summaryPath) {
      try {
        appendFileSync(
          summaryPath,
          buildStepSummary(
            config.summaryHeading,
            config.buildSummaryRows(outcome)
          )
        )
      } catch {
        // Best-effort only; a missing local summary file must not fail a build.
      }
    }
  }

  return { report, resetForTests }
}

export function escapeAnnotation(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}

export function describeSnapshotAge(fetchedAt: string): string {
  const fetched = new Date(fetchedAt).getTime()
  if (Number.isNaN(fetched)) return 'unknown'
  const days = Math.floor((Date.now() - fetched) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day'
  return `${days} days`
}

function buildStepSummary(heading: string, rows: SummaryRows): string {
  const table =
    '| | |\n|---|---|\n' +
    rows.map(([key, value]) => `| **${key}** | ${value} |`).join('\n') +
    '\n'

  return `${heading}${table}\n`
}
