import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const SCRIPT = path.join(import.meta.dirname, 'check-json.sh')
const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null'
}

async function checkTrackedJson(contents: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-json-'))
  try {
    await execFileAsync('git', ['init', '-q'], { cwd: dir, env: GIT_ENV })
    fs.writeFileSync(path.join(dir, 'fixture.json'), contents)
    await execFileAsync('git', ['add', 'fixture.json'], {
      cwd: dir,
      env: GIT_ENV
    })
    return await new Promise<{ status: number; stderr: string }>(
      (resolve, reject) => {
        execFile(
          'bash',
          [SCRIPT],
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
  it.for(['null', 'false', '0', '{"a":1}', '[]'])(
    'accepts the valid JSON value %s',
    async (contents) => {
      // The whole result is compared so a failure shows the script's stderr.
      expect(await checkTrackedJson(contents)).toMatchObject({ status: 0 })
    }
  )

  it.for(['{bad', '', '   \n'])(
    'rejects %j: malformed or holding no JSON value',
    async (contents) => {
      // The whole result is compared so a failure shows the script's stderr.
      expect(await checkTrackedJson(contents)).toMatchObject({ status: 1 })
    }
  )
})
