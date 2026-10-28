import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { describe, it } from 'vitest'

const execFileAsync = promisify(execFile)
const SCRIPT = path.join(import.meta.dirname, 'check-binary-size.sh')
const LIMIT = 1024
const VALUE_OPTIONS = ['--base', '--head', '--max-bytes']

// The script leans on git's binary classification and rename detection, both of
// which a developer's global config can change. Keep fixtures hermetic.
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null'
}

async function tempGitRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'binary-size-'))
  const env = { ...process.env, ...GIT_ENV }

  const git = (...args: string[]) =>
    execFileAsync('git', args, { cwd: dir, encoding: 'utf8', env })

  const write = (rel: string, contents: Buffer | string) => {
    const filePath = path.join(dir, rel)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, contents)
  }

  const writeBinary = (rel: string, bytes: number, fill = 0) =>
    write(rel, Buffer.alloc(bytes, fill))

  const commit = async (message: string) => {
    await git('add', '--all')
    await git('commit', '-m', message)
  }

  const run = (args: string[], extraEnv: Record<string, string> = {}) =>
    new Promise<{ status: number; output: string }>((resolve, reject) => {
      execFile(
        'bash',
        [SCRIPT, ...args],
        { cwd: dir, encoding: 'utf8', env: { ...env, ...extraEnv } },
        (error, stdout, stderr) => {
          const status = error ? error.code : 0
          if (typeof status !== 'number') {
            reject(error)
            return
          }
          resolve({ status, output: stdout + stderr })
        }
      )
    })

  const check = (
    options: { maxBytes?: string; env?: Record<string, string> } = {}
  ) => {
    const args = ['--base', 'HEAD~1', '--head', 'HEAD']
    if (options.maxBytes !== undefined) {
      args.push('--max-bytes', options.maxBytes)
    }
    return run(args, { MAX_BINARY_BYTES: String(LIMIT), ...options.env })
  }

  await git('init', '--initial-branch=main')
  await git('config', 'user.email', 'test@example.com')
  await git('config', 'user.name', 'Test')
  await git('config', 'commit.gpgsign', 'false')
  write('README.md', 'base\n')
  await commit('base')

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

