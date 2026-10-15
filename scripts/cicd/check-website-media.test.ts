import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { describe, it } from 'vitest'

const execFileAsync = promisify(execFile)
const SCRIPT = path.join(import.meta.dirname, 'check-website-media.sh')

const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null'
}

async function tempGitRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'website-media-'))
  const env = { ...process.env, ...GIT_ENV }

  const git = (...args: string[]) =>
    execFileAsync('git', args, { cwd: dir, encoding: 'utf8', env })

  const write = (rel: string, fill = 0) => {
    const filePath = path.join(dir, rel)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, Buffer.alloc(64, fill))
  }

  const commit = async (message: string) => {
    await git('add', '--all')
    await git('commit', '-m', message)
  }

  const run = (args: string[]) =>
    new Promise<{ status: number; output: string }>((resolve, reject) => {
      execFile(
        'bash',
        [SCRIPT, ...args],
        { cwd: dir, encoding: 'utf8', env },
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

  const check = () => run(['--base', 'HEAD~1', '--head', 'HEAD'])

  await git('init', '--initial-branch=main')
  await git('config', 'user.email', 'test@example.com')
  await git('config', 'user.name', 'Test')
  await git('config', 'commit.gpgsign', 'false')
  write('apps/website/public/images/existing.png')
  await commit('base')

  return {
    dir,
    git,
    write,
    commit,
    run,
    check,
    [Symbol.dispose]() {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
}

describe(
  'check-website-media.sh',
  { timeout: 30_000, tags: ['concurrent-safe'] },
  () => {
    it.for([
      'apps/website/public/images/hero.png',
      'apps/website/public/images/hero.JPG',
      'apps/website/public/videos/launch.mp4',
      'apps/website/src/assets/sound.mp3'
    ])('fails when %s is added', async (file, { expect }) => {
      using repo = await tempGitRepo()
      repo.write(file)
      await repo.commit('add media')

      const { status, output } = await repo.check()
      expect(status).toBe(1)
      expect(output).toContain(file)
      expect(output).toContain('media.comfy.org')
    })

    it.for([
      'apps/website/public/images/logo.svg',
      'apps/website/e2e/visual.spec.ts-snapshots/home.png',
      'src/assets/images/hero.png'
    ])('passes when %s is added', async (file, { expect }) => {
      using repo = await tempGitRepo()
      repo.write(file)
      await repo.commit('add file')

      expect((await repo.check()).status).toBe(0)
    })

    it('passes when an existing image is edited', async ({ expect }) => {
      using repo = await tempGitRepo()
      repo.write('apps/website/public/images/existing.png', 1)
      await repo.commit('edit image')

      expect((await repo.check()).status).toBe(0)
    })

    it('passes when an existing image is moved unchanged', async ({
      expect
    }) => {
      using repo = await tempGitRepo()
      await repo.git(
        'mv',
        'apps/website/public/images/existing.png',
        'apps/website/public/moved.png'
      )
      await repo.commit('move image')

      expect((await repo.check()).status).toBe(0)
    })

    it('fails when an existing image is moved and changed', async ({
      expect
    }) => {
      using repo = await tempGitRepo()
      await repo.git(
        'mv',
        'apps/website/public/images/existing.png',
        'apps/website/public/moved.png'
      )
      repo.write('apps/website/public/moved.png', 1)
      await repo.commit('move and change image')

      const { status, output } = await repo.check()
      expect(status).toBe(1)
      expect(output).toContain('apps/website/public/moved.png')
    })

    it('passes when an existing image is deleted', async ({ expect }) => {
      using repo = await tempGitRepo()
      await repo.git('rm', 'apps/website/public/images/existing.png')
      await repo.commit('delete image')

      expect((await repo.check()).status).toBe(0)
    })

    it('fails when the base ref cannot be resolved', async ({ expect }) => {
      using repo = await tempGitRepo()

      const { status } = await repo.run(['--base', 'missing', '--head', 'HEAD'])
      expect(status).not.toBe(0)
    })
  }
)
