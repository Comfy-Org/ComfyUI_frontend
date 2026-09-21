import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  disabledDeclarations,
  findViolations,
  hasRestorationReference
} from './check-disabled-test-tracking'

const temporaryDirectories: string[] = []

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

const write = (root: string, path: string, contents: string): void => {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, contents)
}

const commit = (root: string, message: string): string => {
  git(root, 'add', '-A')
  git(root, 'commit', '-qm', message)
  return git(root, 'rev-parse', 'HEAD')
}

const createRepository = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'disabled-test-tracking-'))
  temporaryDirectories.push(root)
  git(root, 'init', '-q', '--initial-branch=main')
  git(root, 'config', 'user.email', 'ci@example.com')
  git(root, 'config', 'user.name', 'CI')
  git(root, 'config', 'core.hooksPath', '/dev/null')
  git(root, 'config', 'commit.gpgsign', 'false')
  return root
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('disabled test tracking', () => {
  it('parses executable calls without treating source text as code', () => {
    const source =
      String.raw`
const regex = /test.skip('not code')/
const quoted = "describe.fixme('not code')"
const apostrophe = /it's/
const rendered = ` +
      "`${test.skip('inside interpolation', () => {})}`" +
      `
test.fixme('real declaration', () => {})
`

    expect(disabledDeclarations(source)).toEqual([
      { line: 5, relevantLines: [5] },
      { line: 6, relevantLines: [6] }
    ])
  })

  it('finds newly disabled tests through a real Git diff', () => {
    const root = createRepository()
    write(
      root,
      'tests/example.spec.ts',
      `test.skip('already disabled', () => {})

test.skip(
  isCloud,
  'runtime condition'
)

test(
  'existing test',
  () => {}
)
`
    )
    write(root, 'src/example.ts', 'export const active = true\n')
    const base = commit(root, 'base')

    write(
      root,
      'tests/example.spec.ts',
      `test.skip('already disabled', () => {})

test.skip(
  true,
  'runtime condition'
)

test.skip(
  'existing test',
  () => {}
)

const regex = /describe.fixme('not code')/
`
    )
    write(root, 'tests/café.spec.ts', `describe.fixme('new suite', () => {})\n`)
    write(
      root,
      'src/example.ts',
      `export const active = true\ntest.skip('not a test source', () => {})\n`
    )
    const head = commit(root, 'disable tests')

    expect(findViolations(root, base, head)).toEqual([
      "  tests/café.spec.ts:1: describe.fixme('new suite', () => {})",
      '  tests/example.spec.ts:3: test.skip(',
      '  tests/example.spec.ts:8: test.skip('
    ])
  })

  it.for([
    { body: 'Re-enabled by #12345', expected: true },
    {
      body: 'Test restoration tracked in https://linear.app/comfyorg/issue/FE-1234/fix-test',
      expected: true
    },
    {
      body: 'Restore test via https://github.com/Comfy-Org/ComfyUI_frontend/pull/123',
      expected: true
    },
    { body: 'Related work #12345', expected: false },
    { body: 'Restore test\n#12345', expected: false },
    {
      body: 'Test restoration tracked in https://linear.app/comfyorg',
      expected: false
    }
  ])('validates restoration tracking in $body', ({ body, expected }) => {
    expect(hasRestorationReference(body)).toBe(expected)
  })

  it('fails when Git cannot inspect the requested revision', () => {
    const root = createRepository()
    write(root, 'README.md', 'fixture\n')
    const head = commit(root, 'base')

    expect(() => findViolations(root, 'missing', head)).toThrow()
  })
})
