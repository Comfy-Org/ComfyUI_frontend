import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'

import { expect, it, onTestFinished } from 'vitest'
import { isMap, isSeq, parseDocument } from 'yaml'

const ACTION = join(
  import.meta.dirname,
  '../../.github/actions/commit-snapshot-updates/action.yaml'
)

function mergeScript() {
  const steps = parseDocument(readFileSync(ACTION, 'utf8')).getIn([
    'runs',
    'steps'
  ])
  const step = isSeq(steps)
    ? steps.items.find(
        (item) => isMap(item) && item.get('name') === 'Merge snapshot updates'
      )
    : undefined
  return String(isMap(step) ? step.get('run') : '')
}

function writeFiles(root: string, files: Record<string, string>) {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), content)
  }
}

function listFiles(root: string) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)))
    .sort()
}

it('merges only snapshot PNGs, replacing goldens of the same size and mtime', () => {
  const root = mkdtempSync(join(tmpdir(), 'commit-snapshot-updates-'))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  const download = join(root, 'download')
  const checkout = join(root, 'checkout')
  const golden = 'browser_tests/tests/a.spec.ts-snapshots/stale.png'
  writeFiles(download, {
    [golden]: 'new',
    'browser_tests/tests/a.spec.ts-snapshots/nested/deep.png': 'new',
    'browser_tests/tests/a.spec.ts-snapshots/notes.txt': 'text',
    'browser_tests/fixtures/injected.ts': 'code',
    '.github/workflows/injected.yaml': 'workflow',
    'manifest.json': '[]'
  })
  writeFiles(checkout, { [golden]: 'old' })
  utimesSync(join(download, golden), 1_000_000, 1_000_000)
  utimesSync(join(checkout, golden), 1_000_000, 1_000_000)

  spawnSync('bash', ['-c', mergeScript()], {
    env: { ...process.env, CONFIG_DIR: checkout, DOWNLOAD_DIR: download }
  })

  expect(listFiles(checkout)).toEqual([
    'browser_tests/tests/a.spec.ts-snapshots/nested/deep.png',
    golden
  ])
  expect(readFileSync(join(checkout, golden), 'utf8')).toBe('new')
})
