import fs from 'node:fs'
import path from 'node:path'

import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult
} from '@playwright/test/reporter'

const OUTPUT_DIR = 'snapshot-updates'
const ACTUAL_SUFFIX = /-actual(\.[^.]+)?$/

function snapshotPairs(attachments: TestResult['attachments']) {
  const paths = new Map(attachments.map(({ name, path }) => [name, path]))
  return attachments.flatMap(({ name, path: actual }) => {
    const expected =
      ACTUAL_SUFFIX.test(name) &&
      paths.get(name.replace(ACTUAL_SUFFIX, '-expected$1'))
    return actual && expected ? [{ expected, actual }] : []
  })
}

function collectUpdates(lastResults: Map<TestCase, TestResult>) {
  const updates = new Map<string, string>()
  for (const [test, result] of lastResults) {
    if (test.outcome() !== 'unexpected') continue
    for (const { expected, actual } of snapshotPairs(result.attachments)) {
      updates.set(path.relative(process.cwd(), expected), actual)
    }
  }
  return updates
}

function writeUpdates(updates: Map<string, string>) {
  for (const [snapshotPath, actual] of updates) {
    const destination = path.join(OUTPUT_DIR, snapshotPath)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(actual, destination)
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify([...updates.keys()], null, 2)
  )
}

export default class SnapshotUpdatesReporter implements Reporter {
  private readonly lastResults = new Map<TestCase, TestResult>()

  onTestEnd(test: TestCase, result: TestResult) {
    this.lastResults.set(test, result)
  }

  onEnd(result: FullResult) {
    const finished = result.status === 'passed' || result.status === 'failed'
    if (finished && this.lastResults.size > 0)
      writeUpdates(collectUpdates(this.lastResults))
  }

  printsToStdio() {
    return false
  }
}
