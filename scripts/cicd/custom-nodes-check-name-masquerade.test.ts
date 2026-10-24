import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const WORKFLOW_PATH = '.github/workflows/ci-tests-custom-nodes.yaml'
const DISPATCH_SUFFIX =
  "${{ github.event_name == 'workflow_dispatch' && format(' [dispatch: {0}]', github.run_id) || '' }}"

interface Job {
  name?: string
  env?: Record<string, string>
  strategy?: { matrix?: Record<string, unknown> }
  steps?: { env?: Record<string, string> }[]
}

interface Workflow {
  'run-name'?: string
  jobs?: Record<string, Job | undefined>
}

const workflow = parse(readFileSync(WORKFLOW_PATH, 'utf8')) as Workflow
const matrixJob = workflow.jobs?.custom_nodes_e2e

describe('custom-node check-run names cannot replace another run', () => {
  it('gives every dispatch unique run and check names', () => {
    expect([
      workflow['run-name'],
      matrixJob?.name,
      workflow.jobs?.['custom-nodes-e2e-status']?.name
    ]).toEqual([
      `CI: Tests Custom Nodes${DISPATCH_SUFFIX}`,
      'custom_nodes_e2e (${{ matrix.shard }}, ${{ matrix.proof_row }})' +
        DISPATCH_SUFFIX,
      `E2E Custom Nodes Test${DISPATCH_SUFFIX}`
    ])
  })

  it('names every matrix dimension', () => {
    const matrixKeys = Object.keys(matrixJob?.strategy?.matrix ?? {}).filter(
      (key) => key !== 'include' && key !== 'exclude'
    )

    expect(matrixKeys).not.toHaveLength(0)
    expect(
      matrixKeys.filter((key) => !matrixJob?.name?.includes(`matrix.${key}`))
    ).toEqual([])
  })

  it('defines the effective grep filter once for the whole matrix job', () => {
    expect(matrixJob?.env?.GREP_FILTER).toBeDefined()
    expect(matrixJob?.steps?.some((step) => step.env?.GREP_FILTER)).toBe(false)
  })
})
