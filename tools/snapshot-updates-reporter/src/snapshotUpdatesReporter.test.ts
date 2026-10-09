import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '../../..')
const REPORTER = join(import.meta.dirname, 'snapshotUpdatesReporter.ts')

const SPEC = `
import { expect, test } from '@playwright/test'

test('stale', () => expect('new').toMatchSnapshot('stale.txt'))
test('missing', () => expect('created').toMatchSnapshot('missing.txt'))
test('one stale of two', () => {
  expect.soft('same').toMatchSnapshot('fresh.txt')
  expect.soft('changed').toMatchSnapshot(['nested', 'second.txt'])
})
test('flaky', ({}, info) =>
  expect(info.retry === 0 ? 'bad' : 'same').toMatchSnapshot('flaky.txt'))
test('unrelated failure', () => expect(1).toBe(2))
test('expected failure', () => {
  test.fail()
  expect('new').toMatchSnapshot('expected-failure.txt')
})
`

const SNAPSHOTS: Record<string, string> = {
  'stale.txt': 'old',
  'fresh.txt': 'same',
  'nested/second.txt': 'old',
  'flaky.txt': 'same',
  'expected-failure.txt': 'old'
}

function runSuite() {
  const project = mkdtempSync(join(tmpdir(), 'snapshot-updates-'))
  symlinkSync(join(ROOT, 'node_modules'), join(project, 'node_modules'))
  writeFileSync(
    join(project, 'playwright.config.ts'),
    `export default { testDir: 'tests', retries: 1, snapshotPathTemplate: '{testDir}/{testFileName}-snapshots/{arg}{ext}' }`
  )
  mkdirSync(join(project, 'tests/a.spec.ts-snapshots/nested'), {
    recursive: true
  })
  writeFileSync(join(project, 'tests/a.spec.ts'), SPEC)
  for (const [name, content] of Object.entries(SNAPSHOTS))
    writeFileSync(join(project, 'tests/a.spec.ts-snapshots', name), content)

  spawnSync(
    join(ROOT, 'node_modules/.bin/playwright'),
    ['test', `--reporter=${REPORTER}`],
    { cwd: project, encoding: 'utf8' }
  )
  return project
}

describe('SnapshotUpdatesReporter', () => {
  const project = runSuite()
  const output = join(project, 'snapshot-updates')
  afterAll(() => rmSync(project, { recursive: true, force: true }))

  it('copies the actual image of every snapshot that failed the final attempt onto its golden path', () => {
    const manifest: { snapshotPath: string }[] = JSON.parse(
      readFileSync(join(output, 'manifest.json'), 'utf8')
    )

    expect(manifest.map((entry) => entry.snapshotPath).sort()).toEqual([
      'tests/a.spec.ts-snapshots/missing.txt',
      'tests/a.spec.ts-snapshots/nested/second.txt',
      'tests/a.spec.ts-snapshots/stale.txt'
    ])
    expect(
      readFileSync(join(output, 'tests/a.spec.ts-snapshots/stale.txt'), 'utf8')
    ).toBe('new')
    expect(
      readFileSync(
        join(output, 'tests/a.spec.ts-snapshots/missing.txt'),
        'utf8'
      )
    ).toBe('created')
  })
})
