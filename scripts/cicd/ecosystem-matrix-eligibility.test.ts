/**
 * The corpus pin bump is the one PR the ecosystem matrix exists to measure,
 * and for a while it was the one PR the matrix skipped.
 *
 * Two independent facts have to agree for it to run, and neither file names
 * the other:
 *
 *   - `update-corpus-pins.yaml` opens its PR from a fixed branch.
 *   - `ci-ecosystem-matrix.yaml` admits a `pull_request` only when
 *     `github.head_ref` is on its allowlist.
 *
 * When they disagreed the matrix did not fail - `changes.should-run` reported
 * false, the gate passed as "not applicable", and a month of ecosystem churn
 * merged unmeasured. The drift then surfaced as a red on the next unrelated
 * version-bump PR, which is precisely the attribution this instrument is
 * built to protect.
 *
 * No linter catches it. Both files stay valid YAML through the whole
 * failure, so yamllint and any schema check pass; the defect is in what the
 * expression computes, not in how it is written. So this guard evaluates the
 * real gate expression against real candidate contexts, and it has to fail
 * when either side drifts:
 *
 *   - The bump branch is read out of the bump workflow, never written here as
 *     a literal, so renaming it reds this suite instead of silently falling
 *     off the allowlist.
 *   - The last case deletes the corpus clause from the parsed expression and
 *     asserts the bump PR goes ineligible, so the clause cannot be dropped
 *     while this suite stays green.
 */
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const REPOSITORY = 'Comfy-Org/ComfyUI_frontend'

const workflowSchema = z.object({
  jobs: z.record(
    z.string(),
    z.object({
      outputs: z.record(z.string(), z.string()).optional(),
      steps: z
        .array(
          z.object({
            name: z.string().optional(),
            uses: z.string().optional(),
            with: z.record(z.string(), z.unknown()).optional()
          })
        )
        .optional()
    })
  )
})

const workflow = (file: string) =>
  workflowSchema.parse(parse(readFileSync(`.github/workflows/${file}`, 'utf8')))

const matrix = workflow('ci-ecosystem-matrix.yaml')
const bump = workflow('update-corpus-pins.yaml')

/** The gate under test, verbatim from the workflow that enforces it. */
const shouldRun = matrix.jobs['changes'].outputs?.['should-run']
if (!shouldRun) throw new Error('ci-ecosystem-matrix lost changes.should-run')

/** The branch the bump workflow actually opens its PR from. */
const bumpBranch = (() => {
  const step = bump.jobs['update-pins'].steps?.find((candidate) =>
    candidate.uses?.startsWith('peter-evans/create-pull-request@')
  )
  const branch = step?.with?.['branch']
  return z.string().min(1).parse(branch)
})()

/**
 * Evaluates one `${{ }}` Actions expression.
 *
 * Property access becomes optional chaining so a context GitHub leaves unset
 * - `github.event.pull_request` on a `push` - yields undefined rather than
 * throwing, matching the null propagation the real evaluator performs.
 * `startsWith` is supplied because it is an Actions builtin, not JavaScript.
 */
function evaluate(expression: string, context: object) {
  const javascript = expression
    .slice(3, -2)
    .replace(/\.([a-zA-Z_][\w-]*)/g, '?.["$1"]')
  return z.boolean().parse(
    runInNewContext(javascript, {
      ...context,
      startsWith: (haystack: unknown, needle: unknown) =>
        String(haystack ?? '').startsWith(String(needle ?? ''))
    })
  )
}

interface Candidate {
  /** `pull_request`, `push`, or `workflow_dispatch`. */
  event?: string
  headRef?: string
  /** Head repository, so a fork candidate can be expressed. */
  headRepo?: string
  changedFiles?: number
  /** What `changes-filter` reports for this candidate's paths. */
  source?: string
}

function context({
  event = 'pull_request',
  headRef = 'feature/some-change',
  headRepo = REPOSITORY,
  changedFiles = 1,
  source = 'true'
}: Candidate) {
  return {
    github: {
      event_name: event,
      repository: REPOSITORY,
      head_ref: event === 'pull_request' ? headRef : '',
      event:
        event === 'pull_request'
          ? {
              pull_request: {
                head: { repo: { full_name: headRepo } },
                changed_files: changedFiles
              }
            }
          : {}
    },
    steps: { changes: { outputs: { 'should-run-source': source } } }
  }
}

/**
 * The bump PR as it is actually opened: the workflow's own branch, and the
 * single-file diff a pin bump produces. `changed_files >= 3000` is false for
 * it, so its eligibility rests entirely on the head-ref clause.
 */
const corpusBump: Candidate = { headRef: bumpBranch, changedFiles: 1 }

describe('ecosystem matrix candidate eligibility', () => {
  it.for([
    ['the corpus pin bump PR', corpusBump, true],
    [
      'a corpus bump whose diff is also huge',
      { ...corpusBump, changedFiles: 4000, source: 'false' },
      true
    ],
    ['a release version bump PR', { headRef: 'version-bump-1.42.0' }, true],
    ['an ordinary feature PR', { headRef: 'feature/some-change' }, false],
    [
      'a corpus-named branch from a fork',
      { ...corpusBump, headRepo: 'someone/ComfyUI_frontend' },
      false
    ],
    [
      'a corpus-named branch touching only docs',
      { ...corpusBump, source: 'false' },
      false
    ],
    ['a push to main', { event: 'push' }, true],
    ['a manual dispatch', { event: 'workflow_dispatch' }, true]
  ] satisfies [string, Candidate, boolean][])(
    '%s',
    ([, candidate, expected]) => {
      expect(evaluate(shouldRun, context(candidate))).toBe(expected)
    }
  )

  it('goes ineligible if the corpus clause is removed', () => {
    const clause = `|| github.head_ref == '${bumpBranch}'`
    expect(shouldRun).toContain(clause)

    const withoutClause = shouldRun.replace(clause, '')
    expect(evaluate(withoutClause, context(corpusBump))).toBe(false)
    expect(
      evaluate(withoutClause, context({ headRef: 'version-bump-1.42.0' }))
    ).toBe(true)
  })
})

describe('corpus pin bump PR creation', () => {
  const step = () => {
    const found = bump.jobs['update-pins'].steps?.find((candidate) =>
      candidate.uses?.startsWith('peter-evans/create-pull-request@')
    )
    if (!found) throw new Error('update-corpus-pins lost its PR step')
    return found
  }

  /**
   * Actions is not permitted to create pull requests in this repository, so
   * the default token pushes the branch and then fails at the last step,
   * leaving a branch with no PR (run 40909305797).
   */
  it('opens the PR with PR_GH_TOKEN', () => {
    expect(step().with?.['token']).toBe('${{ secrets.PR_GH_TOKEN }}')
  })
})
