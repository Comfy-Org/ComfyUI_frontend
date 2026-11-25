import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  name?: string
  if?: string
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

function stepNamed(name: string) {
  const workflow = parse(readFileSync(WORKFLOW, 'utf8')) as Workflow
  const step = Object.values(workflow.jobs ?? {})
    .flatMap((job) => job.steps ?? [])
    .find((s) => s.name === name)

  expect(step).toBeDefined()
  const run = stripComments(step!.run ?? '').replace(/\\\n\s*/g, ' ')
  return { env: step!.env ?? {}, if: step!.if ?? '', run }
}

describe('weekly ComfyUI release PR refresh', () => {
  it('runs under PR_GH_TOKEN, which does not carry read:org', () => {
    expect(stepNamed('Create PR to ComfyUI').env.GH_TOKEN).toBe(
      '${{ secrets.PR_GH_TOKEN }}'
    )
  })

  it('never calls `gh pr edit`, which needs read:org', () => {
    expect(stepNamed('Create PR to ComfyUI').run).not.toMatch(/\bgh pr edit\b/)
  })

  it('refreshes the existing PR title and body over REST', () => {
    const { run } = stepNamed('Create PR to ComfyUI')

    expect(run).toMatch(
      /gh-retry\.sh api[^\n]*--method PATCH[^\n]*repos\/Comfy-Org\/ComfyUI\/pulls\/\$\{?EXISTING_PR\}?/
    )
    expect(run).toMatch(/-f title=/)
    expect(run).toMatch(/-F body=@\.\.\/pr-body\.txt/)
  })
})

describe('weekly ComfyUI release bump PR leaves draft', () => {
  it('marks the PR ready only once PyPI is confirmed and the bump was not skipped', () => {
    expect(stepNamed('Mark the bump PR ready for review').if).toBe(
      "steps.create-pr.outputs.skipped != 'true' && needs.publish-pypi.outputs.pypi_confirmed == 'true'"
    )
  })

  it('clears the draft flag through GraphQL, not REST or `gh pr ready`', () => {
    const { run } = stepNamed('Mark the bump PR ready for review')

    expect(run).toMatch(/markPullRequestReadyForReview/)
    expect(run).not.toMatch(/\bgh pr ready\b/)
    expect(run).not.toMatch(/\bgh pr edit\b/)
  })

  it('runs under PR_GH_TOKEN', () => {
    expect(stepNamed('Mark the bump PR ready for review').env.GH_TOKEN).toBe(
      '${{ secrets.PR_GH_TOKEN }}'
    )
  })
})
