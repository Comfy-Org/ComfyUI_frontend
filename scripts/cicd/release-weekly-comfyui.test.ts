import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  name?: string
  uses?: string
  run?: string
  with?: {
    repository?: string
    ref?: string
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isWorkflowStep = (value: unknown): value is WorkflowStep =>
  isRecord(value) &&
  (value.name === undefined || typeof value.name === 'string') &&
  (value.uses === undefined || typeof value.uses === 'string') &&
  (value.run === undefined || typeof value.run === 'string') &&
  (value.with === undefined || isRecord(value.with))

const readCreateComfyUiPrSteps = (): WorkflowStep[] => {
  const parsed: unknown = parse(
    readFileSync('.github/workflows/release-weekly-comfyui.yaml', 'utf8')
  )
  expect(isRecord(parsed)).toBe(true)

  const jobs = (parsed as Record<string, unknown>).jobs
  expect(isRecord(jobs)).toBe(true)

  const job = (jobs as Record<string, unknown>)['create-comfyui-pr']
  expect(isRecord(job)).toBe(true)

  const steps = (job as Record<string, unknown>).steps
  expect(Array.isArray(steps)).toBe(true)
  expect((steps as unknown[]).every(isWorkflowStep)).toBe(true)

  return steps as WorkflowStep[]
}

describe('weekly ComfyUI release', () => {
  it('checks out the known ComfyUI base branch without API discovery', () => {
    const steps = readCreateComfyUiPrSteps()
    const checkoutIndex = steps.findIndex(
      (step) => step.name === 'Checkout ComfyUI fork'
    )
    const checkout = steps[checkoutIndex]

    expect(checkoutIndex).toBeGreaterThanOrEqual(0)
    expect(
      steps
        .slice(0, checkoutIndex)
        .map((step) => step.run ?? '')
        .join('\n')
    ).not.toMatch(/\bgh\s+api\b/)
    expect(checkout.uses).toMatch(/^actions\/checkout@/)
    expect(checkout.with?.repository).toBe(
      "${{ inputs.comfyui_fork || 'Comfy-Org/ComfyUI' }}"
    )
    expect(checkout.with?.ref).toBe('master')
  })
})
