/**
 * The weekly ComfyUI release reuses one branch and one PR in Comfy-Org/ComfyUI
 * (`automation/comfyui-frontend-bump`). When that PR already exists, the
 * "Create PR to ComfyUI" step refreshes its title and body.
 *
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  name?: string
  run?: string
  env?: Record<string, string>
}

interface Workflow {
  jobs?: Record<string, { steps?: WorkflowStep[] }>
}

const WORKFLOW = '.github/workflows/release-weekly-comfyui.yaml'

const stripComments = (run: string) =>
  run
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')

const createPrStep = () => {
  const workflow = parse(readFileSync(WORKFLOW, 'utf8')) as Workflow
  const step = Object.values(workflow.jobs ?? {})
    .flatMap((job) => job.steps ?? [])
    .find((s) => s.name === 'Create PR to ComfyUI')

  expect(step).toBeDefined()
  // Fold `\`-continued lines so one command reads as one line.
  const run = stripComments(step!.run ?? '').replace(/\\\n\s*/g, ' ')
  return { env: step!.env ?? {}, run }
}

describe('weekly ComfyUI release PR refresh', () => {
  it('runs under PR_GH_TOKEN, which does not carry read:org', () => {
    expect(createPrStep().env.GH_TOKEN).toBe('${{ secrets.PR_GH_TOKEN }}')
  })

  it('never calls `gh pr edit`, which needs read:org', () => {
    expect(createPrStep().run).not.toMatch(/\bgh pr edit\b/)
  })

  it('refreshes the existing PR title and body over REST', () => {
    const { run } = createPrStep()

    expect(run).toMatch(
      /gh api[^\n]*--method PATCH[^\n]*repos\/Comfy-Org\/ComfyUI\/pulls\/\$\{?EXISTING_PR\}?/
    )
    expect(run).toMatch(/-f title=/)
    expect(run).toMatch(/-F body=@\.\.\/pr-body\.txt/)
  })
})
