#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'

interface Attachment {
  name: string
  path?: string
  contentType: string
}

interface TestResult {
  attachments?: Attachment[]
}

interface TestCase {
  title: string
  results: TestResult[]
}

interface Suite {
  title: string
  file: string
  suites?: Suite[]
  tests?: TestCase[]
}

interface Report {
  suites?: Suite[]
}

interface VideoEntry {
  name: string
  file: string
  relativePath: string
}

/**
 * Walk a Playwright JSON report and collect every video attachment, recorded
 * as a path relative to the test-results directory. This must run in the
 * same job/filesystem that produced the report (attachment paths are
 * absolute to that run) — a later job deploying the directory elsewhere only
 * needs to join this relative path onto its own deployed base URL.
 */
function collectVideos(report: Report, testResultsDir: string): VideoEntry[] {
  const videos: VideoEntry[] = []

  function processSuite(suite: Suite, parentPath: string[] = []) {
    const suitePath = suite.title ? [...parentPath, suite.title] : parentPath

    for (const test of suite.tests ?? []) {
      for (const result of test.results) {
        for (const attachment of result.attachments ?? []) {
          if (attachment.name !== 'video' || !attachment.path) continue

          videos.push({
            name: [...suitePath, test.title].filter(Boolean).join(' › '),
            file: suite.file,
            relativePath: path
              .relative(testResultsDir, attachment.path)
              .replace(/\\/g, '/')
          })
        }
      }
    }

    for (const childSuite of suite.suites ?? []) {
      processSuite(childSuite, suitePath)
    }
  }

  for (const suite of report.suites ?? []) {
    processSuite(suite)
  }

  return videos
}

const reportPath = process.argv[2]
const testResultsDir = process.argv[3]

if (!reportPath || !testResultsDir) {
  console.error(
    'Usage: extract-playwright-videos.ts <report.json> <test-results-dir>'
  )
  process.exit(1)
}

let videos: VideoEntry[] = []
try {
  const report: Report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
  videos = collectVideos(report, path.resolve(testResultsDir))
} catch (error) {
  console.error(`Error reading report from ${reportPath}:`, error)
}

process.stdout.write(JSON.stringify(videos) + '\n')

export { collectVideos }
