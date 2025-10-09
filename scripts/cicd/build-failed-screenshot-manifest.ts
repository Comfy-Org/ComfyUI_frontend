import type {
  JSONReport,
  JSONReportSpec,
  JSONReportSuite,
  JSONReportTestResult
} from '@playwright/test/reporter'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

const argv = process.argv.slice(2)
const getArg = (flag: string, fallback: string) => {
  const i = argv.indexOf(flag)
  if (i >= 0 && i + 1 < argv.length) return argv[i + 1]
  return fallback
}

async function main() {
  // Defaults mirror the workflow layout
  const reportPath = getArg(
    '--report',
    path.join('playwright-report', 'report.json')
  )
  const outDir = getArg('--out', path.join('ci-rerun'))

  if (!fs.existsSync(reportPath)) {
    throw Error(`Report not found at ${reportPath}`)
  }

  const raw = await fsp.readFile(reportPath, 'utf8')
  const data = JSON.parse(raw)

  const hasScreenshotSignal = (r: JSONReportTestResult) => {
    return r.attachments.some((att) => att?.contentType?.startsWith('image/'))
  }

  const out = new Map<string, Set<string>>()

  const collectFailedScreenshots = (suite?: JSONReportSuite) => {
    if (!suite) return
    const childSuites = suite.suites ?? []
    for (const childSuite of childSuites) collectFailedScreenshots(childSuite)
    const specs: JSONReportSpec[] = suite.specs ?? []
    for (const spec of specs) {
      const file = spec.file
      const line = spec.line
      const loc = `${file}:${line}`
      for (const test of spec.tests) {
        const project = test.projectId
        const last = test.results[test.results.length - 1]
        const failedScreenshot =
          last && last.status === 'failed' && hasScreenshotSignal(last)
        if (!failedScreenshot) continue
        if (!out.has(project)) out.set(project, new Set())
        out.get(project)!.add(loc)
      }
    }
  }

  const report: JSONReport = data
  const rootSuites = report.suites ?? []
  for (const suite of rootSuites) collectFailedScreenshots(suite)

  await fsp.mkdir(outDir, { recursive: true })
  for (const [project, set] of out.entries()) {
    const f = path.join(outDir, `${project}.txt`)
    await fsp.writeFile(f, Array.from(set).join('\n') + '\n', 'utf8')
  }
}

main().catch((err) => {
  console.error('Manifest generation failed:', err)
  process.exit(1)
})
