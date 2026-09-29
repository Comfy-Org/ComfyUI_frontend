import { execFileSync, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { expect, it, onTestFinished } from 'vitest'

function createRepository() {
  const root = mkdtempSync(join(tmpdir(), 'pre-push-attribution-'))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  const repo = join(root, 'repo')
  const remote = join(root, 'remote.git')
  const bin = join(root, 'bin')
  const checksRun = join(root, 'checks-run')
  mkdirSync(repo)
  mkdirSync(bin)
  writeFileSync(join(bin, 'pnpm'), `#!/bin/sh\ntouch '${checksRun}'\n`, {
    mode: 0o755
  })
  const env = {
    ...process.env,
    CI: '',
    PATH: `${bin}:${process.env.PATH}`,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_NAME: 'Contributor',
    GIT_AUTHOR_EMAIL: 'contributor@example.com',
    GIT_COMMITTER_NAME: 'Contributor',
    GIT_COMMITTER_EMAIL: 'contributor@example.com'
  }

  function git(...args: string[]) {
    return execFileSync('git', args, {
      cwd: repo,
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()
  }

  function commit(message: string, identity: NodeJS.ProcessEnv = {}) {
    execFileSync('git', ['commit', '--allow-empty', '-qm', message], {
      cwd: repo,
      env: { ...env, ...identity }
    })
  }

  function push(refs: string[], ci = '') {
    return spawnSync('git', ['push', 'origin', ...refs], {
      cwd: repo,
      env: { ...env, CI: ci },
      encoding: 'utf8'
    })
  }

  git('init', '-q', '-b', 'main')
  git('init', '--bare', '-q', remote)
  git('remote', 'add', 'origin', remote)
  commit('previously merged commit', { GIT_AUTHOR_NAME: 'Amp' })
  git('push', '-q', 'origin', 'main')
  mkdirSync(join(repo, '.husky'))
  mkdirSync(join(repo, '.github/scripts'), { recursive: true })
  copyFileSync(
    resolve(import.meta.dirname, '../../.husky/pre-push'),
    join(repo, '.husky/pre-push')
  )
  copyFileSync(
    resolve(
      import.meta.dirname,
      '../../.github/scripts/check-ai-co-authors.sh'
    ),
    join(repo, '.github/scripts/check-ai-co-authors.sh')
  )
  writeFileSync(
    join(repo, '.git/hooks/pre-push'),
    '#!/bin/sh\nexec sh .husky/pre-push "$@"\n',
    { mode: 0o755 }
  )

  return { git, commit, push, checksRun }
}

it.for([
  {
    name: 'author',
    identity: { GIT_AUTHOR_NAME: 'Amp' },
    message: 'feature',
    ci: ''
  },
  {
    name: 'committer',
    identity: { GIT_COMMITTER_NAME: 'Amp' },
    message: 'feature',
    ci: ''
  },
  {
    name: 'trailer',
    identity: {},
    message: 'feature\n\nCo-authored-by: Amp <amp@ampcode.com>',
    ci: ''
  },
  {
    name: 'author in CI',
    identity: { GIT_AUTHOR_NAME: 'Amp' },
    message: 'feature',
    ci: 'true'
  }
])(
  'blocks an AI $name on a pushed ref even when HEAD and the first ref are clean',
  ({ identity, message, ci }) => {
    const { git, commit, push, checksRun } = createRepository()
    git('switch', '-qc', 'feature')
    commit(message, identity)
    git('switch', '-qc', 'clean', 'main')
    commit('human change')

    const result = push(['clean', 'feature'], ci)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('AI agent')
    expect(
      git('ls-remote', 'origin', 'refs/heads/clean', 'refs/heads/feature')
    ).toBe('')
    expect(existsSync(checksRun)).toBe(false)
  }
)

it('allows human commits without rechecking AI commits already on main', () => {
  const { git, commit, push, checksRun } = createRepository()
  git('switch', '-qc', 'feature')
  commit('configure Amp\n\nCo-authored-by: Teammate <teammate@example.com>')
  const head = git('rev-parse', 'HEAD')

  const result = push(['feature'])

  expect(result.status).toBe(0)
  expect(git('ls-remote', 'origin', 'refs/heads/feature')).toBe(
    `${head}\trefs/heads/feature`
  )
  expect(existsSync(checksRun)).toBe(true)
})

it('allows deleting a branch', () => {
  const { git, push } = createRepository()
  git('push', '-q', 'origin', 'main:obsolete')

  const result = push(['--delete', 'obsolete'])

  expect(result.status).toBe(0)
  expect(git('ls-remote', 'origin', 'refs/heads/obsolete')).toBe('')
})
