import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SCRIPT = join(import.meta.dirname, 'select-pr-playwright-specs.sh')

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

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
    const root = mkdtempSync(join(tmpdir(), 'playwright-spec-selector-'))
    try {
      git(root, 'init', '-q')
      git(root, 'config', 'user.email', 'ci@example.com')
      git(root, 'config', 'user.name', 'CI')
      git(root, 'config', 'core.hooksPath', '/dev/null')
      git(root, 'checkout', '-q', '-b', 'main')
      writeFileSync(join(root, 'README.md'), 'base\n')
      git(root, 'add', '.')
      git(root, 'commit', '-qm', 'base')
      const base = git(root, 'rev-parse', 'HEAD')

      git(root, 'checkout', '-q', '-b', 'pr')
      execFileSync('mkdir', ['-p', join(root, 'browser_tests/tests/pr')])
      writeFileSync(
        join(root, 'browser_tests/tests/pr/actual.spec.ts'),
        'test("actual", () => {})\n'
      )
      git(root, 'add', '.')
      git(root, 'commit', '-qm', 'PR spec')
      const head = git(root, 'rev-parse', 'HEAD')

      git(root, 'checkout', '-q', 'main')
      execFileSync('mkdir', ['-p', join(root, 'browser_tests/tests/main')])
      writeFileSync(
        join(root, 'browser_tests/tests/main/unrelated.spec.ts'),
        'test("unrelated", () => {})\n'
      )
      git(root, 'add', '.')
      git(root, 'commit', '-qm', 'incoming main spec')
      git(root, 'merge', '--no-ff', '-qm', 'synthetic merge', 'pr')

      expect(git(root, 'cat-file', '-t', base)).toBe('commit')
      expect(git(root, 'cat-file', '-t', head)).toBe('commit')
      expect(
        execFileSync('bash', [SCRIPT, base, head], {
          cwd: root,
          encoding: 'utf8'
        }).trim()
      ).toBe('browser_tests/tests/pr/actual.spec.ts')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