describe(
  'check-binary-size.sh',
  { timeout: 30_000, tags: ['concurrent-safe'] },
  () => {
    // Every test drives a chain of git subprocesses (init, config, commits) plus the
    // script itself (two diffs, cat-file). Under a heavily loaded machine one link
    // can stall long enough to trip vitest's default 5s test timeout — a pure
    // load-sensitivity failure, not a defect the timeout exists to catch. A real
    // script failure still surfaces in well under a second, so a generous ceiling
    // keeps the suite hermetic under parallel load without masking regressions.
    it('passes when the range changes no binary files', async ({ expect }) => {
      using repo = await tempGitRepo()
      repo.write('notes.md', 'some prose\n')
      await repo.commit('add notes')

      expect((await repo.check()).status).toBe(0)
    })

    it('fails when an added binary exceeds the limit', async ({ expect }) => {
      using repo = await tempGitRepo()
      repo.writeBinary('src/assets/clip.mp4', LIMIT * 2)
      await repo.commit('add clip')

      const { status, output } = await repo.check()
      expect(status).toBe(1)
      expect(output).toContain('src/assets/clip.mp4')
      expect(output).toContain('2.0 KiB')
    })

    it('passes when an added binary is within the limit', async ({
      expect
    }) => {
      using repo = await tempGitRepo()
      repo.writeBinary('src/assets/icon.png', LIMIT / 2)
      await repo.commit('add icon')

      expect((await repo.check()).status).toBe(0)
    })

    it('passes when a text file exceeds the limit', async ({ expect }) => {
      using repo = await tempGitRepo()
      repo.write('src/locales/big.json', `${'a'.repeat(LIMIT * 2)}\n`)
      await repo.commit('add translations')

      expect((await repo.check()).status).toBe(0)
    })

    it('fails when an existing binary grows past the limit', async ({
      expect
    }) => {
      using repo = await tempGitRepo()
      repo.writeBinary('src/assets/clip.mp4', LIMIT / 2)
      await repo.commit('add clip')
      repo.writeBinary('src/assets/clip.mp4', LIMIT * 3)
      await repo.commit('grow clip')

      const { status, output } = await repo.check()
      expect(status).toBe(1)
      expect(output).toContain('src/assets/clip.mp4')
    })

    it('ignores an oversized binary that the range deletes', async ({
      expect
    }) => {
      using repo = await tempGitRepo()
      repo.writeBinary('src/assets/clip.mp4', LIMIT * 2)
      await repo.commit('add clip')
      fs.rmSync(path.join(repo.dir, 'src/assets/clip.mp4'))
      await repo.commit('remove clip')

      expect((await repo.check()).status).toBe(0)
    })

    it('ignores a pure rename of an oversized binary', async ({ expect }) => {
      using repo = await tempGitRepo()
      repo.writeBinary('src/assets/clip.mp4', LIMIT * 2)
      await repo.commit('add clip')
      await repo.git('mv', 'src/assets/clip.mp4', 'src/assets/renamed.mp4')
      await repo.commit('rename clip')

      expect((await repo.check()).status).toBe(0)
    })

    it('fails when a rename also grows the binary', async ({ expect }) => {
      using repo = await tempGitRepo()
      repo.writeBinary('src/assets/clip.mp4', LIMIT * 2)
      await repo.commit('add clip')
      await repo.git('mv', 'src/assets/clip.mp4', 'src/assets/renamed.mp4')
      fs.appendFileSync(
        path.join(repo.dir, 'src/assets/renamed.mp4'),
        Buffer.alloc(LIMIT)
      )
      await repo.commit('rename and grow clip')

      const { status, output } = await repo.check()
      expect(status).toBe(1)
      expect(output).toContain('src/assets/renamed.mp4')
    })

    it('fails when a replacement shrinks but stays over the limit', async ({
      expect
    }) => {
      using repo = await tempGitRepo()
      repo.writeBinary('src/assets/clip.mp4', LIMIT * 4)
      await repo.commit('add clip')
      repo.writeBinary('src/assets/clip.mp4', LIMIT * 2, 1)
      await repo.commit('re-encode clip')

      const { status, output } = await repo.check()
      expect(status).toBe(1)
      expect(output).toContain('src/assets/clip.mp4')
    })

    it('ignores an oversized binary the range never touches', async ({
      expect
    }) => {
      using repo = await tempGitRepo()
      repo.writeBinary('src/assets/clip.mp4', LIMIT * 2)
      await repo.commit('add clip')
      repo.write('notes.md', 'some prose\n')
      await repo.commit('add notes')

      expect((await repo.check()).status).toBe(0)
    })

    it('reads the limit from MAX_BINARY_BYTES', async ({ expect }) => {
      using repo = await tempGitRepo()
      repo.writeBinary('src/assets/clip.mp4', LIMIT * 2)
      await repo.commit('add clip')

      expect(
        (await repo.check({ env: { MAX_BINARY_BYTES: String(LIMIT * 4) } }))
          .status
      ).toBe(0)
    })

    it('prefers --max-bytes over MAX_BINARY_BYTES', async ({ expect }) => {
      using repo = await tempGitRepo()
      repo.writeBinary('src/assets/clip.mp4', LIMIT * 2)
      await repo.commit('add clip')

      expect(
        (
          await repo.check({
            maxBytes: String(LIMIT * 4),
            env: { MAX_BINARY_BYTES: String(LIMIT) }
          })
        ).status
      ).toBe(0)
    })

    it('rejects a non-numeric limit', async ({ expect }) => {
      using repo = await tempGitRepo()

      const { status, output } = await repo.check({ maxBytes: 'lots' })
      expect(status).toBe(2)
      expect(output).toContain('must be a non-negative integer')
    })

    it('rejects a negative limit', async ({ expect }) => {
      using repo = await tempGitRepo()

      const { status, output } = await repo.check({ maxBytes: '-1' })
      expect(status).toBe(2)
      expect(output).toContain('must be a non-negative integer')
    })

    it.for(
      VALUE_OPTIONS.flatMap((option) => [
        { option, shape: 'at the end of the arguments', args: [option] },
        { option, shape: 'followed by another flag', args: [option, '--base'] }
      ])
    )(
      'rejects $option with no value $shape',
      async ({ option, args }, { expect }) => {
        using repo = await tempGitRepo()

        const { status, output } = await repo.run(args)
        expect(status).toBe(2)
        expect(output).toContain(`${option} requires a value`)
      }
    )
  }
)
