#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'

interface Attachment {
  contentType: string
  name: string
  path?: string
}

interface TestResult {
  attachments?: Attachment[]
}

interface Test {
  results: TestResult[]
}

interface Spec {
  title: string
  tests: Test[]
}

interface Suite {
  title: string
  file: string
  suites?: Suite[]
  specs?: Spec[]
}

interface Report {
  suites?: Suite[]
}

interface VideoEntry {
  name: string
  file: string
  relativePath: string
}

function isVideoAttachment(
  attachment: Attachment
): attachment is Attachment & { path: string } {
  return attachment.name === 'video' && !!attachment.path
}

function toVideoEntry(
  attachment: Attachment & { path: string },
  name: string,
  file: string,
  testResultsDir: string
): VideoEntry {
  return {
    name,
    file,
    relativePath: path
      .relative(testResultsDir, attachment.path)
      .replace(/\\/g, '/')
  }
}

function collectResultVideos(
  result: TestResult,
  name: string,
  file: string,
  testResultsDir: string
): VideoEntry[] {
  return (result.attachments ?? [])
    .filter(isVideoAttachment)
    .map((attachment) => toVideoEntry(attachment, name, file, testResultsDir))
}

function collectSpecVideos(
  spec: Spec,
  suitePath: string[],
  file: string,
  testResultsDir: string
): VideoEntry[] {
  const name = [...suitePath, spec.title].filter(Boolean).join(' › ')
  return spec.tests.flatMap((test) =>
    test.results.flatMap((result) =>
      collectResultVideos(result, name, file, testResultsDir)
    )
  )
}

// Must run in the same job/filesystem that produced the report (attachment paths are absolute to that run).
function collectSuiteVideos(
  suite: Suite,
  testResultsDir: string,
  parentPath: string[] = []
): VideoEntry[] {
  const suitePath = suite.title ? [...parentPath, suite.title] : parentPath

  const specVideos = (suite.specs ?? []).flatMap((spec) =>
    collectSpecVideos(spec, suitePath, suite.file, testResultsDir)
  )
  const childVideos = (suite.suites ?? []).flatMap((childSuite) =>
    collectSuiteVideos(childSuite, testResultsDir, suitePath)
  )

  return [...specVideos, ...childVideos]
}

function collectVideos(report: Report, testResultsDir: string): VideoEntry[] {
  return (report.suites ?? []).flatMap((suite) =>
    collectSuiteVideos(suite, testResultsDir)
  )
}

function readVideos(reportPath: string, testResultsDir: string): VideoEntry[] {
  try {
    const report: Report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
    return collectVideos(report, path.resolve(testResultsDir))
  } catch (error) {
    console.error(`Error reading report from ${reportPath}:`, error)
    return []
  }
}

const reportPath = process.argv[2]
const testResultsDir = process.argv[3]

if (!reportPath || !testResultsDir) {
  console.error(
    'Usage: extract-playwright-videos.ts <report.json> <test-results-dir>'
  )
  process.exit(1)
}

const videos = readVideos(reportPath, testResultsDir)
process.stdout.write(JSON.stringify(videos) + '\n')

export { collectVideos }
