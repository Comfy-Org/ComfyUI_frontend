import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SCRIPT = join(import.meta.dirname, 'select-pr-playwright-specs.sh')

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

const select = (cwd: string, baseSha: string, headSha: string) =>
  execFileSync('bash', [SCRIPT, baseSha, headSha], {
    cwd,
    encoding: 'utf8'
  }).trim()

const writeSpec = (root: string, path: string, title: string) => {
  mkdirSync(join(root, dirname(path)), { recursive: true })
  writeFileSync(join(root, path), `test(${JSON.stringify(title)}, () => {})\n`)
}

const commitAll = (root: string, message: string) => {
  git(root, 'add', '-A')
  git(root, 'commit', '-qm', message)
  return git(root, 'rev-parse', 'HEAD')
}

/**
 * Builds a throwaway repository whose `main` holds one commit, hands it to the
 * caller, and removes it afterwards.
 */
const withRepo = (run: (root: string, base: string) => void) => {
  const root = mkdtempSync(join(tmpdir(), 'playwright-spec-selector-'))
  try {
    git(root, 'init', '-q')
    git(root, 'config', 'user.email', 'ci@example.com')
    git(root, 'config', 'user.name', 'CI')
    git(root, 'config', 'core.hooksPath', '/dev/null')
    git(root, 'checkout', '-q', '-b', 'main')
    writeFileSync(join(root, 'README.md'), 'base\n')
    run(root, commitAll(root, 'base'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('select-pr-playwright-specs.sh', () => {
  it('is called with the pull request head SHA by the video workflow', () => {
    const workflow = readFileSync('.github/workflows/ci-tests-e2e.yaml', 'utf8')

    expect(workflow).toContain(
      'HEAD_SHA: ${{ github.event.pull_request.head.sha }}'
    )
    expect(workflow).toContain(
      'select-pr-playwright-specs.sh "$BASE_SHA" "$HEAD_SHA"'
    )
  })

  it('diffs the immutable PR head instead of the synthetic merge checkout', () => {
    withRepo((root, base) => {
      git(root, 'checkout', '-q', '-b', 'pr')
      writeSpec(root, 'browser_tests/tests/pr/actual.spec.ts', 'actual')
      const head = commitAll(root, 'PR spec')

      git(root, 'checkout', '-q', 'main')
      writeSpec(root, 'browser_tests/tests/main/unrelated.spec.ts', 'unrelated')
      commitAll(root, 'incoming main spec')
      git(root, 'merge', '--no-ff', '-qm', 'synthetic merge', 'pr')

      expect(git(root, 'cat-file', '-t', base)).toBe('commit')
      expect(git(root, 'cat-file', '-t', head)).toBe('commit')
      expect(select(root, base, head)).toBe(
        'browser_tests/tests/pr/actual.spec.ts'
      )
    })
  })

  it('selects a spec the pull request only modified', () => {
    withRepo((root) => {
      writeSpec(root, 'browser_tests/tests/pr/existing.spec.ts', 'before')
      const base = commitAll(root, 'existing spec')

      writeSpec(root, 'browser_tests/tests/pr/existing.spec.ts', 'after')
      const head = commitAll(root, 'strengthen the assertion')

      expect(select(root, base, head)).toBe(
        'browser_tests/tests/pr/existing.spec.ts'
      )
    })
  })

  it('selects a renamed spec under its new path only', () => {
    withRepo((root) => {
      writeSpec(root, 'browser_tests/tests/pr/old.spec.ts', 'moved')
      const base = commitAll(root, 'spec at its old path')

      git(
        root,
        'mv',
        'browser_tests/tests/pr/old.spec.ts',
        'browser_tests/tests/pr/new.spec.ts'
      )
      const head = commitAll(root, 'move the spec')

      expect(select(root, base, head)).toBe(
        'browser_tests/tests/pr/new.spec.ts'
      )
    })
  })

  it('selects nothing when the pull request changes no spec', () => {
    withRepo((root, base) => {
      mkdirSync(join(root, 'src'), { recursive: true })
      writeFileSync(join(root, 'src/thing.ts'), 'export const thing = 1\n')
      const head = commitAll(root, 'source-only change')

      // Without this the empty selection could equally mean an empty range.
      expect(git(root, 'diff', '--name-only', `${base}...${head}`)).toBe(
        'src/thing.ts'
      )
      expect(select(root, base, head)).toBe('')
    })
  })

  it('fails loudly when a required commit is missing from the checkout', () => {
    withRepo((root, base) => {
      const absent = '0'.repeat(40)
      expect(git(root, 'cat-file', '-t', base)).toBe('commit')

      let failure: { status?: number; stderr?: string } | undefined
      try {
        select(root, base, absent)
      } catch (error) {
        failure = error as { status?: number; stderr?: string }
      }

      expect(failure?.status).toBeGreaterThan(0)
      expect(failure?.stderr).toContain(
        `Required PR commit is not available: ${absent}`
      )
    })
  })
})
