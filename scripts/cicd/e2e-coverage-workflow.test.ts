import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

type WorkflowStep = {
  if?: string
  uses?: string
  with?: Record<string, string>
}

type Workflow = {
  jobs: Record<
    string,
    {
      if?: string
      steps?: WorkflowStep[]
      with?: Record<string, string>
    }
  >
}

function readWorkflow(path: string): Workflow {
  return parse(readFileSync(path, 'utf8')) as Workflow
}

describe('E2E coverage workflows', () => {
  it('packages fork coverage before entering the trusted workflow_run', () => {
    const coverageWorkflow = readWorkflow(
      '.github/workflows/ci-tests-e2e-coverage.yaml'
    )
    const e2eWorkflow = readWorkflow('.github/workflows/ci-tests-e2e.yaml')
    const coverageSteps = coverageWorkflow.jobs.merge.steps ?? []
    const checkout = coverageSteps.find((step) =>
      step.uses?.startsWith('actions/checkout@')
    )
    const download = coverageSteps.find(
      (step) => step.with?.name === 'e2e-coverage'
    )
    const codecov = coverageSteps.find((step) =>
      step.uses?.startsWith('codecov/codecov-action@')
    )
    const packageJob = e2eWorkflow.jobs['upload-e2e-coverage']

    expect(checkout?.if).toContain("github.event_name == 'workflow_call'")
    expect(download?.if).toContain("github.event_name == 'workflow_run'")
    expect(codecov?.if).toContain("github.event_name == 'workflow_run'")
    expect(codecov?.with).toMatchObject({
      override_branch:
        '${{ inputs.source_branch || github.event.workflow_run.head_branch }}',
      override_commit:
        '${{ inputs.source_sha || github.event.workflow_run.head_sha }}',
      override_pr:
        '${{ inputs.source_pr || github.event.workflow_run.pull_requests[0].number }}'
    })
    expect(packageJob.if).not.toContain('fork == false')
    expect(packageJob.with).toMatchObject({
      source_branch: '${{ github.head_ref || github.ref_name }}',
      source_sha: '${{ github.event.pull_request.head.sha || github.sha }}'
    })
  })
})
