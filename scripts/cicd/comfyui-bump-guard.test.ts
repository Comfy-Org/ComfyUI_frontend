/**
 * The weekly ComfyUI release reuses one branch and one PR in Comfy-Org/ComfyUI
 * (`automation/comfyui-frontend-bump`).
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const SCRIPT = path.join(import.meta.dirname, 'comfyui-bump-guard.sh')
const WORKFLOW = '.github/workflows/release-weekly-comfyui.yaml'

const guard = (target: string, pending: string) => {
  const result = spawnSync('bash', [SCRIPT, target, pending], {
    encoding: 'utf8'
  })
  return { status: result.status, stdout: result.stdout.trim() }
}

describe('comfyui-bump-guard.sh', () => {
  it.for([
    ['1.57.6', '1.58.1'],
    ['1.57.7', '1.58.2'],
    ['1.58.1', '1.59.0.dev2'],
    ['1.9.9', '1.10.0'],
    ['1.59.0.dev2', '1.59.0'],
    ['1.59.0.dev1', '1.59.0.dev2']
  ])('skips %s when the pending bump is newer (%s)', ([target, pending]) => {
    expect(guard(target, pending)).toEqual({ status: 0, stdout: 'skip' })
  })

  it.for([
    ['1.58.2', '1.57.7'],
    ['1.58.1', '1.58.1'],
    ['1.10.0', '1.9.9'],
    ['1.58.1', ''],
    ['1.59.0', '1.59.0.dev2']
  ])('proceeds with %s over pending %s', ([target, pending]) => {
    expect(guard(target, pending)).toEqual({ status: 0, stdout: 'proceed' })
  })

  it('rejects a missing or malformed target version', () => {
    expect(guard('', '1.58.1').status).not.toBe(0)
    expect(guard('latest', '1.58.1').status).not.toBe(0)
  })
})

describe('Create PR to ComfyUI step', () => {
  interface Step {
    name?: string
    run?: string
  }
  const steps = Object.values(
    (
      parse(readFileSync(WORKFLOW, 'utf8')) as {
        jobs: Record<string, { steps?: Step[] }>
      }
    ).jobs
  ).flatMap((job) => job.steps ?? [])
  const run = steps.find((s) => s.name === 'Create PR to ComfyUI')?.run ?? ''

  it('consults the guard before force-pushing the shared branch', () => {
    const guardAt = run.indexOf('comfyui-bump-guard.sh')
    const pushAt = run.indexOf('git push -f')
    expect(guardAt).toBeGreaterThan(-1)
    expect(pushAt).toBeGreaterThan(guardAt)
  })

  it('reads the pending pin from the open PR branch, not master', () => {
    expect(run).toMatch(/contents\/requirements\.txt\?ref=/)
  })
})
