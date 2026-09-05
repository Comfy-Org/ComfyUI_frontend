import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  name?: string
  uses?: string
  with?: {
    version?: number | string
    package_json_file?: string
  }
}

interface Workflow {
  jobs?: {
    'publish-pypi'?: {
      steps?: WorkflowStep[]
    }
  }
}

describe('weekly ComfyUI release', () => {
  it('resolves pnpm from the release checkout, after the tag is checked out', () => {
    const workflow = parse(
      readFileSync('.github/workflows/release-weekly-comfyui.yaml', 'utf8')
    ) as Workflow
    const steps = workflow.jobs?.['publish-pypi']?.steps ?? []
    const checkoutIndex = steps.findIndex(
      (step) => step.name === 'Checkout code at target version'
    )
    const pnpmIndex = steps.findIndex((step) => step.name === 'Install pnpm')

    expect(checkoutIndex).toBeGreaterThanOrEqual(0)
    expect(pnpmIndex).toBeGreaterThan(checkoutIndex)
    expect(steps[pnpmIndex].uses).toMatch(/^pnpm\/action-setup@/)
    expect(steps[pnpmIndex].with?.package_json_file).toBe('release/package.json')
  })
})
