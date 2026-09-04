import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  name?: string
  run?: string
}

interface Workflow {
  jobs?: Record<string, { steps?: WorkflowStep[] }>
}

describe('PR backport workflow', () => {
  it('uses a supported field to validate merged pull requests', () => {
    const workflow = parse(
      readFileSync('.github/workflows/pr-backport.yaml', 'utf8')
    ) as Workflow
    const validationScript = workflow.jobs?.backport.steps?.find(
      (step) => step.name === 'Validate inputs for manual triggers'
    )?.run

    expect(validationScript).toContain('--json mergedAt')
    expect(validationScript).not.toMatch(/--json merged(?:\s|$)/)
  })
})
