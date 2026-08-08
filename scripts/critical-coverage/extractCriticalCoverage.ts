import {
  createCriticalCoverageReport,
  writeCriticalCoverageReport
} from './criticalCoverageReport'

interface Options {
  input: string
  output: string
  sha: string
}

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

function parseOptions(args: string[]): Options {
  const options: Options = {
    input: 'coverage/lcov.info',
    output: 'coverage/critical-unit-coverage.json',
    sha: process.env.GITHUB_SHA ?? 'unknown'
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const next = args[i + 1]

    if (arg === '--input' && next) {
      options.input = next
      i++
    } else if (arg.startsWith('--input=')) {
      options.input = arg.slice('--input='.length)
    } else if (arg === '--output' && next) {
      options.output = next
      i++
    } else if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length)
    } else if (arg === '--sha' && next) {
      options.sha = next
      i++
    } else if (arg.startsWith('--sha=')) {
      options.sha = arg.slice('--sha='.length)
    }
  }

  return options
}
