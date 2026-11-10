import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { expect, test as base } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const SCRIPT = join(import.meta.dirname, 'check-unused-i18n-keys.ts')
const LOCALE = 'src/locales/ru/nodeDefs.json'
const LARGE_VALUE = 'я'.repeat(1024 * 1024)

function runCheck(cwd: string) {
  return spawnSync(join(ROOT, 'node_modules/.bin/tsx'), [SCRIPT], {
    cwd,
    encoding: 'utf8'
  })
}

function createRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'unused-i18n-'))
  function git(...args: string[]) {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
  }
  function write(content: string) {
    mkdirSync(dirname(join(dir, LOCALE)), { recursive: true })
    writeFileSync(join(dir, LOCALE), content)
  }
  function commitBaseline(content: string) {
    if (!content) return
    write(content)
    git('add', '.')
    git('commit', '-qm', 'baseline')
  }
  return { dir, git, write, commitBaseline }
}

const test = base.extend<{ repo: ReturnType<typeof createRepo> }>({
  repo: async ({ onTestFinished }, use) => {
    const repo = createRepo()
    onTestFinished(() => rmSync(repo.dir, { recursive: true, force: true }))
    repo.git('init', '-q')
    repo.git('config', 'user.name', 'Hook test')
    repo.git('config', 'user.email', 'hook@test.invalid')
    repo.git('config', 'core.hooksPath', '/dev/null')
    await use(repo)
  }
})

test.for([
  {
    name: 'added file without HEAD',
    head: '',
    staged: JSON.stringify({ freshUnusedKey: LARGE_VALUE })
  },
  {
    name: 'modified file with large HEAD',
    head: JSON.stringify({ retained: LARGE_VALUE }),
    staged: JSON.stringify({
      retained: LARGE_VALUE,
      freshUnusedKey: LARGE_VALUE
    })
  }
])('checks large staged locales: $name', ({ head, staged }, { repo }) => {
  repo.commitBaseline(head)
  repo.write(staged)
  repo.git('add', '.')
  repo.write('{}')

  const result = runCheck(repo.dir)

  expect(result.status).toBe(0)
  expect(result.stderr).toContain('  - freshUnusedKey')
  expect(result.stderr).not.toContain('  - retained')
  expect(result.stderr).not.toContain('Error')
})

test.for([
  { name: 'staged JSON', head: '{}', staged: '{' },
  { name: 'HEAD JSON', head: '{', staged: '{"freshUnusedKey":"new"}' }
])('fails when it cannot parse $name', ({ head, staged }, { repo }) => {
  repo.commitBaseline(head)
  repo.write(staged)
  repo.git('add', '.')

  const result = runCheck(repo.dir)

  expect(result.status).toBe(1)
  expect(result.stderr).toContain(LOCALE)
})

test.for(['HEAD:', ':'])(
  'fails on an unreadable %s blob',
  (revision, { repo }) => {
    repo.commitBaseline('{"retained":"old"}')
    repo.write('{"retained":"old","freshUnusedKey":"new"}')
    repo.git('add', '.')
    const blob = repo.git('rev-parse', `${revision}${LOCALE}`)
    rmSync(join(repo.dir, '.git/objects', blob.slice(0, 2), blob.slice(2)))

    const result = runCheck(repo.dir)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(LOCALE)
  }
)

test('fails if staged files cannot be listed', ({ repo }) => {
  rmSync(join(repo.dir, '.git'), { recursive: true })

  const result = runCheck(repo.dir)

  expect(result.status).toBe(1)
  expect(result.stderr).toContain('Error checking unused keys')
})

test('succeeds silently with no staged locales', ({ repo }) => {
  const result = runCheck(repo.dir)

  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
})
