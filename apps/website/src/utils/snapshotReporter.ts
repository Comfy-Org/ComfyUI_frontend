import { appendFileSync } from 'node:fs'

export function escapeAnnotation(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}

export function describeSnapshotAge(fetchedAt: string): string {
  const timestamp = Date.parse(fetchedAt)
  if (!Number.isFinite(timestamp)) return 'unknown'
  const ageInDays = Math.trunc((Date.now() - timestamp) / 86_400_000)
  switch (ageInDays) {
    case 0:
      return 'today'
    case 1:
      return '1 day'
    default:
      return ageInDays < 0 ? 'today' : `${ageInDays} days`
  }
}

export function formatStepSummary(
  header: string,
  rows: ReadonlyArray<readonly [string, string]>
): string {
  const cells = rows.map(([key, value]) => `| **${key}** | ${value} |`)
  return `${header}| | |\n|---|---|\n${cells.join('\n')}\n\n`
}

interface ReportOptions {
  annotations: readonly string[]
  summary: string
  warningPrefix: string
}

export function writeSnapshotReport({
  annotations,
  summary,
  warningPrefix
}: ReportOptions): void {
  for (const line of annotations) process.stdout.write(`${line}\n`)

  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) return
  try {
    appendFileSync(summaryPath, summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${warningPrefix}: ${message}\n`)
  }
}
