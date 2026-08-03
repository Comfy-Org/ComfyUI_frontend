import { appendFileSync } from 'node:fs'

export function appendGitHubStepSummary(summary: string): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) {
    return
  }

  try {
    appendFileSync(summaryPath, `${summary}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`Unable to write GitHub step summary: ${message}\n`)
  }
}
