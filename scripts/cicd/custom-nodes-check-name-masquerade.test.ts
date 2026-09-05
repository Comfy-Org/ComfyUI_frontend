import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

// A `workflow_dispatch` check run is attributed to the ref the workflow was
// dispatched from, not to whatever the run actually tested, and a newer check
// suite supersedes the ref's earlier one of the same name. So any dispatch input
// that changes WHAT is tested has to be visible in the name, or the dispatch
// publishes its verdict under the ref's real grade. These assertions are the
// guard: adding an input without naming it fails here rather than silently
// re-opening the hole.
const WORKFLOW_PATH = '.github/workflows/ci-tests-custom-nodes.yaml'

interface Workflow {
  'run-name'?: string
  on?: { workflow_dispatch?: { inputs?: Record<string, unknown> } }
  // A missing job is a real possibility here - renaming one is exactly the kind
  // of change these assertions exist to catch - so the lookups stay optional.
  jobs?: Record<string, { name?: string } | undefined>
}

const workflow = parse(readFileSync(WORKFLOW_PATH, 'utf8')) as Workflow
const dispatchInputs = Object.keys(workflow.on?.workflow_dispatch?.inputs ?? {})
const runName = workflow['run-name'] ?? ''
const matrixName = workflow.jobs?.custom_nodes_e2e?.name ?? ''
const aggregateName = workflow.jobs?.['custom-nodes-e2e-status']?.name ?? ''

// The matrix already renders these two inputs as matrix fields, so the job name
// distinguishes them without naming the input itself.
const MATRIX_SURROGATE: Record<string, string | undefined> = {
  detection_proof_row: '${{ matrix.proof_row }}',
  record_interactions: '${{ matrix.shard }}'
}

// `record_interactions` forces GREP_FILTER to `interaction profiles`, so a name
// that printed the caller's `grep` beside it would advertise a filter that never
// ran. The two labels are mutually exclusive, in this exact order.
const EXCLUSIVE_GREP_LABEL =
  "inputs.record_interactions && ' [record_interactions]' || inputs.grep"

const segmentsOf = (name: string) =>
  [...name.matchAll(/\$\{\{(.+?)\}\}/g)].map(([, body]) => body.trim())

describe('custom-node check-run names cannot masquerade as the ref grade', () => {
  it('parses the dispatch inputs it is meant to guard', () => {
    expect(dispatchInputs).toEqual(
      expect.arrayContaining([
        'detection_proof_row',
        'branch',
        'grep',
        'comfyui_ref',
        'record_interactions'
      ])
    )
  })

  it('names the aggregate check for every dispatch input', () => {
    expect(aggregateName).toMatch(/^E2E Custom Nodes Test\$\{\{/)

    for (const input of dispatchInputs) {
      expect(aggregateName, `aggregate name ignores ${input}`).toContain(
        `inputs.${input}`
      )
    }
  })

  it('distinguishes each matrix check, by input or by matrix field', () => {
    expect(matrixName).toMatch(/^custom_nodes_e2e \(\$\{\{ matrix\.shard \}\}/)

    for (const input of dispatchInputs) {
      const distinguisher =
        matrixName.includes(`inputs.${input}`) ||
        matrixName.includes(MATRIX_SURROGATE[input] ?? '\0')

      expect(distinguisher, `matrix name ignores ${input}`).toBe(true)
    }
  })

  it('never labels a record_interactions run with the overridden grep', () => {
    for (const [label, name] of [
      ['run-name', runName],
      ['matrix name', matrixName],
      ['aggregate name', aggregateName]
    ] as const) {
      if (!name.includes('inputs.grep')) continue

      expect(name, `${label} labels grep without the override`).toContain(
        EXCLUSIVE_GREP_LABEL
      )
    }
  })

  it('leaves a scheduled run the bare names', () => {
    // A schedule run has an empty `inputs` context, so each suffix has to be
    // guarded by `inputs.` alone and fall back to the empty string. Anything
    // else would let the nightly publish under a suffixed name, which is the
    // same defect pointed the other way.
    for (const [label, name] of [
      ['run-name', runName],
      ['matrix name', matrixName],
      ['aggregate name', aggregateName]
    ] as const) {
      for (const segment of segmentsOf(name)) {
        if (segment.startsWith('matrix.')) continue

        expect(segment, `${label} has an unguarded segment`).toMatch(
          /^inputs\./
        )
        expect(segment, `${label} segment has no empty fallback`).toMatch(
          /\|\|\s*''$/
        )
      }
    }
  })
})
