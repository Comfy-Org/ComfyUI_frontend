import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT = path.join(import.meta.dirname, 'push-generated-locales.sh')

type Fixture = {
  dir: string
  env: NodeJS.ProcessEnv
  remote: string
  runner: string
}

const fixtureDirs: string[] = []

function git(cwd: string, env: NodeJS.ProcessEnv, ...args: string[]) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env }).trim()
}

function writeLocale(repo: string, value: string) {
  const localePath = path.join(repo, 'src/locales/en/main.json')
  fs.mkdirSync(path.dirname(localePath), { recursive: true })
  fs.writeFileSync(localePath, `${JSON.stringify({ value })}\n`)
}

function createFixture(): Fixture {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'push-locales-'))
  fixtureDirs.push(dir)

  const home = path.join(dir, 'home')
  const remote = path.join(dir, 'remote.git')
  const seed = path.join(dir, 'seed')
  const runner = path.join(dir, 'runner')
  fs.mkdirSync(home)

  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home }
  git(dir, env, 'init', '--bare', '--initial-branch=main', remote)
  git(dir, env, 'init', '--initial-branch=main', seed)
  git(seed, env, 'config', 'user.name', 'Fixture')
  git(seed, env, 'config', 'user.email', 'fixture@example.com')
  writeLocale(seed, 'initial')
  git(seed, env, 'add', '.')
  git(seed, env, 'commit', '-m', 'Initial locales')
  git(seed, env, 'remote', 'add', 'origin', remote)
  git(seed, env, 'push', '-u', 'origin', 'main')
  git(dir, env, 'clone', remote, runner)

  return { dir, env, remote, runner }
}

function runScript(fixture: Fixture) {
  const result = spawnSync('bash', [SCRIPT, 'main'], {
    cwd: fixture.runner,
    encoding: 'utf8',
    env: fixture.env
  })

  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`
  }
}

function remoteLocale({ dir, env, remote }: Fixture) {
  return git(
    dir,
    env,
    `--git-dir=${remote}`,
    'show',
    'main:src/locales/en/main.json'
  )
}

afterEach(() => {
  for (const dir of fixtureDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('push-generated-locales.sh', () => {
  it('pushes valid generated locales when the branch has not moved', () => {
    const fixture = createFixture()
    writeLocale(fixture.runner, 'generated')

    const { status, output } = runScript(fixture)

    expect(status, output).toBe(0)
    expect(remoteLocale(fixture)).toBe(JSON.stringify({ value: 'generated' }))
    expect(
      git(
        fixture.dir,
        fixture.env,
        `--git-dir=${fixture.remote}`,
        'log',
        '-1',
        '--format=%s',
        'main'
      )
    ).toBe('Update locales')
  })

  it('rejects generated output when the remote branch moved', () => {
    const fixture = createFixture()
    const updater = path.join(fixture.dir, 'updater')
    git(fixture.dir, fixture.env, 'clone', fixture.remote, updater)
    git(updater, fixture.env, 'config', 'user.name', 'Updater')
    git(updater, fixture.env, 'config', 'user.email', 'updater@example.com')

    writeLocale(fixture.runner, 'stale generation')
    writeLocale(updater, 'new remote value')
    git(updater, fixture.env, 'add', '.')
    git(updater, fixture.env, 'commit', '-m', 'Move branch')
    git(updater, fixture.env, 'push', 'origin', 'main')

    const { status, output } = runScript(fixture)

    expect(status).not.toBe(0)
    expect(output).toContain('Locale branch moved')
    expect(remoteLocale(fixture)).toBe(
      JSON.stringify({ value: 'new remote value' })
    )
    expect(
      fs.readFileSync(
        path.join(fixture.runner, 'src/locales/en/main.json'),
        'utf8'
      )
    ).toBe(`${JSON.stringify({ value: 'stale generation' })}\n`)
  })

  it('rejects conflict markers before committing them', () => {
    const fixture = createFixture()
    fs.writeFileSync(
      path.join(fixture.runner, 'src/locales/en/main.json'),
      [
        '<<<<<<< Updated upstream',
        '{"value":"remote"}',
        '=======',
        '{"value":"generated"}',
        '>>>>>>> Stashed changes',
        ''
      ].join('\n')
    )

    const { status, output } = runScript(fixture)

    expect(status).not.toBe(0)
    expect(output).toContain('Locale files contain merge-conflict markers')
    expect(remoteLocale(fixture)).toBe(JSON.stringify({ value: 'initial' }))
    expect(
      git(
        fixture.dir,
        fixture.env,
        `--git-dir=${fixture.remote}`,
        'rev-list',
        '--count',
        'main'
      )
    ).toBe('1')
  })

  it('rejects invalid locale JSON before committing it', () => {
    const fixture = createFixture()
    fs.writeFileSync(
      path.join(fixture.runner, 'src/locales/en/main.json'),
      '{"value":'
    )

    const { status, output } = runScript(fixture)

    expect(status).not.toBe(0)
    expect(output).toContain('Invalid JSON syntax')
    expect(remoteLocale(fixture)).toBe(JSON.stringify({ value: 'initial' }))
  })
})
