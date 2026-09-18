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
  dir: string,
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
  it('passes when the range has no merge commits', () => {
    const { dir, git } = tempGitRepo()
    write(dir, 'docs/adr/TOPIC-0001.md', '# adr\n')
    const base = commitAll(dir, git, 'base')
    write(dir, 'src/index.ts', 'export {}\n')
    commitAll(dir, git, 'ordinary commit adds an unrelated file')

    const result = runScript(dir, base)
    expect(result.status).toBe(0)
  })

  it('passes when the ADR arrived on a branch commit and the merge only integrates it', () => {
    const { dir, git } = tempGitRepo()
    write(dir, 'src/index.ts', 'export {}\n')
    const base = commitAll(dir, git, 'base')
    git('checkout', '-b', 'feature')
    write(dir, 'docs/adr/TOPIC-0002.md', '# adr\n')
    commitAll(dir, git, 'branch commit adds the ADR')
    git('checkout', 'main')
    git('merge', '--no-ff', '--no-edit', 'feature')

    const result = runScript(dir, base)
    expect(result.status).toBe(0)
  })

  it('fails when a merge commit introduces a docs/adr file present in neither parent', () => {
    const { dir, git } = tempGitRepo()
    write(dir, 'src/index.ts', 'export {}\n')
    commitAll(dir, git, 'base')
    git('checkout', '-b', 'feature')
    write(dir, 'src/feature.ts', 'export {}\n')
    commitAll(dir, git, 'branch commit')
    git('checkout', 'main')
    write(dir, 'src/main-drift.ts', 'export {}\n')
    const mainDrift = commitAll(dir, git, 'main drifts independently')
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
    commitAll(dir, git, 'base')
    git('checkout', '-b', 'feature')
    write(dir, 'docs/adr/TOPIC-0004.md', '# adr with branch edit\n')
    commitAll(dir, git, 'branch edits the ADR')
    git('checkout', 'main')
    write(dir, 'docs/adr/TOPIC-0004.md', '# adr with main edit\n')
    const mainEdit = commitAll(dir, git, 'main edits the ADR')
    expect(() => git('merge', '--no-ff', '--no-edit', 'feature')).toThrow()
    write(dir, 'docs/adr/TOPIC-0004.md', '# adr resolved\n')
    git('add', '.')
    git('commit', '--no-edit')

    const result = runScript(dir, mainEdit)
    expect(result.status).toBe(0)
  })

  it('is a no-op when the base is the all-zero new-branch sentinel', () => {
    const { dir, git } = tempGitRepo()
    write(dir, 'docs/adr/TOPIC-0005.md', '# adr\n')
    commitAll(dir, git, 'base')

    const result = runScript(dir, '0'.repeat(40))
    expect(result.status).toBe(0)
  })
})
