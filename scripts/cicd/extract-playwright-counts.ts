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

interface TestLocation {
  file: string
  line: number
  column: number
}

interface TestAttachment {
  name: string
  path?: string
  contentType: string
}

interface TestResult {
  status: string
  duration: number
  errors?: Array<{ message?: string; stack?: string }>
  attachments?: TestAttachment[]
}

interface Test {
  title: string
  location?: TestLocation
  results?: TestResult[]
}

interface Suite {
  title: string
  suites?: Suite[]
  tests?: Test[]
}

interface ReportData {
  stats?: TestStats
  suites?: Suite[]
}

interface FailingTest {
  name: string
  filePath: string
  line: number
  error: string
  tracePath?: string
  failureType?: 'screenshot' | 'expectation' | 'timeout' | 'other'
}

interface FailureTypeCounts {
  screenshot: number
  expectation: number
  timeout: number
  other: number
}

interface TestCounts {
  passed: number
  failed: number
  flaky: number
  skipped: number
  total: number
  failingTests?: FailingTest[]
  failureTypes?: FailureTypeCounts
}

/**
 * Categorize the failure type based on error message
 */
function categorizeFailureType(
  error: string,
  status: string
): 'screenshot' | 'expectation' | 'timeout' | 'other' {
  if (status === 'timedOut') {
    return 'timeout'
  }

  const errorLower = error.toLowerCase()

  // Screenshot-related errors
  if (
    errorLower.includes('screenshot') ||
    errorLower.includes('snapshot') ||
    errorLower.includes('toHaveScreenshot') ||
    errorLower.includes('image comparison') ||
    errorLower.includes('pixel') ||
    errorLower.includes('visual')
  ) {
    return 'screenshot'
  }

  // Expectation errors
  if (
    errorLower.includes('expect') ||
    errorLower.includes('assertion') ||
    errorLower.includes('toEqual') ||
    errorLower.includes('toBe') ||
    errorLower.includes('toContain') ||
    errorLower.includes('toHave') ||
    errorLower.includes('toMatch')
  ) {
    return 'expectation'
  }

  return 'other'
}

/**
 * Recursively extract failing tests from suite structure
 */
function extractFailingTests(
  suite: Suite,
  failingTests: FailingTest[],
  reportDir: string
): void {
  // Process tests in this suite
  if (suite.tests) {
    for (const test of suite.tests) {
      if (!test.results) continue

      for (const result of test.results) {
        if (result.status === 'failed' || result.status === 'timedOut') {
          const error =
            result.errors?.[0]?.message ||
            result.errors?.[0]?.stack ||
            'Test failed'

          // Find trace attachment
          let tracePath: string | undefined
          if (result.attachments) {
            const traceAttachment = result.attachments.find(
              (att) => att.name === 'trace' || att.contentType === 'application/zip'
            )
            if (traceAttachment?.path) {
              tracePath = traceAttachment.path
            }
          }

          const failureType = categorizeFailureType(error, result.status)

          failingTests.push({
            name: test.title,
            filePath: test.location?.file || 'unknown',
            line: test.location?.line || 0,
            error: error.split('\n')[0], // First line of error
            tracePath,
            failureType
          })
        }
      }
    }
  }

  // Recursively process nested suites
  if (suite.suites) {
    for (const nestedSuite of suite.suites) {
      extractFailingTests(nestedSuite, failingTests, reportDir)
    }
  }
}

/**
 * Extract test counts from Playwright HTML report
 * @param reportDir - Path to the playwright-report directory
 * @returns Test counts { passed, failed, flaky, skipped, total, failingTests }
 */
function extractTestCounts(reportDir: string): TestCounts {
  const counts: TestCounts = {
    passed: 0,
    failed: 0,
    flaky: 0,
    skipped: 0,
    total: 0,
    failingTests: [],
    failureTypes: {
      screenshot: 0,
      expectation: 0,
      timeout: 0,
      other: 0
    }
  }

  try {
    // First, try to find report.json which Playwright generates with JSON reporter
    const jsonReportFile = path.join(reportDir, 'report.json')
    if (fs.existsSync(jsonReportFile)) {
      const reportJson: ReportData = JSON.parse(
        fs.readFileSync(jsonReportFile, 'utf-8')
      )
      if (reportJson.stats) {
        const stats = reportJson.stats
        counts.total = stats.expected || 0
        counts.passed =
          (stats.expected || 0) -
          (stats.unexpected || 0) -
          (stats.flaky || 0) -
          (stats.skipped || 0)
        counts.failed = stats.unexpected || 0
        counts.flaky = stats.flaky || 0
        counts.skipped = stats.skipped || 0

        // Extract failing test details
        if (reportJson.suites) {
          for (const suite of reportJson.suites) {
            extractFailingTests(suite, counts.failingTests, reportDir)
          }
        }

        // Count failure types
        if (counts.failingTests) {
          for (const test of counts.failingTests) {
            const type = test.failureType || 'other'
            counts.failureTypes![type]++
          }
        }

        return counts
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

          if (reportData.stats) {
            const stats = reportData.stats
            counts.total = stats.expected || 0
            counts.passed =
              (stats.expected || 0) -
              (stats.unexpected || 0) -
              (stats.flaky || 0) -
              (stats.skipped || 0)
            counts.failed = stats.unexpected || 0
            counts.flaky = stats.flaky || 0
            counts.skipped = stats.skipped || 0

            // Extract failing test details
            if (reportData.suites) {
              for (const suite of reportData.suites) {
                extractFailingTests(suite, counts.failingTests!, reportDir)
              }
            }

            // Count failure types
            if (counts.failingTests) {
              for (const test of counts.failingTests) {
                const type = test.failureType || 'other'
                counts.failureTypes![type]++
              }
            }

            return counts
          }
        } catch (e) {
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

          if (reportData.stats) {
            const stats = reportData.stats
            counts.total = stats.expected || 0
            counts.passed =
              (stats.expected || 0) -
              (stats.unexpected || 0) -
              (stats.flaky || 0) -
              (stats.skipped || 0)
            counts.failed = stats.unexpected || 0
            counts.flaky = stats.flaky || 0
            counts.skipped = stats.skipped || 0

            // Extract failing test details
            if (reportData.suites) {
              for (const suite of reportData.suites) {
                extractFailingTests(suite, counts.failingTests!, reportDir)
              }
            }

            // Count failure types
            if (counts.failingTests) {
              for (const test of counts.failingTests) {
                const type = test.failureType || 'other'
                counts.failureTypes![type]++
              }
            }

            return counts
          }
        } catch (e) {
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

if (!reportDir) {
  console.error('Usage: extract-playwright-counts.ts <report-directory>')
  process.exit(1)
}

const counts = extractTestCounts(reportDir)

// Output as JSON for easy parsing in shell script
console.log(JSON.stringify(counts))

export { extractTestCounts }
