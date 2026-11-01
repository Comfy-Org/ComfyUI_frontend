import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  id?: string
  name?: string
  if?: string
  run?: string
  uses?: string
  with?: Record<string, unknown>
  'continue-on-error'?: boolean
  env?: Record<string, string>
}

interface Workflow {
  jobs: { draft_release: { steps: WorkflowStep[] } }
}

const workflow = parse(
  readFileSync('.github/workflows/release-draft-create.yaml', 'utf8')
) as Workflow
const { steps } = workflow.jobs.draft_release

const stepNamed = (name: string) => {
  const step = steps.find((s) => s.name === name)
  if (!step) throw new Error(`No step named ${name}`)
  return step
}

const firstAttempt = stepNamed('Create release')
const waitStep = stepNamed('Wait for release token rate limit reset')
const retry = stepNamed('Retry create release')

const writeStub = (dir: string, name: string, body: string) => {
  const path = join(dir, name)
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`)
  chmodSync(path, 0o755)
}

const runWaitStep = (remaining: number, secondsUntilReset: number) => {
  const binDir = mkdtempSync(join(tmpdir(), 'release-wait-'))
  try {
    const sleepLog = join(binDir, 'sleep.log')
    const now = 1_000_000
    writeStub(binDir, 'date', `echo ${now}`)
    writeStub(binDir, 'sleep', `echo "$1" >> '${sleepLog}'`)
    writeStub(
      binDir,
      'gh',
      `[[ "$1 $2 $3" == "api rate_limit --jq" ]] || exit 1\necho "${remaining} ${now + secondsUntilReset}"`
    )
    execFileSync('bash', ['-e', '-c', waitStep.run ?? ''], {
      env: { PATH: `${binDir}:${process.env.PATH}` }
    })
    try {
      return readFileSync(sleepLog, 'utf8').trim()
    } catch {
      return null
    }
  } finally {
    rmSync(binDir, { recursive: true, force: true })
  }
}

describe('draft_release rate limit recovery', () => {
  it('survives a failed first attempt so the retry can run', () => {
    expect(firstAttempt['continue-on-error']).toBe(true)
    expect(firstAttempt.id).toBe('create_release')
    expect(waitStep.if).toBe("steps.create_release.outcome == 'failure'")
    expect(retry.if).toBe("steps.create_release.outcome == 'failure'")
  })

  it('checks the quota of the token the release steps use', () => {
    expect(waitStep.env?.GH_TOKEN).toBe(firstAttempt.with?.token)
  })

  it('fails the job when the retry fails', () => {
    expect(retry['continue-on-error']).toBeUndefined()
  })

  it('retries with the same action and inputs', () => {
    expect(retry.uses).toBe(firstAttempt.uses)
    expect(retry.with).toEqual(firstAttempt.with)
    expect(retry.with?.tag_name).toBe('v${{ needs.build.outputs.version }}')
  })

  it.for([
    { remaining: 0, secondsUntilReset: 600, slept: '605' },
    { remaining: 99, secondsUntilReset: 60, slept: '65' },
    { remaining: 100, secondsUntilReset: 600, slept: null },
    { remaining: 0, secondsUntilReset: -60, slept: null }
  ])(
    'with $remaining calls left and reset in $secondsUntilReset s, sleeps $slept',
    ({ remaining, secondsUntilReset, slept }) => {
      expect(runWaitStep(remaining, secondsUntilReset)).toBe(slept)
    }
  )
})
