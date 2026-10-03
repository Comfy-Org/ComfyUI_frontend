import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT = path.join(import.meta.dirname, 'check-adr-evil-merge.sh')
const temporaryDirectories: string[] = []

const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null'
}

// The script walks merge-commit history, so fixtures need a hermetic throwaway
// repo with real (non-shallow) history.
function tempGitRepo(): { dir: string; git: (...args: string[]) => string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-evil-merge-'))
  temporaryDirectories.push(dir)
  const env = { ...process.env, ...GIT_ENV }
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8', env })
  git('init', '--initial-branch=main')
  git('config', 'user.email', 'ci@example.com')
  git('config', 'user.name', 'CI')
  return { dir, git }
}

function write(dir: string, rel: string, contents: string): void {
  const filePath = path.join(dir, rel)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, contents)
}

function commitAll(
  git: (...args: string[]) => string,
  message: string
): string {
  git('add', '.')
  git('commit', '-m', message)
  return git('rev-parse', 'HEAD').trim()
}

function runScript(dir: string, base: string, head = 'HEAD') {
  return spawnSync('bash', [SCRIPT, base, head], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ...GIT_ENV }
  })
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe('check-adr-evil-merge', () => {
  // A guard that exits 0 while printing to stderr reads as a pass with a
  // warning, and nobody reads CI warnings. Exit status alone cannot tell the
  // two apart, so every clean case asserts silence as well.
  function expectSilentPass(result: ReturnType<typeof runScript>): void {
    expect({ status: result.status, stderr: result.stderr }).toEqual({
      status: 0,
      stderr: ''
    })
    expect(result.stdout).toBe('')
  }

  it('passes when the range has no merge commits', () => {
    const { dir, git } = tempGitRepo()
    write(dir, 'docs/adr/TOPIC-0001.md', '# adr\n')
    const base = commitAll(git, 'base')
    write(dir, 'src/index.ts', 'export {}\n')
    commitAll(git, 'ordinary commit adds an unrelated file')

    expectSilentPass(runScript(dir, base))
  })

  it('passes when the ADR arrived on a branch commit and the merge only integrates it', () => {
    const { dir, git } = tempGitRepo()
    write(dir, 'src/index.ts', 'export {}\n')
    const base = commitAll(git, 'base')
    git('checkout', '-b', 'feature')
    write(dir, 'docs/adr/TOPIC-0002.md', '# adr\n')
    commitAll(git, 'branch commit adds the ADR')
    git('checkout', 'main')
    git('merge', '--no-ff', '--no-edit', 'feature')

    expectSilentPass(runScript(dir, base))
  })

  it('fails when a merge commit introduces a docs/adr file present in neither parent', () => {
    const { dir, git } = tempGitRepo()
    write(dir, 'src/index.ts', 'export {}\n')
    commitAll(git, 'base')
    git('checkout', '-b', 'feature')
    write(dir, 'src/feature.ts', 'export {}\n')
    commitAll(git, 'branch commit')
    git('checkout', 'main')
    write(dir, 'src/main-drift.ts', 'export {}\n')
    const mainDrift = commitAll(git, 'main drifts independently')
    git('merge', '--no-ff', '--no-commit', 'feature')
    // Smuggle governance content into the merge itself: present in NEITHER parent.
    write(dir, 'docs/adr/TOPIC-0003-evil.md', '# smuggled\n')
    git('add', '.')
    git('commit', '-m', 'merge main and smuggle an ADR')

    const result = runScript(dir, mainDrift)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('docs/adr/TOPIC-0003-evil.md')
  })

  it('does not flag a merge that only resolves conflicts in files both parents already have', () => {
    const { dir, git } = tempGitRepo()
    write(dir, 'docs/adr/TOPIC-0004.md', '# adr\n')
    commitAll(git, 'base')
    git('checkout', '-b', 'feature')
    write(dir, 'docs/adr/TOPIC-0004.md', '# adr with branch edit\n')
    commitAll(git, 'branch edits the ADR')
    git('checkout', 'main')
    write(dir, 'docs/adr/TOPIC-0004.md', '# adr with main edit\n')
    const mainEdit = commitAll(git, 'main edits the ADR')
    expect(() => git('merge', '--no-ff', '--no-edit', 'feature')).toThrow()
    write(dir, 'docs/adr/TOPIC-0004.md', '# adr resolved\n')
    git('add', '.')
    git('commit', '--no-edit')

    expectSilentPass(runScript(dir, mainEdit))
  })

  it('is a no-op when the base is the all-zero new-branch sentinel', () => {
    const { dir, git } = tempGitRepo()
    write(dir, 'docs/adr/TOPIC-0005.md', '# adr\n')
    commitAll(git, 'base')

    expectSilentPass(runScript(dir, '0'.repeat(40)))
  })

  it('ignores a non-Markdown file smuggled into a merge', () => {
    const { dir, git } = tempGitRepo()
    write(dir, 'src/index.ts', 'export {}\n')
    commitAll(git, 'base')
    git('checkout', '-b', 'feature')
    write(dir, 'src/feature.ts', 'export {}\n')
    commitAll(git, 'branch commit')
    git('checkout', 'main')
    write(dir, 'src/main-drift.ts', 'export {}\n')
    const mainDrift = commitAll(git, 'main drifts independently')
    git('merge', '--no-ff', '--no-commit', 'feature')
    // The documented contract is `docs/adr/*.md`. A diagram is not governance
    // content taking zero review, and reporting it as an evil-merged ADR
    // teaches people to ignore the guard.
    write(dir, 'docs/adr/diagram.svg', '<svg />\n')
    git('add', '.')
    git('commit', '-m', 'merge main and add an asset')

    expectSilentPass(runScript(dir, mainDrift))
  })

  it('refuses to report a pass when the range cannot be resolved', () => {
    const { dir, git } = tempGitRepo()
    write(dir, 'docs/adr/TOPIC-0006.md', '# adr\n')
    commitAll(git, 'base')

    // What a force-push leaves in `github.event.before`: a real-looking sha
    // that no longer exists. Silently treating it as an empty range is the
    // one outcome the guard must never produce.
    const result = runScript(dir, 'f'.repeat(40))
    expect(result.status).not.toBe(0)
    expect(result.status).not.toBe(1)
    expect(result.stderr).toContain('cannot resolve the revision range')
  })
})
