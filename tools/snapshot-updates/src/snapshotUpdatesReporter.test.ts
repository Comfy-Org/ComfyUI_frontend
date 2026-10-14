import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'

const ROOT = join(import.meta.dirname, '../../..')
const REPORTER = join(import.meta.dirname, 'snapshotUpdatesReporter.ts')

const RED_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12P4z8AAAAMBAQAY3Y2wAAAAAElFTkSuQmCC'
const BLUE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12NgYPgPAAEDAQDZqt2zAAAAAElFTkSuQmCC'

const MIXED_SPEC = `
import { expect, test } from '@playwright/test'

const red = Buffer.from('${RED_PNG}', 'base64')

test('stale', () => expect(red).toMatchSnapshot('stale.png'))
test('shares the stale golden', () => expect(red).toMatchSnapshot('stale.png'))
test('missing', () => expect('created').toMatchSnapshot('missing.txt'))
test('nested golden', () =>
  expect('changed').toMatchSnapshot(['nested', 'second.txt']))
test('flaky', ({}, info) =>
  expect(info.retry === 0 ? 'bad' : 'same').toMatchSnapshot('flaky.txt'))
test('unrelated failure', () => expect(1).toBe(2))
test('expected failure', () => {
  test.fail()
  expect('new').toMatchSnapshot('expected-failure.txt')
})
`

const CLEAN_SPEC = `
import { expect, test } from '@playwright/test'

test('fresh', () => expect('same').toMatchSnapshot('fresh.txt'))
`

const SLOW_SPEC = `
import { test } from '@playwright/test'

test('quick', () => {})
test('slow', () => new Promise((resolve) => setTimeout(resolve, 10_000)))
`

const SNAPSHOTS: Record<string, string | Buffer> = {
  'stale.png': Buffer.from(BLUE_PNG, 'base64'),
  'nested/second.txt': 'old',
  'flaky.txt': 'same',
  'expected-failure.txt': 'old',
  'fresh.txt': 'same'
}

function readManifest(file: string): unknown {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined
}

function runSuite(spec: string, extraConfig = '') {
  const project = mkdtempSync(join(tmpdir(), 'snapshot-updates-'))
  onTestFinished(() => rmSync(project, { recursive: true, force: true }))
  symlinkSync(join(ROOT, 'node_modules'), join(project, 'node_modules'))
  writeFileSync(
    join(project, 'playwright.config.ts'),
    `export default { testDir: 'tests', retries: 1, workers: 1, snapshotPathTemplate: '{testDir}/{testFileName}-snapshots/{arg}{ext}'${extraConfig} }`
  )
  mkdirSync(join(project, 'tests/a.spec.ts-snapshots/nested'), {
    recursive: true
  })
  writeFileSync(join(project, 'tests/a.spec.ts'), spec)
  for (const [name, content] of Object.entries(SNAPSHOTS))
    writeFileSync(join(project, 'tests/a.spec.ts-snapshots', name), content)

  spawnSync(
    join(ROOT, 'node_modules/.bin/playwright'),
    ['test', `--reporter=${REPORTER}`],
    { cwd: project }
  )
  return {
    output: join(project, 'snapshot-updates'),
    manifest: readManifest(join(project, 'snapshot-updates/manifest.json'))
  }
}

describe('SnapshotUpdatesReporter', { timeout: 30_000 }, () => {
  it('copies the actual image of every snapshot that failed the final attempt onto its golden path', () => {
    const mixed = runSuite(MIXED_SPEC)
    expect(mixed.manifest).toEqual([
      'tests/a.spec.ts-snapshots/stale.png',
      'tests/a.spec.ts-snapshots/missing.txt',
      'tests/a.spec.ts-snapshots/nested/second.txt'
    ])
    expect(
      readFileSync(join(mixed.output, 'tests/a.spec.ts-snapshots/stale.png'))
    ).toEqual(Buffer.from(RED_PNG, 'base64'))
    expect(
      readFileSync(
        join(mixed.output, 'tests/a.spec.ts-snapshots/missing.txt'),
        'utf8'
      )
    ).toBe('created')
  })

  it('writes an empty manifest for a run without snapshot failures', () => {
    expect(runSuite(CLEAN_SPEC).manifest).toEqual([])
  })

  it.for([
    { name: 'timed out', spec: SLOW_SPEC, config: ', globalTimeout: 1_000' },
    {
      name: 'failed before any test ran',
      spec: CLEAN_SPEC,
      config: ", webServer: { command: 'exit 1', port: 9 }"
    }
  ])('writes no manifest for a run that $name', ({ spec, config }) => {
    expect(runSuite(spec, config).manifest).toBeUndefined()
  })
})
