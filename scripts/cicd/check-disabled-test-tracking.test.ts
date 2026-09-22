import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  disabledDeclarations,
  findViolations,
  hasRestorationReference,
  main
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

  it.for([
    { path: 'example.spec.jsx', declaration: 'test.skip' },
    { path: 'example.test.tsx', declaration: 'test.fixme' }
  ])('parses disabled calls inside $path JSX', ({ path, declaration }) => {
    const source = `const element = <>{${declaration}('disabled', () => {})}</>`

    expect(disabledDeclarations(source, path)).toEqual([
      { line: 1, relevantLines: [1] }
    ])
  })

  it('parses chainable parameterized declarations once', () => {
    const source = `it.skip.each([1, 2])('disabled %s', () => {})`

    expect(disabledDeclarations(source)).toEqual([
      { line: 1, relevantLines: [1] }
    ])
  })

  it('parses static computed test modifiers', () => {
    const source = `
test['skip']('disabled', () => {})
test[\`fixme\`]('also disabled', () => {})
test['describe']['skip']('disabled suite', () => {})
test[modifier]('dynamic property', () => {})
`

    expect(disabledDeclarations(source)).toEqual([
      { line: 2, relevantLines: [2] },
      { line: 3, relevantLines: [3] },
      { line: 4, relevantLines: [4] }
    ])
  })

  it('parses a parenthesized literal true condition as disabled', () => {
    const source = `test.skip((true), 'disabled', () => {})`

    expect(disabledDeclarations(source)).toEqual([
      { line: 1, relevantLines: [1] }
    ])
  })

  it.for([
    {
      declaration: `test.skipIf(true)('disabled', () => {})`,
      relevantLines: [1]
    },
    {
      declaration: `it.runIf(false)('disabled', () => {})`,
      relevantLines: [1]
    },
    {
      declaration: `suite.skipIf(\n  true\n)('disabled suite', () => {})`,
      relevantLines: [1, 2]
    }
  ])(
    'parses statically disabled conditional declaration: $declaration',
    ({ declaration, relevantLines }) => {
      expect(disabledDeclarations(declaration)).toEqual([
        { line: 1, relevantLines }
      ])
    }
  )

  it.for([
    `test.skipIf(false)('enabled', () => {})`,
    `test.skipIf(isCloud)('runtime condition', () => {})`,
    `test.runIf(true)('enabled', () => {})`
  ])('ignores non-static conditional declaration: %s', (declaration) => {
    expect(disabledDeclarations(declaration)).toEqual([])
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
test['skip']('computed modifier', () => {})
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
      '  tests/example.spec.ts:8: test.skip(',
      "  tests/example.spec.ts:14: test['skip']('computed modifier', () => {})"
    ])
  })

  it('finds a disabled test with an interpolated title', () => {
    const root = createRepository()
    write(root, 'tests/example.test.ts', `const variant = 'fast'\n`)
    const base = commit(root, 'base')

    write(
      root,
      'tests/example.test.ts',
      [
        "const variant = 'fast'",
        'test.skip(`case ${variant}`, () => {})',
        ''
      ].join('\n')
    )
    const head = commit(root, 'disable interpolated test')

    expect(findViolations(root, base, head)).toEqual([
      '  tests/example.test.ts:2: test.skip(`case ${variant}`, () => {})'
    ])
  })

  it.for([
    {
      enabled: `it.each([1, 2])('case %s', () => {})\n`,
      disabled: `it.skip.each([1, 2])('case %s', () => {})\n`
    },
    {
      enabled: `test.for([['a', 1]])('case %s', () => {})\n`,
      disabled: `test.skip.for([['a', 1]])('case %s', () => {})\n`
    }
  ])('finds a parameterized test changed to skip', ({ enabled, disabled }) => {
    const root = createRepository()
    write(root, 'tests/example.test.ts', enabled)
    const base = commit(root, 'base')

    write(root, 'tests/example.test.ts', disabled)
    const head = commit(root, 'disable parameterized test')

    expect(findViolations(root, base, head)).toEqual([
      `  tests/example.test.ts:1: ${disabled.trim()}`
    ])
  })

  it.for([
    {
      enabled: `test.skipIf(false)('case', () => {})\n`,
      disabled: `test.skipIf(true)('case', () => {})\n`
    },
    {
      enabled: `suite.runIf(true)('case', () => {})\n`,
      disabled: `suite.runIf(false)('case', () => {})\n`
    }
  ])(
    'finds a conditional declaration changed to disabled',
    ({ enabled, disabled }) => {
      const root = createRepository()
      write(root, 'tests/example.test.ts', enabled)
      const base = commit(root, 'base')

      write(root, 'tests/example.test.ts', disabled)
      const head = commit(root, 'disable conditional test')

      expect(findViolations(root, base, head)).toEqual([
        `  tests/example.test.ts:1: ${disabled.trim()}`
      ])
    }
  )

  it('ignores title and formatting edits to disabled tests', () => {
    const root = createRepository()
    write(
      root,
      'tests/example.spec.ts',
      `test.skip('old title', () => {})
test.fixme('formatted test', () => {})
`
    )
    const base = commit(root, 'base')

    write(
      root,
      'tests/example.spec.ts',
      `test.skip('new title', () => {})
test.fixme(
  'formatted test',
  () => {}
)
`
    )
    const head = commit(root, 'edit disabled tests')

    expect(findViolations(root, base, head)).toEqual([])
  })

  it('finds an appended disabled test with the same title', () => {
    const root = createRepository()
    write(
      root,
      'tests/example.spec.ts',
      `test.skip('duplicate title', () => existingFixture())\n`
    )
    const base = commit(root, 'base')

    write(
      root,
      'tests/example.spec.ts',
      `test.skip('duplicate title', () => existingFixture())
test.skip('duplicate title', () => newFixture())
`
    )
    const head = commit(root, 'append duplicate title')

    expect(findViolations(root, base, head)).toEqual([
      "  tests/example.spec.ts:2: test.skip('duplicate title', () => newFixture())"
    ])
  })

  it('finds a prepended disabled test before an existing disabled test', () => {
    const root = createRepository()
    write(
      root,
      'tests/example.spec.ts',
      `test.skip('existing test', () => existingFixture())\n`
    )
    const base = commit(root, 'base')

    write(
      root,
      'tests/example.spec.ts',
      `test.skip('new test', () => newFixture())
test.skip('existing test', () => existingFixture())
`
    )
    const head = commit(root, 'prepend disabled test')

    expect(findViolations(root, base, head)).toEqual([
      "  tests/example.spec.ts:1: test.skip('new test', () => newFixture())"
    ])
  })

  it('finds a prepended disabled test with the same title and context', () => {
    const root = createRepository()
    write(
      root,
      'tests/example.spec.ts',
      `test.skip('duplicate title', () => sameFixture())\n`
    )
    const base = commit(root, 'base')

    write(
      root,
      'tests/example.spec.ts',
      `test.skip('duplicate title', () => sameFixture())
test.skip('duplicate title', () => sameFixture())
`
    )
    const head = commit(root, 'prepend duplicate title')

    expect(findViolations(root, base, head)).toEqual([
      "  tests/example.spec.ts:2: test.skip('duplicate title', () => sameFixture())"
    ])
  })

  it('compares renamed tests with their base path', () => {
    const root = createRepository()
    write(
      root,
      'tests/old-name.spec.ts',
      `test.skip('already disabled', () => {})
test('still enabled one', () => {})
test('still enabled two', () => {})
test('newly disabled', () => {})
`
    )
    const base = commit(root, 'base')

    write(
      root,
      'tests/new-name.spec.ts',
      `test.skip(
  'already disabled',
  () => {}
)
test('still enabled one', () => {})
test('still enabled two', () => {})
test.skip('newly disabled', () => {})
`
    )
    rmSync(join(root, 'tests/old-name.spec.ts'))
    const head = commit(root, 'rename and disable test')

    expect(findViolations(root, base, head)).toEqual([
      "  tests/new-name.spec.ts:7: test.skip('newly disabled', () => {})"
    ])
  })

  it('compares against the merge base when the target branch advances', () => {
    const root = createRepository()
    write(root, 'tests/example.spec.ts', `test('example', () => {})\n`)
    commit(root, 'common ancestor')

    git(root, 'switch', '-qc', 'feature')
    write(root, 'tests/example.spec.ts', `test.skip('example', () => {})\n`)
    const head = commit(root, 'disable test on feature')

    git(root, 'switch', '-q', 'main')
    write(root, 'tests/example.spec.ts', `test.skip('example', () => {})\n`)
    const base = commit(root, 'disable test independently on main')

    expect(findViolations(root, base, head)).toEqual([
      "  tests/example.spec.ts:1: test.skip('example', () => {})"
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

  it('returns failure statuses for untracked disables and Git errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const root = createRepository()
    write(root, 'tests/example.test.ts', `test('example', () => {})\n`)
    const base = commit(root, 'base')
    write(root, 'tests/example.test.ts', `test.skip('example', () => {})\n`)
    const head = commit(root, 'disable test')

    expect(main([base, head], root, '')).toBe(1)
    expect(main(['missing', head], root, '')).toBe(2)
  })
})
