import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SCRIPT = path.join(import.meta.dirname, 'check-adr-links.sh')

const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null'
}

const adrPath = (fileName: string): string => `docs/adr/${fileName}`

// The script scans via `git grep`, so fixtures need a hermetic throwaway repo.
function tempGitRepo(): { dir: string; git: (...args: string[]) => string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-links-'))
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

function runScript(dir: string) {
  return spawnSync('bash', [SCRIPT], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ...GIT_ENV }
  })
}

describe('check-adr-links', () => {
  it('passes when every referenced docs/adr path exists', () => {
    const { dir, git } = tempGitRepo()
    const realAdr = adrPath('CRDT-TEST-0001-real.md')
    write(dir, realAdr, '# real\n')
    write(dir, 'AGENTS.md', `see [x](${realAdr})\n`)
    git('add', '.')
    git('commit', '-m', 'fixture')

    const result = runScript(dir)
    expect(result.status).toBe(0)
  })

  it('fails and names the referencing file and the dangling path', () => {
    const { dir, git } = tempGitRepo()
    const realAdr = adrPath('CRDT-TEST-0001-real.md')
    const danglingAdr = adrPath('FOLLOWER-guessed-name.md')
    write(dir, realAdr, '# real\n')
    write(dir, '.agents/checks/guard.md', `required context: ${danglingAdr}\n`)
    git('add', '.')
    git('commit', '-m', 'fixture')

    const result = runScript(dir)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('.agents/checks/guard.md')
    expect(result.stderr).toContain(danglingAdr)
  })

  it('ignores non-adr markdown references', () => {
    const { dir, git } = tempGitRepo()
    write(dir, 'docs/architecture/ecs.md', '# ecs\n')
    write(
      dir,
      'README.md',
      'see docs/architecture/ecs.md and docs/NOT-AN-ADR.md\n'
    )
    git('add', '.')
    git('commit', '-m', 'fixture')

    const result = runScript(dir)
    expect(result.status).toBe(0)
  })

  it('passes on the real repository (every tracked docs/adr reference resolves)', () => {
    const repoRoot = path.resolve(import.meta.dirname, '..', '..')
    const result = runScript(repoRoot)
    if (result.status !== 0) {
      throw new Error(
        `dangling ADR refs on the current tree:\n${result.stderr}`
      )
    }
  })
})
