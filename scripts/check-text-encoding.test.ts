import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { findNulByte, formatOffences, isTextPath } from './check-text-encoding'

const encoder = new TextEncoder()
const NUL = String.fromCodePoint(0)

function bytes(text: string): Uint8Array {
  return encoder.encode(text)
}

describe('check-text-encoding', () => {
  describe('findNulByte', () => {
    it('finds a NUL and reports the line it sits on', () => {
      const source = `const a = 1\nconst b = '${NUL}'\n`

      expect(findNulByte('a.ts', bytes(source))).toEqual({
        path: 'a.ts',
        line: 2,
        byte: 0,
        offset: source.indexOf(NUL)
      })
    })

    it('finds a NUL past the 8000 bytes git itself inspects', () => {
      // Git's binary heuristic only reads the first 8000 bytes, so a file
      // like this one still renders as a reviewable diff while breaking greps
      // and editors. That is why this check reads whole files rather than
      // trusting git's verdict.
      const padding = `// ${'x'.repeat(78)}\n`.repeat(120)
      const source = `${padding}const sep = '${NUL}'\n`
      expect(bytes(source).length).toBeGreaterThan(8000)

      expect(findNulByte('late.ts', bytes(source))?.line).toBe(121)
    })

    it('accepts a unicode escape written as text, which is the fix', () => {
      const source = "const sep = '\\u0000'\n"

      expect(findNulByte('a.ts', bytes(source))).toBeUndefined()
    })

    it('accepts tabs, newlines, carriage returns and form feeds', () => {
      const source = '\tconst a = 1\r\n\fconst b = 2\n'

      expect(findNulByte('a.ts', bytes(source))).toBeUndefined()
    })

    it.for([
      ['an escape, as ANSI colour-width tests embed', 0x1b],
      ['a vertical tab', 0x0b],
      ['a bell', 0x07],
      ['DEL', 0x7f]
    ] as const)('accepts %s, which git still diffs', ([, byte]) => {
      // Deliberately narrow. Only NUL costs a file its diff, and a real
      // in-tree file (`tools/test-recorder/src/ui/logger.test.ts`) embeds a
      // raw ESC on purpose — flagging the whole C0 range would fail it.
      const source = `const a = '${String.fromCodePoint(byte)}'`

      expect(findNulByte('a.ts', bytes(source))).toBeUndefined()
    })

    it('accepts non-ASCII text', () => {
      const source = '// em dash — and an emoji 🎛\n'

      expect(findNulByte('a.ts', bytes(source))).toBeUndefined()
    })

    it('accepts an empty file', () => {
      expect(findNulByte('a.ts', bytes(''))).toBeUndefined()
    })
  })

  describe('isTextPath', () => {
    it.for(['src/a.ts', 'src/A.vue', 'docs/b.md', 'c.yaml', 'd.json'] as const)(
      'checks %s',
      (path) => {
        expect(isTextPath(path)).toBe(true)
      }
    )

    it.for(['logo.png', 'font.woff2', 'clip.mp4', 'noext'] as const)(
      'skips %s',
      (path) => {
        expect(isTextPath(path)).toBe(false)
      }
    )
  })

  describe('formatOffences', () => {
    it('names the file, the line, the byte and the remedy', () => {
      const message = formatOffences([
        { path: 'src/a.ts', line: 17, byte: 0, offset: 632 }
      ])

      expect(message).toContain('src/a.ts:17')
      expect(message).toContain('byte 0x00 at offset 632')
      expect(message).toContain('unicode escape')
    })
  })
})

/**
 * The CLI, exercised against a real repository.
 *
 * The helper cases above never reach `checkPaths`, so they cannot see which
 * bytes it reads, which paths it finds, or what it does when git fails. Each
 * row here is the falsifier for one of those.
 */
describe.skipIf(process.platform === 'win32')('the CLI', () => {
  const scriptPath = join(
    dirname(fileURLToPath(import.meta.url)),
    'check-text-encoding.ts'
  )
  const tsxPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'node_modules',
    '.bin',
    'tsx'
  )
  let repo: string

  function git(...args: string[]): void {
    execFileSync('git', args, { cwd: repo, stdio: 'pipe' })
  }

  function write(path: string, contents: string): void {
    const absolute = join(repo, path)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, contents)
  }

  function run(
    args: readonly string[] = [],
    env: NodeJS.ProcessEnv = {}
  ): { status: number | null; stderr: string } {
    const result = spawnSync(tsxPath, [scriptPath, ...args], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, ...env }
    })
    return { status: result.status, stderr: result.stderr }
  }

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'nul-byte-guard-'))
    git('init', '--quiet')
    git('config', 'user.email', 'guard@example.test')
    git('config', 'user.name', 'Guard')
    git('config', 'commit.gpgsign', 'false')
  })

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('passes a repository with no NUL in it', () => {
    write('src/a.ts', "const sep = '\\u0000'\n")
    git('add', '.')

    expect(run().status).toBe(0)
    expect(run(['--all']).status).toBe(0)
  })

  it('judges the staged bytes, not the worktree copy', () => {
    // The whole point of a pre-commit hook: a NUL staged and then corrected
    // in the worktree is still a NUL in the commit. Reading the file from
    // disk here reports success on a commit that carries the defect.
    write('src/a.ts', `const sep = '${NUL}'\n`)
    git('add', 'src/a.ts')
    write('src/a.ts', "const sep = '\\u0000'\n")

    const { status, stderr } = run()

    expect(status).toBe(1)
    expect(stderr).toContain('src/a.ts')
  })

  it('does not fail a commit for an unstaged NUL', () => {
    write('src/a.ts', "const sep = '\\u0000'\n")
    git('add', 'src/a.ts')
    git('commit', '--quiet', '-m', 'clean')
    write('src/a.ts', `const sep = '${NUL}'\n`)

    expect(run().status).toBe(0)
  })

  it('checks a path git would quote', () => {
    // Git quotes a non-ASCII name as `"review-\303\251.ts"`, and the trailing
    // quote costs it its extension, so an extension filter run over
    // newline-delimited output skips the file entirely.
    write('src/review-é.ts', `const sep = '${NUL}'\n`)
    git('add', '.')

    expect(run().status).toBe(1)
    expect(run(['--all']).status).toBe(1)
  })

  it('checks a path containing a newline', () => {
    // Newline-delimited output splits this name into two paths, neither of
    // which exists.
    write('src/split\nname.ts', `const sep = '${NUL}'\n`)
    git('add', '.')

    expect(run().status).toBe(1)
    expect(run(['--all']).status).toBe(1)
  })

  it('fails rather than reporting nothing when git cannot run', () => {
    // A check that could not scan must not look like a check that found
    // nothing: in CI that turns the step green over an unscanned tree.
    const binDir = join(repo, 'fake-bin')
    mkdirSync(binDir)
    const fakeGit = join(binDir, 'git')
    writeFileSync(fakeGit, '#!/bin/sh\necho "fatal: broken" >&2\nexit 128\n')
    chmodSync(fakeGit, 0o755)

    const { status, stderr } = run(['--all'], {
      PATH: `${binDir}:${process.env.PATH ?? ''}`
    })

    expect(status).toBe(1)
    expect(stderr).toContain('Text-encoding check failed')
  })

  it('fails outside a repository rather than passing vacuously', () => {
    const outside = mkdtempSync(join(tmpdir(), 'nul-byte-guard-bare-'))
    const previous = repo
    repo = outside
    try {
      expect(run().status).toBe(1)
      expect(run(['--all']).status).toBe(1)
    } finally {
      repo = previous
      rmSync(outside, { recursive: true, force: true })
    }
  })
})
