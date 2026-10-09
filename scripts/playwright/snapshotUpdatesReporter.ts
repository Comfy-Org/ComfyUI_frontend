import fs from 'node:fs'
import path from 'node:path'

import type { Reporter, Suite, TestResult } from '@playwright/test/reporter'

type Attachment = TestResult['attachments'][number]

export interface HarvestableTest {
  titlePath(): string[]
  outcome(): 'skipped' | 'expected' | 'unexpected' | 'flaky'
  results: ReadonlyArray<{ attachments: ReadonlyArray<Attachment> }>
}

export interface SnapshotUpdate {
  snapshotPath: string
  actualPath: string
  test: string
}

const SNAPSHOT_ATTACHMENT = /^(.*)-(expected|actual|diff|previous)(\.[^.]+)?$/

function groupSnapshotAttachments(
  attachments: ReadonlyArray<Attachment>
): Map<string, Partial<Record<'expected' | 'actual', string>>> {
  const groups = new Map<
    string,
    Partial<Record<'expected' | 'actual', string>>
  >()
  for (const attachment of attachments) {
    if (!attachment.path) continue
    const match = attachment.name.match(SNAPSHOT_ATTACHMENT)
    if (!match) continue
    const [, prefix, kind, ext = ''] = match
    if (kind !== 'expected' && kind !== 'actual') continue
    const key = prefix + ext
    groups.set(key, { ...groups.get(key), [kind]: attachment.path })
  }
  return groups
}

function isInside(baseDir: string, filePath: string): boolean {
  const relative = path.relative(baseDir, filePath)
  return (
    relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
  )
}

export function collectSnapshotUpdates(
  tests: Iterable<HarvestableTest>,
  baseDir: string
): SnapshotUpdate[] {
  const updates: SnapshotUpdate[] = []
  for (const test of tests) {
    if (test.outcome() !== 'unexpected') continue
    const lastResult = test.results.at(-1)
    if (!lastResult) continue
    for (const group of groupSnapshotAttachments(
      lastResult.attachments
    ).values()) {
      if (!group.expected || !group.actual) continue
      if (!isInside(baseDir, group.expected)) continue
      updates.push({
        snapshotPath: path
          .relative(baseDir, group.expected)
          .split(path.sep)
          .join('/'),
        actualPath: group.actual,
        test: test.titlePath().filter(Boolean).join(' › ')
      })
    }
  }
  return updates
}

export default class SnapshotUpdatesReporter implements Reporter {
  private readonly baseDir: string
  private readonly outputDir: string
  private suite: Suite | undefined

  constructor(options: { outputDir?: string; configDir?: string } = {}) {
    this.baseDir = options.configDir ?? process.cwd()
    this.outputDir = path.resolve(
      this.baseDir,
      options.outputDir ?? 'snapshot-updates'
    )
  }

  onBegin(_config: unknown, suite: Suite) {
    this.suite = suite
    fs.rmSync(this.outputDir, { recursive: true, force: true })
  }

  onEnd() {
    const updates = collectSnapshotUpdates(
      this.suite?.allTests() ?? [],
      this.baseDir
    )
    if (updates.length === 0) return

    for (const update of updates) {
      const destination = path.join(this.outputDir, update.snapshotPath)
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      fs.copyFileSync(update.actualPath, destination)
    }
    fs.writeFileSync(
      path.join(this.outputDir, 'manifest.json'),
      JSON.stringify(
        updates.map(({ snapshotPath, test }) => ({ snapshotPath, test })),
        null,
        2
      )
    )
  }

  printsToStdio() {
    return false
  }
}
