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

const labelStepRun = () => {
  const step = Object.values(readWorkflow(WORKFLOW).jobs ?? {})
    .flatMap((job) => job.steps ?? [])
    .find((step) => step.name === 'Remove needs-backport label')

  expect(step).toBeDefined()
  return step!.run ?? ''
}

/**
 * The cleanup step's contract is an *order*, not a set of substrings: read the
 * label list, decide from what was read, and only then delete. Asserting the
 * pieces individually would pass on a script that deletes first, or that calls
 * the label absent before reading anything. Each negative control below trips
 * exactly one of these.
 */
const labelStepViolations = (run: string): string[] => {
  const code = stripComments(run)
  const violations: string[] = []

  const read = code.search(/\w+=\$\(\s*gh api/)
  const check = code.search(/grep -qx ['"]needs-backport['"]/)
  const del = code.search(/gh api[^\n]*--method DELETE/)
  const earlyExit = code.search(/^\s*exit 0\s*$/m)

  if (!/^\s*set -euo pipefail\s*$/m.test(code)) {
    violations.push('does not set -euo pipefail')
  }
  if (read === -1) {
    violations.push('does not read the label list into a variable')
  }
  if (check === -1) {
    violations.push('does not test for the needs-backport label')
  }
  if (del === -1) {
    violations.push('does not delete the label over REST')
  }
  if (!code.includes('labels/needs-backport')) {
    violations.push('does not target the needs-backport label endpoint')
  }
  // A failed read must not read as "absent": under a pipe the exit status is
  // grep's, so an API error would take the already-absent branch and exit 0.
  if (/gh api[^\n|]*\|\s*grep/.test(code)) {
    violations.push(
      'pipes the label read straight into grep, so a failed read reads as absence'
    )
  }
  if (read !== -1 && check !== -1 && read > check) {
    violations.push('checks for the label before reading it')
  }
  if (check !== -1 && del !== -1 && check > del) {
    violations.push('deletes the label before checking for it')
  }
  // An already-absent label is the desired end state, so the step short-circuits
  // rather than letting the DELETE 404 fail the job under `set -e`.
  if (earlyExit === -1) {
    violations.push('does not exit 0 when the label is already absent')
  } else if (del !== -1 && earlyExit > del) {
    violations.push('exits early only after it has already deleted')
  }

  return violations
}

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
    expect(labelStepViolations(labelStepRun())).toEqual([])
  })

  // Negative controls. Substring assertions alone would pass on every one of
  // these, which is why the contract above is expressed as ordering.
  it.for([
    [
      'decides from a label list it never read',
      `set -euo pipefail\nif ! printf '%s\\n' "$LABELS" | grep -qx 'needs-backport'; then\n  echo "already absent"\n  exit 0\nfi\ngh api --silent --method DELETE "$R/labels/needs-backport"`,
      'does not read the label list into a variable'
    ],
    [
      'reads the label list only after deciding from it',
      `set -euo pipefail\nif ! printf '%s\\n' "$LABELS" | grep -qx 'needs-backport'; then\n  echo "already absent"\n  exit 0\nfi\nLABELS=$(gh api "$R/labels" --jq '.[].name')\ngh api --silent --method DELETE "$R/labels/needs-backport"`,
      'checks for the label before reading it'
    ],
    [
      'deletes first and checks afterwards',
      `set -euo pipefail\ngh api --silent --method DELETE "$R/labels/needs-backport"\nLABELS=$(gh api "$R/labels" --jq '.[].name')\nprintf '%s\\n' "$LABELS" | grep -qx 'needs-backport'`,
      'deletes the label before checking for it'
    ],
    [
      'treats a failed label read as absence by piping into grep',
      `set -euo pipefail\nif ! gh api "$R/labels" --jq '.[].name' | grep -qx 'needs-backport'; then\n  echo "already absent"\n  exit 0\nfi\ngh api --silent --method DELETE "$R/labels/needs-backport"`,
      'pipes the label read straight into grep, so a failed read reads as absence'
    ],
    [
      'omits strict shell mode',
      `LABELS=$(gh api "$R/labels" --jq '.[].name')\nif ! printf '%s\\n' "$LABELS" | grep -qx 'needs-backport'; then\n  exit 0\nfi\ngh api --silent --method DELETE "$R/labels/needs-backport"`,
      'does not set -euo pipefail'
    ]
  ])('rejects a cleanup step that %s', ([, script, expected]) => {
    expect(labelStepViolations(script)).toContain(expected)
  })
})
