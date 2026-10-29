#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'

import type {
  JSONReport,
  JSONReportSpec,
  JSONReportSuite,
  JSONReportTest
} from '@playwright/test/reporter'

// Shapes Playwright's JSON reporter writes, derived from its own exports so the
// consumed fields cannot drift from the producer. Every field stays optional:
// the fork deploy workflow runs this on report artifacts a fork PR uploaded, so
// the content is untrusted and re-validated at use.
type ReportConfig = Partial<
  Pick<JSONReport['config'], 'rootDir' | 'configFile'>
>
type TestStats = Partial<JSONReport['stats']>
type TestCase = Partial<Pick<JSONReportTest, 'status'>>
type Spec = Partial<Pick<JSONReportSpec, 'id' | 'title' | 'file'>> & {
  tests?: TestCase[]
}
type Suite = Partial<Pick<JSONReportSuite, 'title' | 'file'>> & {
  specs?: Spec[]
  suites?: Suite[]
}

interface FullReportData {
  config?: ReportConfig
  stats?: TestStats
  suites?: Suite[]
}

interface FailedTest {
  name: string
  file: string
  reportUrl?: string
}

/** What every failure entry needs beyond the spec it came from. */
interface FailureContext {
  config?: ReportConfig
  /** Deployed HTML report the entries link into, when there is one. */
  reportLinkBase?: string
  /** Test root the caller states, used when the report states none. */
  testRoot?: string
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
/** Longest failure title kept. Playwright does not bound a test title. */
const MAX_FAILURE_NAME_CHARS = 200
/**
 * Character budget for the whole failure list. GitHub rejects a comment over
 * 65,536 characters and this is one section of several in it, so the entry cap
 * alone is not a size bound.
 */
const MAX_FAILURE_LIST_CHARS = 4000

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0
}

/** The shell splits failure records on `|` and on newlines. */
function stripReportFieldDelimiters(text: string): string {
  return text.replace(/[|\r\n]+/g, ' ')
}

