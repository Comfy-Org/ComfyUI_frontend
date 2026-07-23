import { appendFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import {
  createCriticalCoverageReport,
  writeCriticalCoverageReport
} from './criticalCoverageReport'

interface Options {
  input: string
  output: string
  sha: string
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  const summary = `## Critical Unit Coverage Extraction: ERROR\n\n${message}`

  process.stderr.write(`${message}\n`)

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
  }

  process.exitCode = 1
}

function main(): void {
  const options = parseOptions(process.argv.slice(2))
  const report = createCriticalCoverageReport({
    inputPath: options.input,
    sha: options.sha
  })

  writeCriticalCoverageReport(report, options.output)

  process.stdout.write(
    [
      `Critical coverage branches: ${report.totals.coveredBranches}/${report.totals.branches}`,
      `Critical coverage files: ${report.totals.files}`,
      `Wrote ${options.output}`
    ].join('\n') + '\n'
  )
}

function parseOptions(args: string[]): Options {
  const { values } = parseArgs({
    args,
    options: {
      input: { type: 'string' },
      output: { type: 'string' },
      sha: { type: 'string' }
    },
    strict: true,
    allowPositionals: false
  })

  return {
    input: values.input ?? 'coverage/lcov.info',
    output: values.output ?? 'coverage/critical-unit-coverage.json',
    sha: values.sha ?? process.env.GITHUB_SHA ?? ''
  }
}
