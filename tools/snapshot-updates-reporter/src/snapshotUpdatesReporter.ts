import fs from 'node:fs'
import path from 'node:path'

import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter'

const OUTPUT_DIR = 'snapshot-updates'
const SNAPSHOT_ATTACHMENT = /^(.*)-(expected|actual)(\.[^.]+)?$/

function snapshotPairs(attachments: TestResult['attachments']) {
  const pairs = new Map<string, { expected?: string; actual?: string }>()
  for (const { name, path: file } of attachments) {
    const match = name.match(SNAPSHOT_ATTACHMENT)
    if (!match || !file) continue
    const [, prefix, kind, ext = ''] = match
    pairs.set(prefix + ext, { ...pairs.get(prefix + ext), [kind]: file })
  }
  return [...pairs.values()].filter(
    (pair): pair is { expected: string; actual: string } =>
      !!pair.expected && !!pair.actual
  )
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

export default class SnapshotUpdatesReporter implements Reporter {
  private readonly lastResults = new Map<TestCase, TestResult>()

  onTestEnd(test: TestCase, result: TestResult) {
    this.lastResults.set(test, result)
  }

  onEnd() {
    const updates = collectUpdates(this.lastResults)
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

  printsToStdio() {
    return false
  }
}
