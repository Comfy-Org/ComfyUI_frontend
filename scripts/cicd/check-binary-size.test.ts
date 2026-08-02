import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = path.join(import.meta.dirname, 'check-binary-size.sh')
const LIMIT = 1024
const VALUE_OPTIONS = ['--base', '--head', '--max-bytes']

// The script leans on git's binary classification and rename detection, both of
// which a developer's global config can change. Keep fixtures hermetic.
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null'
}

describe('check-binary-size.sh', () => {
  let repo: string

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'binary-size-'))
    git('init', '--initial-branch=main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
    git('config', 'commit.gpgsign', 'false')
    writeText('README.md', 'base\n')
    commit('base')
  })

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true })
  })

  function git(...args: string[]): string {
    return execFileSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, ...GIT_ENV }
    })
  }

  function commit(message: string): void {
    git('add', '--all')
    git('commit', '-m', message)
  }

  function write(name: string, contents: Buffer | string): void {
    const filePath = path.join(repo, name)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, contents)
  }

  function writeBinary(name: string, bytes: number): void {
    write(name, Buffer.alloc(bytes))
  }

  function writeText(name: string, contents: string): void {
    write(name, contents)
  }

  function check(
    options: { maxBytes?: string; env?: Record<string, string> } = {}
  ) {
    const args = ['--base', 'HEAD~1', '--head', 'HEAD']
    if (options.maxBytes !== undefined) {
      args.push('--max-bytes', options.maxBytes)
    }
    const result = spawnSync('bash', [SCRIPT, ...args], {
      cwd: repo,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...GIT_ENV,
        MAX_BINARY_BYTES: String(LIMIT),
        ...options.env
      }
    })
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`
    }
  }

  it('passes when the range changes no binary files', () => {
    writeText('notes.md', 'some prose\n')
    commit('add notes')

    expect(check().status).toBe(0)
  })

  it('fails when an added binary exceeds the limit', () => {
    writeBinary('src/assets/clip.mp4', LIMIT * 2)
    commit('add clip')

    const { status, output } = check()
    expect(status).toBe(1)
    expect(output).toContain('src/assets/clip.mp4')
    expect(output).toContain('2.0 KiB')
  })

  it('passes when an added binary is within the limit', () => {
    writeBinary('src/assets/icon.png', LIMIT / 2)
    commit('add icon')

    expect(check().status).toBe(0)
  })

  it('passes when a text file exceeds the limit', () => {
    writeText('src/locales/big.json', `${'a'.repeat(LIMIT * 2)}\n`)
    commit('add translations')

    expect(check().status).toBe(0)
  })

  it('fails when an existing binary grows past the limit', () => {
    writeBinary('src/assets/clip.mp4', LIMIT / 2)
    commit('add clip')
    writeBinary('src/assets/clip.mp4', LIMIT * 3)
    commit('grow clip')

    const { status, output } = check()
    expect(status).toBe(1)
    expect(output).toContain('src/assets/clip.mp4')
  })

  it('ignores an oversized binary that the range deletes', () => {
    writeBinary('src/assets/clip.mp4', LIMIT * 2)
    commit('add clip')
    fs.rmSync(path.join(repo, 'src/assets/clip.mp4'))
    commit('remove clip')

    expect(check().status).toBe(0)
  })

  it('ignores a pure rename of an oversized binary', () => {
    writeBinary('src/assets/clip.mp4', LIMIT * 2)
    commit('add clip')
    git('mv', 'src/assets/clip.mp4', 'src/assets/renamed.mp4')
    commit('rename clip')

    expect(check().status).toBe(0)
  })

  it('fails when a rename also grows the binary', () => {
    writeBinary('src/assets/clip.mp4', LIMIT * 2)
    commit('add clip')
    git('mv', 'src/assets/clip.mp4', 'src/assets/renamed.mp4')
    fs.appendFileSync(
      path.join(repo, 'src/assets/renamed.mp4'),
      Buffer.alloc(LIMIT)
    )
    commit('rename and grow clip')

    const { status, output } = check()
    expect(status).toBe(1)
    expect(output).toContain('src/assets/renamed.mp4')
  })

  it('fails when a replacement shrinks but stays over the limit', () => {
    writeBinary('src/assets/clip.mp4', LIMIT * 4)
    commit('add clip')
    write('src/assets/clip.mp4', Buffer.alloc(LIMIT * 2, 1))
    commit('re-encode clip')

    const { status, output } = check()
    expect(status).toBe(1)
    expect(output).toContain('src/assets/clip.mp4')
  })

  it('ignores an oversized binary the range never touches', () => {
    writeBinary('src/assets/clip.mp4', LIMIT * 2)
    commit('add clip')
    writeText('notes.md', 'some prose\n')
    commit('add notes')

    expect(check().status).toBe(0)
  })

  it('reads the limit from MAX_BINARY_BYTES', () => {
    writeBinary('src/assets/clip.mp4', LIMIT * 2)
    commit('add clip')

    expect(check({ env: { MAX_BINARY_BYTES: String(LIMIT * 4) } }).status).toBe(
      0
    )
  })

  it('prefers --max-bytes over MAX_BINARY_BYTES', () => {
    writeBinary('src/assets/clip.mp4', LIMIT * 2)
    commit('add clip')

    expect(
      check({
        maxBytes: String(LIMIT * 4),
        env: { MAX_BINARY_BYTES: String(LIMIT) }
      }).status
    ).toBe(0)
  })

  it('rejects a non-numeric limit', () => {
    const { status, output } = check({ maxBytes: 'lots' })
    expect(status).toBe(2)
    expect(output).toContain('must be a non-negative integer')
  })

  it('rejects a negative limit', () => {
    const { status, output } = check({ maxBytes: '-1' })
    expect(status).toBe(2)
    expect(output).toContain('must be a non-negative integer')
  })

  it.for(
    VALUE_OPTIONS.flatMap((option) => [
      { option, shape: 'at the end of the arguments', args: [option] },
      { option, shape: 'followed by another flag', args: [option, '--base'] }
    ])
  )('rejects $option with no value $shape', ({ option, args }) => {
    const result = spawnSync('bash', [SCRIPT, ...args], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, ...GIT_ENV }
    })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`${option} requires a value`)
  })
})
