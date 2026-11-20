import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const execFileAsync = promisify(execFile)
const SCRIPT = path.join(import.meta.dirname, 'check-json.sh')
const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null'
}

async function checkTrackedJson(
  contents: string,
  { command = `bash "${SCRIPT}"`, scriptDirectory = 'tools/ci/src/cicd' } = {}
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-json-'))
  try {
    await execFileAsync('git', ['init', '-q'], { cwd: dir, env: GIT_ENV })
    fs.mkdirSync(path.join(dir, scriptDirectory), { recursive: true })
    fs.copyFileSync(SCRIPT, path.join(dir, scriptDirectory, 'check-json.sh'))
    fs.writeFileSync(path.join(dir, 'fixture.json'), contents)
    await execFileAsync('git', ['add', 'fixture.json', scriptDirectory], {
      cwd: dir,
      env: GIT_ENV
    })
    return await new Promise<{ status: number; stderr: string }>(
      (resolve, reject) => {
        execFile(
          'bash',
          ['-e', '-o', 'pipefail', '-c', command],
          { cwd: dir, env: GIT_ENV },
          (error, _stdout, stderr) => {
            const status = error ? error.code : 0
            if (typeof status === 'number') resolve({ status, stderr })
            else reject(error)
          }
        )
      }
    )
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('check-json.sh', () => {
  it.for(['scripts/cicd', 'tools/ci/src/cicd'])(
    'checks translations when the selected branch stores scripts in %s',
    async (scriptDirectory) => {
      const workflow = z
        .object({
          jobs: z.object({
            'update-locales': z.object({
              steps: z.array(
                z.object({ name: z.string(), run: z.string().optional() })
              )
            })
          })
        })
        .parse(
          parse(
            fs.readFileSync('.github/workflows/i18n-update-core.yaml', 'utf8')
          )
        )
      const command = z.string().parse(
        workflow.jobs['update-locales'].steps
          .find((step) => step.name === 'Commit updated locales')
          ?.run?.split('\n')
          .find((line) => line.includes('check-json.sh'))
      )
      expect(
        await checkTrackedJson('{"translated":"value"}', {
          command,
          scriptDirectory
        })
      ).toMatchObject({ status: 0 })
    }
  )

  it.for(['null', 'false', '0', '{"a":1}', '[]'])(
    'accepts the valid JSON value %s',
    async (contents) => {
      expect(await checkTrackedJson(contents)).toMatchObject({ status: 0 })
    }
  )

  it.for(['{bad', '', '   \n', '{"a":1} true'])(
    'rejects %j: malformed, or not exactly one JSON value',
    async (contents) => {
      expect(await checkTrackedJson(contents)).toMatchObject({ status: 1 })
    }
  )
})
