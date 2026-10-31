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

const shouldRun = matrix.jobs['changes'].outputs?.['should-run']
if (!shouldRun) throw new Error('ci-ecosystem-matrix lost changes.should-run')

const bumpBranch = (() => {
  const step = bump.jobs['update-pins'].steps?.find((candidate) =>
    candidate.uses?.startsWith('peter-evans/create-pull-request@')
  )
  const branch = step?.with?.['branch']
  return z.string().min(1).parse(branch)
})()

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
  event?: string
  headRef?: string
  headRepo?: string
  changedFiles?: number
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

  it('opens the PR with PR_GH_TOKEN', () => {
    expect(step().with?.['token']).toBe('${{ secrets.PR_GH_TOKEN }}')
  })
})
