import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  globSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

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

it('invalidates a restored ESLint cache when an English catalog changes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tool-cache-catalog-'))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
  const catalog = join(directory, 'src/locales/en/commands.json')
  mkdirSync(dirname(catalog), { recursive: true })
  writeFileSync(catalog, '{"command":"before"}')
  writeFileSync(join(directory, 'eslint.config.ts'), 'export default []')
  writeFileSync(join(directory, '.eslintcache'), 'cached lint results')
  const patterns = z
    .string()
    .parse(action.getIn(['runs', 'steps', 0, 'env', 'CONFIG_HASH']))
    .matchAll(/'([^']+)'/g)
  const globs = Array.from(patterns, (match) => z.string().parse(match[1]))
  const output = join(directory, 'outputs')
  const keyCommand = z.string().parse(action.getIn(['runs', 'steps', 0, 'run']))

  function computeKey() {
    const files = globSync(
      globs.filter((pattern) => !pattern.startsWith('!')),
      {
        cwd: directory,
        exclude: globs
          .filter((pattern) => pattern.startsWith('!'))
          .map((pattern) => pattern.slice(1))
      }
    ).sort()
    const hash = createHash('sha256')
    files.forEach((file) =>
      hash.update(
        createHash('sha256')
          .update(readFileSync(join(directory, file)))
          .digest()
      )
    )
    writeFileSync(output, '')
    const result = spawnSync('bash', ['-e', '-c', keyCommand], {
      cwd: directory,
      env: {
        ...process.env,
        SCOPE: 'lint',
        RUNNER_OS: 'Linux',
        LOCK_HASH: 'lock',
        CONFIG_HASH: hash.digest('hex'),
        GITHUB_SHA: 'unchanged',
        GITHUB_OUTPUT: output
      }
    })
    expect(result.status).toBe(0)
    return z.object({ key: z.string(), 'config-prefix': z.string() }).parse(
      Object.fromEntries(
        readFileSync(output, 'utf8')
          .trim()
          .split('\n')
          .map((line) => line.split('='))
      )
    )
  }

  const previous = computeKey()
  writeFileSync(catalog, '{"command":"after"}')
  const current = computeKey()
  expect(current['config-prefix']).not.toBe(previous['config-prefix'])
  expect(current.key).not.toBe(previous.key)
  const result = spawnSync('bash', ['-e', '-c', command], {
    cwd: directory,
    env: {
      ...process.env,
      MATCHED_KEY: previous.key,
      CONFIG_PREFIX: current['config-prefix']
    }
  })
  expect(result.status).toBe(0)
  expect(existsSync(join(directory, '.eslintcache'))).toBe(false)
})
