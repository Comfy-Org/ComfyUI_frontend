import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, it, onTestFinished } from 'vitest'
import { parseDocument } from 'yaml'
import { z } from 'zod'

const action = parseDocument(
  readFileSync('.github/actions/tool-cache-restore/action.yml', 'utf8')
)
const steps = z
  .array(z.object({ run: z.string().optional() }))
  .parse(action.toJS().runs.steps)
const command = steps.at(-1)?.run ?? ''

it.for([
  { matchedKey: 'lint-cache-Linux-lock-old-sha', retained: false },
  { matchedKey: 'lint-cache-Linux-lock-current-sha', retained: true },
  { matchedKey: 'lint-cache-Linux-lock-current-earlier', retained: true },
  { matchedKey: '', retained: true }
])(
  'retains ESLint cache=$retained for restored key "$matchedKey" without discarding other tools',
  ({ matchedKey, retained }) => {
    const directory = mkdtempSync(join(tmpdir(), 'tool-cache-restore-'))
    onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
    writeFileSync(join(directory, '.eslintcache'), 'eslint results')
    writeFileSync(join(directory, '.stylelintcache'), 'stylelint results')
    writeFileSync(
      join(directory, 'application.tsbuildinfo'),
      'typecheck results'
    )

    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', command], {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        MATCHED_KEY: matchedKey,
        CONFIG_PREFIX: 'lint-cache-Linux-lock-current-'
      }
    })

    expect(result.status).toBe(0)
    expect(existsSync(join(directory, '.eslintcache'))).toBe(retained)
    expect(readFileSync(join(directory, '.stylelintcache'), 'utf8')).toBe(
      'stylelint results'
    )
    expect(
      readFileSync(join(directory, 'application.tsbuildinfo'), 'utf8')
    ).toBe('typecheck results')
  }
)
