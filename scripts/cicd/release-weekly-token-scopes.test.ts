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

const stepNamed = (name: string) => {
  const workflow = parse(readFileSync(WORKFLOW, 'utf8')) as Workflow
  const step = Object.values(workflow.jobs ?? {})
    .flatMap((job) => job.steps ?? [])
    .find((s) => s.name === name)

  expect(step).toBeDefined()
  // Fold `\`-continued lines so one command reads as one line.
  const run = stripComments(step!.run ?? '').replace(/\\\n\s*/g, ' ')
  return { env: step!.env ?? {}, if: step!.if ?? '', run }
}

const createPrStep = () => stepNamed('Create PR to ComfyUI')
const markReadyStep = () => stepNamed('Mark the bump PR ready for review')

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

/**
 * The bump PR is created `--draft`, and until 1.58.7 nothing ever cleared the
 * flag. A draft is invisible to review, so every bump waited on a human
 * noticing it: #17329 2d22h, #17375 1d1h, #17442 3d13h. That dwell — not review
 * — was the reach lag, and it is what makes "a merged fix is not in the default
 * distribution" recur.
 */
describe('weekly ComfyUI release bump PR leaves draft', () => {
  it('marks the PR ready only once PyPI is confirmed', () => {
    // An unconfirmed version's CI fails until the index catches up, so draft is
    // the correct state there. Un-gating this would surface PRs that cannot pass.
    expect(markReadyStep().if).toMatch(
      /needs\.publish-pypi\.outputs\.pypi_confirmed\s*==\s*'true'/
    )
  })

  it('does not run when the bump was skipped', () => {
    expect(markReadyStep().if).toMatch(
      /steps\.create-pr\.outputs\.skipped\s*!=\s*'true'/
    )
  })

  it('clears the draft flag through GraphQL, not REST or `gh pr ready`', () => {
    const { run } = markReadyStep()

    // REST `pulls` PATCH silently ignores `draft`, and `gh pr ready` resolves
    // the repo through an org lookup PR_GH_TOKEN has no read:org scope for.
    expect(run).toMatch(/markPullRequestReadyForReview/)
    expect(run).not.toMatch(/\bgh pr ready\b/)
    expect(run).not.toMatch(/\bgh pr edit\b/)
  })

  it('runs under PR_GH_TOKEN', () => {
    expect(markReadyStep().env.GH_TOKEN).toBe('${{ secrets.PR_GH_TOKEN }}')
  })
})
