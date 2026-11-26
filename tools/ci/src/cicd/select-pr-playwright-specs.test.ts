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

const select = (
  cwd: string,
  baseSha: string,
  headSha: string,
  defaultBranchRef?: string
) =>
  execFileSync('bash', [SCRIPT, baseSha, headSha], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, DEFAULT_BRANCH_REF: defaultBranchRef ?? '' }
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
    const workflow = readFileSync(
      '.github/workflows/ci-playwright-videos.yaml',
      'utf8'
    )

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

  it('skips a spec the stale base is merely missing from the default branch', () => {
    withRepo((root, firstMain) => {
      git(root, 'checkout', '-q', '-b', 'teammate', firstMain)
      writeSpec(root, 'browser_tests/tests/pr/carried.spec.ts', 'carried')
      const base = commitAll(root, 'teammate spec')

      git(root, 'checkout', '-q', 'main')
      writeSpec(root, 'browser_tests/tests/main/elsewhere.spec.ts', 'elsewhere')
      commitAll(root, 'unrelated main spec')

      git(root, 'checkout', '-q', '-b', 'reconcile', base)
      git(root, 'merge', '--no-ff', '-qm', 'merge main', 'main')
      writeSpec(root, 'browser_tests/tests/pr/mine.spec.ts', 'mine')
      const head = commitAll(root, 'spec this PR authored')

      const unfiltered = select(root, base, head).split('\n')
      expect(
        unfiltered,
        'without the default branch ref the stale base carries main’s spec'
      ).toEqual(
        expect.arrayContaining([
          'browser_tests/tests/main/elsewhere.spec.ts',
          'browser_tests/tests/pr/mine.spec.ts'
        ])
      )
      expect(unfiltered).toHaveLength(2)
      expect(select(root, base, head, 'main')).toBe(
        'browser_tests/tests/pr/mine.spec.ts'
      )
    })
  })

  it('keeps a spec the pull request changed away from the default branch', () => {
    withRepo((root) => {
      writeSpec(root, 'browser_tests/tests/pr/existing.spec.ts', 'before')
      const base = commitAll(root, 'existing spec')

      git(root, 'checkout', '-q', '-b', 'pr')
      writeSpec(root, 'browser_tests/tests/pr/existing.spec.ts', 'after')
      const head = commitAll(root, 'strengthen the assertion')

      expect(select(root, base, head, 'main')).toBe(
        'browser_tests/tests/pr/existing.spec.ts'
      )
    })
  })

  it('still skips a carried spec the default branch changed after the merge', () => {
    withRepo((root, firstMain) => {
      git(root, 'checkout', '-q', '-b', 'teammate', firstMain)
      writeFileSync(join(root, 'teammate.txt'), 'work\n')
      const base = commitAll(root, 'teammate commit')

      git(root, 'checkout', '-q', 'main')
      writeSpec(root, 'browser_tests/tests/main/elsewhere.spec.ts', 'elsewhere')
      commitAll(root, 'unrelated main spec')

      git(root, 'checkout', '-q', '-b', 'reconcile', base)
      git(root, 'merge', '--no-ff', '-qm', 'merge main', 'main')
      const head = git(root, 'rev-parse', 'HEAD')

      git(root, 'checkout', '-q', 'main')
      writeSpec(root, 'browser_tests/tests/main/elsewhere.spec.ts', 'revised')
      commitAll(root, 'main revises its own spec after the merge')

      expect(
        select(root, base, head, 'main'),
        'the branch tip would resurrect this spec; the default branch commit the head contains does not'
      ).toBe('')
    })
  })

  it('ignores a default branch ref that does not resolve', () => {
    withRepo((root, base) => {
      writeSpec(root, 'browser_tests/tests/pr/actual.spec.ts', 'actual')
      const head = commitAll(root, 'PR spec')

      expect(select(root, base, head, 'origin/nonexistent')).toBe(
        'browser_tests/tests/pr/actual.spec.ts'
      )
    })
  })

  it('passes the default branch ref from the video workflow', () => {
    const workflow = readFileSync(
      '.github/workflows/ci-playwright-videos.yaml',
      'utf8'
    )

    expect(workflow).toContain(
      'DEFAULT_BRANCH_REF: origin/${{ github.event.pull_request.base.repo.default_branch }}'
    )
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
