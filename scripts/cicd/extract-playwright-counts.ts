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
}

interface Spec {
  id: string
  title: string
  file: string
  tests: TestCase[]
}

interface Suite {
  title: string
  file: string
  specs?: Spec[]
  suites?: Suite[]
}

interface FullReportData {
  config?: { rootDir?: string }
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

function repoRelativePath(file: string, rootDir?: string): string {
  if (!rootDir) return file
  const relative = path.relative(process.cwd(), path.resolve(rootDir, file))
  return relative.startsWith('..') || path.isAbsolute(relative)
    ? file
    : relative.split(path.sep).join('/')
}

function extractFailedTests(
  reportData: FullReportData,
  baseUrl?: string
): FailedTest[] {
  const failures: FailedTest[] = []
  const rootDir = reportData.config?.rootDir

  function processSuite(suite: Suite, parentPath: string[] = []) {
    const suitePath = suite.title ? [...parentPath, suite.title] : parentPath

    for (const spec of suite.specs ?? []) {
      if (!spec.tests.some((test) => test.status === 'unexpected')) continue
      const file = repoRelativePath(spec.file || suite.file, rootDir)
      failures.push({
        name: [...suitePath, spec.title].filter(Boolean).join(' › '),
        file,
        traceUrl: baseUrl ? `${baseUrl}/#?testId=${spec.id}` : undefined
      })
    }

    for (const childSuite of suite.suites ?? []) {
      processSuite(childSuite, suitePath)
    }
  }

  for (const suite of reportData.suites ?? []) {
    processSuite(suite)
  }

  return failures
}

function countsFromStats(stats: TestStats): TestCounts {
  const passed = stats.expected || 0
  const failed = stats.unexpected || 0
  const flaky = stats.flaky || 0
  const skipped = stats.skipped || 0
  return {
    passed,
    failed,
    flaky,
    skipped,
    total: passed + failed + flaky + skipped,
    failures: []
  }
}

/**
 * Extract test counts from Playwright HTML report
 * @param reportDir - Path to the playwright-report directory
 * @param baseUrl - Base URL of the deployed report (for trace links)
 * @returns Test counts { passed, failed, flaky, skipped, total, failures }
 */
function extractTestCounts(reportDir: string, baseUrl?: string): TestCounts {
  const counts: TestCounts = {
    passed: 0,
    failed: 0,
    flaky: 0,
    skipped: 0,
    total: 0,
    failures: []
  }

  try {
    // First, try to find report.json which Playwright generates with JSON reporter
    const jsonReportFile = path.join(reportDir, 'report.json')
    if (fs.existsSync(jsonReportFile)) {
      const reportJson: FullReportData = JSON.parse(
        fs.readFileSync(jsonReportFile, 'utf-8')
      )
      if (reportJson.stats) {
        const jsonCounts = countsFromStats(reportJson.stats)
        if (jsonCounts.failed > 0) {
          jsonCounts.failures = extractFailedTests(reportJson, baseUrl)
        }
        return jsonCounts
      }
    }

    // Try index.html - Playwright HTML report embeds data in a script tag
    const indexFile = path.join(reportDir, 'index.html')
    if (fs.existsSync(indexFile)) {
      const content = fs.readFileSync(indexFile, 'utf-8')

      // Look for the embedded report data in various formats
      // Format 1: window.playwrightReportBase64
      let dataMatch = content.match(
        /window\.playwrightReportBase64\s*=\s*["']([^"']+)["']/
      )
      if (dataMatch) {
        try {
          const decodedData = Buffer.from(dataMatch[1], 'base64').toString(
            'utf-8'
          )
          const reportData: ReportData = JSON.parse(decodedData)

          if (reportData.stats) return countsFromStats(reportData.stats)
        } catch {
          // Continue to try other formats
        }
      }

      // Format 2: window.playwrightReport
      dataMatch = content.match(/window\.playwrightReport\s*=\s*({[\s\S]*?});/)
      if (dataMatch) {
        try {
          // Use Function constructor instead of eval for safety
          const reportData = new Function(
            'return ' + dataMatch[1]
          )() as ReportData

          if (reportData.stats) return countsFromStats(reportData.stats)
        } catch {
          // Continue to try other formats
        }
      }

      // Format 3: Look for stats in the HTML content directly
      // Playwright sometimes renders stats in the UI
      const statsMatch = content.match(
        /(\d+)\s+passed[^0-9]*(\d+)\s+failed[^0-9]*(\d+)\s+flaky[^0-9]*(\d+)\s+skipped/i
      )
      if (statsMatch) {
        counts.passed = parseInt(statsMatch[1]) || 0
        counts.failed = parseInt(statsMatch[2]) || 0
        counts.flaky = parseInt(statsMatch[3]) || 0
        counts.skipped = parseInt(statsMatch[4]) || 0
        counts.total =
          counts.passed + counts.failed + counts.flaky + counts.skipped
        return counts
      }

      // Format 4: Try to extract from summary text patterns
      const passedMatch = content.match(/(\d+)\s+(?:tests?|specs?)\s+passed/i)
      const failedMatch = content.match(/(\d+)\s+(?:tests?|specs?)\s+failed/i)
      const flakyMatch = content.match(/(\d+)\s+(?:tests?|specs?)\s+flaky/i)
      const skippedMatch = content.match(/(\d+)\s+(?:tests?|specs?)\s+skipped/i)
      const totalMatch = content.match(
        /(\d+)\s+(?:tests?|specs?)\s+(?:total|ran)/i
      )

      if (passedMatch) counts.passed = parseInt(passedMatch[1]) || 0
      if (failedMatch) counts.failed = parseInt(failedMatch[1]) || 0
      if (flakyMatch) counts.flaky = parseInt(flakyMatch[1]) || 0
      if (skippedMatch) counts.skipped = parseInt(skippedMatch[1]) || 0
      if (totalMatch) {
        counts.total = parseInt(totalMatch[1]) || 0
      } else if (
        counts.passed ||
        counts.failed ||
        counts.flaky ||
        counts.skipped
      ) {
        counts.total =
          counts.passed + counts.failed + counts.flaky + counts.skipped
      }
    }
  } catch (error) {
    console.error(`Error reading report from ${reportDir}:`, error)
  }

  return counts
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