function markdownSafe(text: string): string {
  return stripReportFieldDelimiters(text)
    .replace(/[\\[\]<>`]/g, '')
    .replace(/@/g, '@\u200b')
}

/** Truncates by code point, so a clamped title cannot end mid-character. */
function clamp(text: string, limit: number): string {
  const characters = Array.from(text)
  return characters.length <= limit
    ? text
    : `${characters.slice(0, limit).join('')}…`
}

/**
 * Encodes one path or query segment for a Markdown link destination.
 * `encodeURIComponent` leaves parentheses alone and an unescaped `)` ends the
 * destination early.
 */
function urlSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/\(/g, '%28').replace(/\)/g, '%29')
}

/** A relative path that cannot escape the directory it is joined to. */
function staysInside(candidate: string): boolean {
  return (
    !path.posix.isAbsolute(candidate) &&
    candidate !== '..' &&
    !candidate.startsWith('../')
  )
}

/**
 * Test root the report itself states, relative to the repository. `''` when
 * tests live at the repository root; `undefined` when the report carries no
 * usable mapping — `merge-reports` drops `configFile` unless it is given a
 * config, so the sharded CI path reports none.
 */
function configuredTestRoot(config: ReportConfig = {}) {
  const { rootDir, configFile } = config
  if (!rootDir || !configFile) return undefined
  const testRoot = path.posix.relative(path.posix.dirname(configFile), rootDir)
  return staysInside(testRoot) ? testRoot : undefined
}

/** Accepts only a plain relative directory from the caller. */
function callerTestRoot(argument: string | undefined) {
  if (!argument) return undefined
  const normalized = path.posix.normalize(argument)
  return normalized !== '.' && staysInside(normalized) ? normalized : undefined
}

/** Repository-relative path of a test file, encoded for a Markdown link. */
function linkedPath(file: string, context: FailureContext): string {
  const testRoot = configuredTestRoot(context.config) ?? context.testRoot
  const repoFile = testRoot ? path.posix.join(testRoot, file) : file
  return repoFile.split('/').map(urlSegment).join('/')
}

function linkedReport(specId: string | undefined, context: FailureContext) {
  return context.reportLinkBase && specId
    ? `${context.reportLinkBase}/#?testId=${urlSegment(specId)}`
    : undefined
}

/** A flaky test passed on retry and the comment script counts it as passing. */
function failedUnexpectedly(spec: Spec): boolean {
  return (spec.tests ?? []).some((test) => test.status === 'unexpected')
}

function specFailure(
  spec: Spec,
  suite: Suite,
  suitePath: string[],
  context: FailureContext
): FailedTest[] {
  const file = spec.file || suite.file
  if (!file || !failedUnexpectedly(spec)) return []
  const name = [...suitePath, spec.title].filter(Boolean).join(' › ')
  return [
    {
      name: clamp(markdownSafe(name), MAX_FAILURE_NAME_CHARS),
      file: linkedPath(file, context),
      reportUrl: linkedReport(spec.id, context)
    }
  ]
}

/** Keeps whole entries only, so every listed failure stays linkable. */
function withinCommentBudget(failures: FailedTest[]): FailedTest[] {
  const kept: FailedTest[] = []
  let chars = 0
  for (const failure of failures) {
    chars +=
      failure.name.length +
      failure.file.length +
      (failure.reportUrl?.length ?? 0)
    if (chars > MAX_FAILURE_LIST_CHARS) break
    kept.push(failure)
  }
  return kept
}

function extractFailedTests(
  reportData: FullReportData,
  baseUrl?: string,
  testRoot?: string
): FailedTest[] {
  const context: FailureContext = {
    config: reportData.config,
    reportLinkBase: baseUrl?.startsWith('https://') ? baseUrl : undefined,
    testRoot: callerTestRoot(testRoot)
  }

  function processSuite(suite: Suite, parentPath: string[]): FailedTest[] {
    const suitePath = suite.title ? [...parentPath, suite.title] : parentPath
    return [
      ...(suite.specs ?? []).flatMap((spec) =>
        specFailure(spec, suite, suitePath, context)
      ),
      ...(suite.suites ?? []).flatMap((child) => processSuite(child, suitePath))
    ]
  }

  const failures = (reportData.suites ?? [])
    .flatMap((suite) => processSuite(suite, []))
    .slice(0, MAX_LISTED_FAILURES)
  return withinCommentBudget(failures)
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
  baseUrl?: string,
  testRoot?: string
): FailedTest[] {
  try {
    return extractFailedTests(reportData, baseUrl, testRoot)
  } catch (error) {
    console.error('Could not list failed tests:', error)
    return []
  }
}

function countsFromJsonReport(
  reportDir: string,
  baseUrl?: string,
  testRoot?: string
): TestCounts | null {
  const jsonReportFile = path.join(reportDir, 'report.json')
  if (!fs.existsSync(jsonReportFile)) return null
  const reportJson: FullReportData = JSON.parse(
    fs.readFileSync(jsonReportFile, 'utf-8')
  )
  if (!reportJson.stats) return null
  const counts = countsFromStats(reportJson.stats)
  if (counts.failed > 0)
    counts.failures = safeFailures(reportJson, baseUrl, testRoot)
  return counts
}

function parseEmbeddedStats(json: string): TestCounts | null {
  try {
    const reportData: FullReportData = JSON.parse(json)
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
  const [expected, unexpected, flaky, skipped] = match
    .slice(1)
    .map((n) => Number(n))
  return countsFromStats({ expected, unexpected, flaky, skipped })
}

function summaryCount(content: string, outcome: string): number {
  const match = content.match(
    new RegExp(`(\\d+)\\s+(?:tests?|specs?)\\s+${outcome}`, 'i')
  )
  return match ? toCount(Number(match[1])) : 0
}

function countsFromSummaryText(content: string): TestCounts {
  const counts = countsFromStats({
    expected: summaryCount(content, 'passed'),
    unexpected: summaryCount(content, 'failed'),
    flaky: summaryCount(content, 'flaky'),
    skipped: summaryCount(content, 'skipped')
  })
  return {
    ...counts,
    total: summaryCount(content, '(?:total|ran)') || counts.total
  }
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

function extractTestCounts(
  reportDir: string,
  baseUrl?: string,
  testRoot?: string
): TestCounts {
  try {
    return (
      countsFromJsonReport(reportDir, baseUrl, testRoot) ??
      countsFromHtmlReport(reportDir) ??
      countsFromStats({})
    )
  } catch (error) {
    console.error(`Error reading report from ${reportDir}:`, error)
    return countsFromStats({})
  }
}

// Main execution
const reportDir = process.argv[2]
const baseUrl = process.argv[3] // Optional: base URL of the deployed HTML report
const testRoot = process.argv[4] // Optional: test root, relative to the repository

if (!reportDir) {
  console.error(
    'Usage: extract-playwright-counts.ts <report-directory> [base-url] [test-root]'
  )
  process.exit(1)
}

const counts = extractTestCounts(reportDir, baseUrl, testRoot)

// Output as JSON for easy parsing in shell script
process.stdout.write(JSON.stringify(counts) + '\n')

export { extractTestCounts, extractFailedTests }
