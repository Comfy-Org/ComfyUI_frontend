import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  chmodSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'

const SCRIPT = path.join(import.meta.dirname, 'gh-retry.sh')

function fakeGh(
  behaviors: Array<{ status: number; stdout?: string; stderr?: string }>
) {
  const dir = mkdtempSync(path.join(tmpdir(), 'gh-retry-'))
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }))

  const binDir = path.join(dir, 'bin')
  mkdirSync(binDir)
  const countFile = path.join(dir, 'count')
  writeFileSync(countFile, '0')

  const behaviorsFile = path.join(dir, 'behaviors.json')
  writeFileSync(behaviorsFile, JSON.stringify(behaviors))

  const ghPath = path.join(binDir, 'gh')
  writeFileSync(
    ghPath,
    `#!/usr/bin/env node
const fs = require('fs')
const countFile = ${JSON.stringify(countFile)}
const behaviors = JSON.parse(fs.readFileSync(${JSON.stringify(behaviorsFile)}, 'utf8'))
const n = Number(fs.readFileSync(countFile, 'utf8'))
fs.writeFileSync(countFile, String(n + 1))
const behavior = behaviors[Math.min(n, behaviors.length - 1)]
if (behavior.stdout) process.stdout.write(behavior.stdout)
if (behavior.stderr) process.stderr.write(behavior.stderr)
process.exit(behavior.status)
`
  )
  chmodSync(ghPath, 0o755)

  const run = (...args: string[]) => {
    const result = spawnSync('bash', [SCRIPT, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        GH_RETRY_DELAY_SECONDS: '0',
        GH_RETRY_MAX_DELAY_SECONDS: '0'
      }
    })
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      attempts: Number(readFileSync(countFile, 'utf8'))
    }
  }

  return { run }
}

describe('gh-retry.sh', () => {
  it('passes through a first-try success without retrying', () => {
    const { run } = fakeGh([{ status: 0, stdout: 'ok\n' }])
    const result = run('pr', 'list')
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('ok\n')
    expect(result.attempts).toBe(1)
  })

  it('retries a primary rate limit and succeeds on the next attempt', () => {
    const { run } = fakeGh([
      {
        status: 1,
        stderr: 'HTTP 403: API rate limit exceeded for installation ID 123.\n'
      },
      { status: 0, stdout: 'recovered\n' }
    ])
    const result = run('pr', 'create')
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('recovered\n')
    expect(result.attempts).toBe(2)
  })

  it('retries a GraphQL-flavored secondary rate limit error', () => {
    const { run } = fakeGh([
      {
        status: 1,
        stderr:
          'GraphQL: You have exceeded a secondary rate limit (createPullRequest)\n'
      },
      { status: 0, stdout: 'recovered\n' }
    ])
    const result = run('pr', 'create')
    expect(result.status).toBe(0)
    expect(result.attempts).toBe(2)
  })

  it('gives up after exhausting attempts on a sustained rate limit', () => {
    const limited = { status: 1, stderr: 'HTTP 429: rate limit exceeded\n' }
    const { run } = fakeGh([
      limited,
      limited,
      limited,
      { status: 0, stdout: 'never reached\n' }
    ])
    const result = run('pr', 'list')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('rate limit')
    expect(result.attempts).toBe(3)
  })

  it('does not retry a non-rate-limit failure', () => {
    const { run } = fakeGh([
      { status: 1, stderr: 'HTTP 404: Not Found\n' },
      { status: 0, stdout: 'should not reach this\n' }
    ])
    const result = run('pr', 'view', '999999')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('404')
    expect(result.attempts).toBe(1)
  })

  it('preserves stdout from the successful attempt only', () => {
    const { run } = fakeGh([
      { status: 1, stdout: 'partial\n', stderr: 'rate limit exceeded\n' },
      { status: 0, stdout: 'final\n' }
    ])
    const result = run('api', 'repos/x/y')
    expect(result.stdout).toBe('final\n')
    expect(result.attempts).toBe(2)
  })
})
