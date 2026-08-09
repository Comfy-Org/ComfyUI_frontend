import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SCRIPT = path.join(import.meta.dirname, 'check-binary-size.sh')
const LIMIT = 1024
const VALUE_OPTIONS = ['--base', '--head', '--max-bytes']

// The script leans on git's binary classification and rename detection, both of
// which a developer's global config can change. Keep fixtures hermetic.
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null'
}

function tempGitRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'binary-size-'))
  const env = { ...process.env, ...GIT_ENV }

  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8', env })

  const write = (rel: string, contents: Buffer | string) => {
    const filePath = path.join(dir, rel)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, contents)
  }

  const writeBinary = (rel: string, bytes: number, fill = 0) =>
    write(rel, Buffer.alloc(bytes, fill))

  const commit = (message: string) => {
    git('add', '--all')
    git('commit', '-m', message)
  }

  const run = (args: string[], extraEnv: Record<string, string> = {}) => {
    const result = spawnSync('bash', [SCRIPT, ...args], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...env, ...extraEnv }
    })
    return { status: result.status, output: `${result.stdout}${result.stderr}` }
  }

  const check = (
    options: { maxBytes?: string; env?: Record<string, string> } = {}
  ) => {
    const args = ['--base', 'HEAD~1', '--head', 'HEAD']
    if (options.maxBytes !== undefined) {
      args.push('--max-bytes', options.maxBytes)
    }
    return run(args, { MAX_BINARY_BYTES: String(LIMIT), ...options.env })
  }

  git('init', '--initial-branch=main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  git('config', 'commit.gpgsign', 'false')
  write('README.md', 'base\n')
  commit('base')

  return {
    dir,
    git,
    write,
    writeBinary,
    commit,
    run,
    check,
    [Symbol.dispose]() {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
}

describe('check-binary-size.sh', () => {
  it('passes when the range changes no binary files', () => {
    using repo = tempGitRepo()
    repo.write('notes.md', 'some prose\n')
    repo.commit('add notes')

    expect(repo.check().status).toBe(0)
  })

  it('fails when an added binary exceeds the limit', () => {
    using repo = tempGitRepo()
    repo.writeBinary('src/assets/clip.mp4', LIMIT * 2)
    repo.commit('add clip')

    const { status, output } = repo.check()
    expect(status).toBe(1)
    expect(output).toContain('src/assets/clip.mp4')
    expect(output).toContain('2.0 KiB')
  })

  it('passes when an added binary is within the limit', () => {
    using repo = tempGitRepo()
    repo.writeBinary('src/assets/icon.png', LIMIT / 2)
    repo.commit('add icon')

    expect(repo.check().status).toBe(0)
  })

  it('passes when a text file exceeds the limit', () => {
    using repo = tempGitRepo()
    repo.write('src/locales/big.json', `${'a'.repeat(LIMIT * 2)}\n`)
    repo.commit('add translations')

    expect(repo.check().status).toBe(0)
  })

  it('fails when an existing binary grows past the limit', () => {
    using repo = tempGitRepo()
    repo.writeBinary('src/assets/clip.mp4', LIMIT / 2)
    repo.commit('add clip')
    repo.writeBinary('src/assets/clip.mp4', LIMIT * 3)
    repo.commit('grow clip')

    const { status, output } = repo.check()
    expect(status).toBe(1)
    expect(output).toContain('src/assets/clip.mp4')
  })

  it('ignores an oversized binary that the range deletes', () => {
    using repo = tempGitRepo()
    repo.writeBinary('src/assets/clip.mp4', LIMIT * 2)
    repo.commit('add clip')
    fs.rmSync(path.join(repo.dir, 'src/assets/clip.mp4'))
    repo.commit('remove clip')

    expect(repo.check().status).toBe(0)
  })

  it('ignores a pure rename of an oversized binary', () => {
    using repo = tempGitRepo()
    repo.writeBinary('src/assets/clip.mp4', LIMIT * 2)
    repo.commit('add clip')
    repo.git('mv', 'src/assets/clip.mp4', 'src/assets/renamed.mp4')
    repo.commit('rename clip')

    expect(repo.check().status).toBe(0)
  })

  it('fails when a rename also grows the binary', () => {
    using repo = tempGitRepo()
    repo.writeBinary('src/assets/clip.mp4', LIMIT * 2)
    repo.commit('add clip')
    repo.git('mv', 'src/assets/clip.mp4', 'src/assets/renamed.mp4')
    fs.appendFileSync(
      path.join(repo.dir, 'src/assets/renamed.mp4'),
      Buffer.alloc(LIMIT)
    )
    repo.commit('rename and grow clip')

    const { status, output } = repo.check()
    expect(status).toBe(1)
    expect(output).toContain('src/assets/renamed.mp4')
  })

  it('fails when a replacement shrinks but stays over the limit', () => {
    using repo = tempGitRepo()
    repo.writeBinary('src/assets/clip.mp4', LIMIT * 4)
    repo.commit('add clip')
    repo.writeBinary('src/assets/clip.mp4', LIMIT * 2, 1)
    repo.commit('re-encode clip')

    const { status, output } = repo.check()
    expect(status).toBe(1)
    expect(output).toContain('src/assets/clip.mp4')
  })

  it('ignores an oversized binary the range never touches', () => {
    using repo = tempGitRepo()
    repo.writeBinary('src/assets/clip.mp4', LIMIT * 2)
    repo.commit('add clip')
    repo.write('notes.md', 'some prose\n')
    repo.commit('add notes')

    expect(repo.check().status).toBe(0)
  })

  it('reads the limit from MAX_BINARY_BYTES', () => {
    using repo = tempGitRepo()
    repo.writeBinary('src/assets/clip.mp4', LIMIT * 2)
    repo.commit('add clip')

    expect(
      repo.check({ env: { MAX_BINARY_BYTES: String(LIMIT * 4) } }).status
    ).toBe(0)
  })

  it('prefers --max-bytes over MAX_BINARY_BYTES', () => {
    using repo = tempGitRepo()
    repo.writeBinary('src/assets/clip.mp4', LIMIT * 2)
    repo.commit('add clip')

    expect(
      repo.check({
        maxBytes: String(LIMIT * 4),
        env: { MAX_BINARY_BYTES: String(LIMIT) }
      }).status
    ).toBe(0)
  })

  it('rejects a non-numeric limit', () => {
    using repo = tempGitRepo()

    const { status, output } = repo.check({ maxBytes: 'lots' })
    expect(status).toBe(2)
    expect(output).toContain('must be a non-negative integer')
  })

  it('rejects a negative limit', () => {
    using repo = tempGitRepo()

    const { status, output } = repo.check({ maxBytes: '-1' })
    expect(status).toBe(2)
    expect(output).toContain('must be a non-negative integer')
  })

  it.for(
    VALUE_OPTIONS.flatMap((option) => [
      { option, shape: 'at the end of the arguments', args: [option] },
      { option, shape: 'followed by another flag', args: [option, '--base'] }
    ])
  )('rejects $option with no value $shape', ({ option, args }) => {
    using repo = tempGitRepo()

    const { status, output } = repo.run(args)
    expect(status).toBe(2)
    expect(output).toContain(`${option} requires a value`)
  })
})
