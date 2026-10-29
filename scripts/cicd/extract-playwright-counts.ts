#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'

interface TestStats {
  expected?: number
  unexpected?: number
  flaky?: number
  skipped?: number
  finished?: number
}

interface TestCase {
  status: 'skipped' | 'expected' | 'unexpected' | 'flaky'
  projectName?: string
}

interface Spec {
  id: string
  title: string
  file?: string
  tests?: TestCase[]
}

interface Suite {
  title: string
  file?: string
  specs?: Spec[]
  suites?: Suite[]
}

interface FullReportData {
  config?: { rootDir?: string; configFile?: string }
  stats?: TestStats
  suites?: Suite[]
}

interface ReportData {
  stats?: TestStats
}

interface FailedTest {
  name: string
  file: string
  traceUrl?: string
}

interface TestCounts {
  passed: number
  failed: number
  flaky: number
  skipped: number
  total: number
  failures?: FailedTest[]
}

const MAX_LISTED_FAILURES = 20

function toCount(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? (value as number)
    : 0
}

function singleLine(text: string): string {
  return text.replace(/[|\r\n]+/g, ' ')
}

function markdownSafe(text: string): string {
  return singleLine(text)
    .replace(/[\\[\]<>`]/g, '')
    .replace(/@/g, '@\u200b')
}

function repoRelativePath(
  file: string,
  config: FullReportData['config']
): string {
  if (!config?.rootDir || !config.configFile) return file
  const testRoot = path.posix.relative(
    path.posix.dirname(config.configFile),
    config.rootDir
  )
  const outside =
    testRoot === '' ||
    testRoot === '..' ||
    testRoot.startsWith('../') ||
    path.posix.isAbsolute(testRoot)
  return outside ? file : path.posix.join(testRoot, file)
}

function projectLabel(spec: Spec, test: TestCase): string {
  return (spec.tests?.length ?? 0) > 1 && test.projectName
    ? ` (${test.projectName})`
    : ''
}

function specFailures(
  spec: Spec,
  suite: Suite,
  suitePath: string[],
  config: FullReportData['config'],
  reportLinkBase: string | undefined
): FailedTest[] {
  const file = spec.file || suite.file
  if (!file) return []
  const name = [...suitePath, spec.title].filter(Boolean).join(' › ')
  const repoFile = repoRelativePath(singleLine(file), config)
    .split('/')
    .map(encodeURIComponent)
    .join('/')
  const traceUrl = reportLinkBase
    ? `${reportLinkBase}/#?testId=${encodeURIComponent(spec.id)}`
    : undefined
  return (spec.tests ?? [])
    .filter((test) => test.status === 'unexpected')
    .map((test) => ({
      name: markdownSafe(name + projectLabel(spec, test)),
      file: repoFile,
      traceUrl
    }))
}

function extractFailedTests(
  reportData: FullReportData,
  baseUrl?: string
): FailedTest[] {
  const reportLinkBase = baseUrl?.startsWith('https://') ? baseUrl : undefined

  function processSuite(suite: Suite, parentPath: string[]): FailedTest[] {
    const suitePath = suite.title ? [...parentPath, suite.title] : parentPath
    return [
      ...(suite.specs ?? []).flatMap((spec) =>
        specFailures(spec, suite, suitePath, reportData.config, reportLinkBase)
      ),
      ...(suite.suites ?? []).flatMap((child) => processSuite(child, suitePath))
    ]
  }

  return (reportData.suites ?? [])
    .flatMap((suite) => processSuite(suite, []))
    .slice(0, MAX_LISTED_FAILURES)
}

function countsFromStats(stats: TestStats): TestCounts {
  const passed = toCount(stats.expected)
  const failed = toCount(stats.unexpected)
  const flaky = toCount(stats.flaky)
  const skipped = toCount(stats.skipped)
  return {
    passed,
    failed,
    flaky,
    skipped,
    total: passed + failed + flaky + skipped,
    failures: []
  }
}

function safeFailures(
  reportData: FullReportData,
  baseUrl?: string
): FailedTest[] {
  try {
    return extractFailedTests(reportData, baseUrl)
  } catch (error) {
    console.error('Could not list failed tests:', error)
    return []
  }
}

function emptyCounts(): TestCounts {
  return countsFromStats({})
}

function countsFromJsonReport(
  reportDir: string,
  baseUrl?: string
): TestCounts | null {
  const jsonReportFile = path.join(reportDir, 'report.json')
  if (!fs.existsSync(jsonReportFile)) return null
  const reportJson: FullReportData = JSON.parse(
    fs.readFileSync(jsonReportFile, 'utf-8')
  )
  if (!reportJson.stats) return null
  const counts = countsFromStats(reportJson.stats)
  if (counts.failed > 0) counts.failures = safeFailures(reportJson, baseUrl)
  return counts
}

function parseEmbeddedStats(json: string): TestCounts | null {
  try {
    const reportData: ReportData = JSON.parse(json)
    return reportData.stats ? countsFromStats(reportData.stats) : null
  } catch {
    return null
  }
}

function countsFromEmbeddedReport(content: string): TestCounts | null {
  const base64 = content.match(
    /window\.playwrightReportBase64\s*=\s*["']([^"']+)["']/
  )
  const fromBase64 = base64
    ? parseEmbeddedStats(Buffer.from(base64[1], 'base64').toString('utf-8'))
    : null
  if (fromBase64) return fromBase64
  const literal = content.match(/window\.playwrightReport\s*=\s*({[\s\S]*?});/)
  return literal ? parseEmbeddedStats(literal[1]) : null
}

function countsFromRenderedStats(content: string): TestCounts | null {
  const match = content.match(
    /(\d+)\s+passed[^0-9]*(\d+)\s+failed[^0-9]*(\d+)\s+flaky[^0-9]*(\d+)\s+skipped/i
  )
  if (!match) return null
  const [passed, failed, flaky, skipped] = match
    .slice(1)
    .map((n) => parseInt(n) || 0)
  return {
    passed,
    failed,
    flaky,
    skipped,
    total: passed + failed + flaky + skipped,
    failures: []
  }
}

function summaryCount(content: string, outcome: string): number {
  const match = content.match(
    new RegExp(`(\\d+)\\s+(?:tests?|specs?)\\s+${outcome}`, 'i')
  )
  return match ? parseInt(match[1]) || 0 : 0
}

function countsFromSummaryText(content: string): TestCounts {
  const passed = summaryCount(content, 'passed')
  const failed = summaryCount(content, 'failed')
  const flaky = summaryCount(content, 'flaky')
  const skipped = summaryCount(content, 'skipped')
  const total =
    summaryCount(content, '(?:total|ran)') || passed + failed + flaky + skipped
  return { passed, failed, flaky, skipped, total, failures: [] }
}

function countsFromHtmlReport(reportDir: string): TestCounts | null {
  const indexFile = path.join(reportDir, 'index.html')
  if (!fs.existsSync(indexFile)) return null
  const content = fs.readFileSync(indexFile, 'utf-8')
  return (
    countsFromEmbeddedReport(content) ??
    countsFromRenderedStats(content) ??
    countsFromSummaryText(content)
  )
}

/**
 * Extract test counts from a Playwright report directory
 * @param reportDir - Path to the playwright-report directory
 * @param baseUrl - Base URL of the deployed report (for test links)
 * @returns Test counts { passed, failed, flaky, skipped, total, failures }
 */
function extractTestCounts(reportDir: string, baseUrl?: string): TestCounts {
  try {
    return (
      countsFromJsonReport(reportDir, baseUrl) ??
      countsFromHtmlReport(reportDir) ??
      emptyCounts()
    )
  } catch (error) {
    console.error(`Error reading report from ${reportDir}:`, error)
    return emptyCounts()
  }
}

// Main execution
const reportDir = process.argv[2]
const baseUrl = process.argv[3] // Optional: base URL for trace links

if (!reportDir) {
  console.error(
    'Usage: extract-playwright-counts.ts <report-directory> [base-url]'
  )
  process.exit(1)
}

const counts = extractTestCounts(reportDir, baseUrl)

// Output as JSON for easy parsing in shell script
process.stdout.write(JSON.stringify(counts) + '\n')

export { extractTestCounts, extractFailedTests }
