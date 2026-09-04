/**
 * `gh pr edit` resolves `author`, `assignees`, `labels` and team `slug`/`name`
 * over GraphQL, and GitHub requires `read:org` for those fields. PR_GH_TOKEN
 * carries `repo`/`workflow` but not `read:org`, so every `gh pr edit` in the
 * backport path failed:
 *
 *   - `--add-assignee` was guarded by `|| echo ::warning`, so backport PRs
 *     silently went unassigned for as long as the token lacked the scope.
 *   - `--remove-label` was unguarded, so it failed the whole job *after* the
 *     backport PRs had already been created, and left `needs-backport` on the
 *     source PR — which re-arms the workflow's own `labeled` trigger.
 *
 * The equivalent REST endpoints need only `repo`. This pins the workflows that
 * run under PR_GH_TOKEN to REST so the scope requirement cannot creep back in.
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  name?: string
  run?: string
  env?: Record<string, string>
}

interface WorkflowJob {
  env?: Record<string, string>
  steps?: WorkflowStep[]
}

interface Workflow {
  jobs?: Record<string, WorkflowJob>
}

/** `gh pr edit` subcommands whose GraphQL selection requires `read:org`. */
const ORG_SCOPED_FLAGS = [
  '--add-assignee',
  '--remove-assignee',
  '--add-label',
  '--remove-label'
]

const WORKFLOW = '.github/workflows/pr-backport.yaml'

const readWorkflow = (path: string) =>
  parse(readFileSync(path, 'utf8')) as Workflow

/**
 * Full-line `#` comments are dropped so the guard reads executable shell only.
 * Without this, the comment explaining *why* a step avoids `gh pr edit` would
 * itself trip the check. Trailing `#` is deliberately left alone: it occurs
 * inside strings here (`"PR #${PR_NUM}"`) and stripping it would corrupt them.
 */
const stripComments = (run: string) =>
  run
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')

const runScripts = (workflow: Workflow) =>
  Object.values(workflow.jobs ?? {})
    .flatMap((job) => job.steps ?? [])
    .filter((step) => typeof step.run === 'string')
    .map((step) => ({
      name: step.name ?? '<unnamed step>',
      run: stripComments(step.run!)
    }))

describe('backport workflow token scopes', () => {
  it('runs under PR_GH_TOKEN, which does not carry read:org', () => {
    const workflow = readWorkflow(WORKFLOW)
    const job = workflow.jobs?.backport

    expect(job?.env?.GH_TOKEN).toBe(
      '${{ secrets.PR_GH_TOKEN || secrets.GH_TOKEN }}'
    )
  })

  // On failure this reports the offending step names. The remedy is the REST
  // equivalent: `gh api .../issues/{n}/assignees` or `.../labels/{name}`.
  it.for(ORG_SCOPED_FLAGS)('never reaches for `gh pr edit %s`', (flag) => {
    const offenders = runScripts(readWorkflow(WORKFLOW))
      .filter(({ run }) => /\bgh pr edit\b/.test(run) && run.includes(flag))
      .map(({ name }) => name)

    expect(offenders).toEqual([])
  })

  it('assigns the backport PR through the REST assignees endpoint', () => {
    const step = runScripts(readWorkflow(WORKFLOW)).find(({ run }) =>
      run.includes('/assignees')
    )

    expect(step).toBeDefined()
    expect(step!.run).toMatch(/gh api[^\n]*--method POST/)
    expect(step!.run).toContain('issues/${PR_NUM}/assignees')
  })

  it('removes needs-backport through the REST labels endpoint, tolerating an already-absent label', () => {
    const workflow = readWorkflow(WORKFLOW)
    const step = Object.values(workflow.jobs ?? {})
      .flatMap((job) => job.steps ?? [])
      .find((step) => step.name === 'Remove needs-backport label')

    expect(step).toBeDefined()

    const run = step!.run ?? ''
    expect(run).toMatch(/gh api[^\n]*--method DELETE/)
    expect(run).toContain('labels/needs-backport')
    // A label that is already gone is the desired end state, not a failure:
    // the delete endpoint 404s in that case and `bash -e` would fail the job.
    expect(run).toContain('already absent')
    expect(run).toMatch(/exit 0/)
  })
})
