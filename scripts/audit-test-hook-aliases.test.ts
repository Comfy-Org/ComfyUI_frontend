import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, it, onTestFinished } from 'vitest'

it('reports hook-assigned alias candidates without changing the tests', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'hook-alias-audit-'))
  onTestFinished(() => rmSync(cwd, { recursive: true, force: true }))
  mkdirSync(join(cwd, 'src'))
  const file = join(cwd, 'src/example.test.ts')
  const source = `let alert
let refresh
let original
const fixed = 1
let initialized = 2
beforeEach(() => {
  alert = vi.mocked(useToastStore().addAlert)
  refresh = store.refresh
  original = globalThis.fetch
  initialized = 3
})
it('uses a local value', () => {
  let local
  local = store.refresh
})
let shadowed
describe('nested suite', () => {
  let shadowed
  beforeEach(() => {
    shadowed = useToastStore().addAlert
  })
})
`
  writeFileSync(file, source)
  execFileSync('git', ['init', '--quiet'], { cwd })
  execFileSync('git', ['add', 'src/example.test.ts'], { cwd })

  const output = execFileSync(
    process.execPath,
    [
      fileURLToPath(import.meta.resolve('tsx/cli')),
      resolve('scripts/audit-test-hook-aliases.ts')
    ],
    { cwd, encoding: 'utf8' }
  )

  expect(output.trim().split('\n')).toEqual([
    'direct-store-member\tsrc/example.test.ts:1\talert\tvi.mocked(useToastStore().addAlert)',
    'direct-store-member\tsrc/example.test.ts:18\tshadowed\tuseToastStore().addAlert',
    'derived-value\tsrc/example.test.ts:2\trefresh\tstore.refresh',
    'derived-value\tsrc/example.test.ts:3\toriginal\tglobalThis.fetch'
  ])
  expect(readFileSync(file, 'utf8')).toBe(source)
})
