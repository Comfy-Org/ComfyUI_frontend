import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

type WorkflowStep = {
  name?: string
  if?: string
  uses?: string
  run?: string
  with?: Record<string, unknown>
}

type WorkflowJob = {
  if?: string
  uses?: string
  secrets?: unknown
  steps?: WorkflowStep[]
  with?: Record<string, unknown>
}

type Workflow = {
  on?: Record<string, unknown>
  jobs: Record<string, WorkflowJob>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOptionalString(
  value: Record<string, unknown>,
  key: string
): boolean {
  return value[key] === undefined || typeof value[key] === 'string'
}

function isWorkflowStep(value: unknown): value is WorkflowStep {
  return (
    isRecord(value) &&
    hasOptionalString(value, 'name') &&
    hasOptionalString(value, 'if') &&
    hasOptionalString(value, 'uses') &&
    hasOptionalString(value, 'run') &&
    (value.with === undefined || isRecord(value.with))
  )
}

function isWorkflowJob(value: unknown): value is WorkflowJob {
  return (
    isRecord(value) &&
    hasOptionalString(value, 'if') &&
    hasOptionalString(value, 'uses') &&
    (value.steps === undefined ||
      (Array.isArray(value.steps) && value.steps.every(isWorkflowStep))) &&
    (value.with === undefined || isRecord(value.with))
  )
}

function isWorkflow(value: unknown): value is Workflow {
  return (
    isRecord(value) &&
    isRecord(value.jobs) &&
    Object.values(value.jobs).every(isWorkflowJob) &&
    (value.on === undefined || isRecord(value.on))
  )
}

function readWorkflow(path: string): Workflow {
  const value: unknown = parse(readFileSync(path, 'utf8'))
  if (!isWorkflow(value)) {
    throw new Error(`Invalid workflow structure in ${path}`)
  }
  return value
}

describe('E2E coverage workflows', () => {
  it('packages coverage in the unprivileged E2E run', () => {
    const packageWorkflow = readWorkflow(
      '.github/workflows/ci-tests-e2e-coverage-package.yaml'
    )
    const e2eWorkflow = readWorkflow('.github/workflows/ci-tests-e2e.yaml')
    const packageSteps = packageWorkflow.jobs.package.steps ?? []
    const checkout = packageSteps.find((step) =>
      step.uses?.startsWith('actions/checkout@')
    )
    const packageJob = e2eWorkflow.jobs['upload-e2e-coverage']

    expect(packageWorkflow.on).toHaveProperty('workflow_call')
    expect(checkout?.with?.ref).toBe('${{ inputs.source_sha }}')
    expect(packageSteps.some((step) => step.run?.includes('lcov '))).toBe(true)
    expect(packageSteps.some((step) => step.run?.includes('genhtml '))).toBe(
      true
    )
    expect(packageJob.uses).toBe(
      './.github/workflows/ci-tests-e2e-coverage-package.yaml'
    )
    expect(packageJob.secrets).toBeUndefined()
    expect(packageJob.if).not.toContain('fork == false')
    expect(packageJob.with).toMatchObject({
      source_run_id: "${{ format('{0}', github.run_id) }}",
      source_sha: '${{ github.event.pull_request.head.sha || github.sha }}'
    })
  })

  it('publishes only fixed artifacts from the exact triggering run', () => {
    const publishWorkflow = readWorkflow(
      '.github/workflows/ci-tests-e2e-coverage.yaml'
    )
    const publishSteps = publishWorkflow.jobs.publish.steps ?? []
    const checkouts = publishSteps.filter((step) =>
      step.uses?.startsWith('actions/checkout@')
    )
    const coverageDownloads = publishSteps.filter(
      (step) =>
        step.uses?.startsWith('dawidd6/action-download-artifact@') &&
        step.with?.name === 'e2e-coverage'
    )
    const resolver = publishSteps.find(
      (step) => step.uses === './.github/actions/resolve-pr-from-workflow-run'
    )
    const codecov = publishSteps.find((step) =>
      step.uses?.startsWith('codecov/codecov-action@')
    )

    expect(publishWorkflow.on).toHaveProperty('workflow_run')
    expect(checkouts).not.toHaveLength(0)
    for (const checkout of checkouts) {
      expect(checkout.with).toMatchObject({
        ref: '${{ github.event.repository.default_branch }}',
        'persist-credentials': false
      })
    }
    expect(coverageDownloads).toHaveLength(1)
    expect(coverageDownloads[0]?.with).toMatchObject({
      run_id: '${{ github.event.workflow_run.id }}',
      name: 'e2e-coverage',
      path: 'coverage/playwright'
    })
    expect(resolver?.if).toContain("workflow_run.event == 'pull_request'")
    expect(codecov?.with).toMatchObject({
      files: 'coverage/playwright/coverage.lcov',
      override_branch: '${{ github.event.workflow_run.head_branch }}',
      override_commit:
        '${{ steps.pr-meta.outputs.head-sha || github.event.workflow_run.head_sha }}',
      override_pr: '${{ steps.pr-meta.outputs.number }}'
    })
    expect(
      publishSteps.some(
        (step) =>
          step.run !== undefined && /(^|\n)\s*(lcov|genhtml)\s/.test(step.run)
      )
    ).toBe(false)
  })

  it('makes packaged PR coverage discoverable from the E2E run', () => {
    const reportWorkflow = readWorkflow('.github/workflows/pr-report.yaml')
    const reportSteps = reportWorkflow.jobs.comment.steps ?? []
    const workflowRun = reportWorkflow.on?.workflow_run
    const coverageLookup = reportSteps.find(
      (step) => step.name === 'Find coverage workflow run'
    )

    expect(workflowRun).toMatchObject({
      workflows: expect.arrayContaining(['CI: Tests E2E'])
    })
    expect(coverageLookup?.with).toMatchObject({
      'workflow-id': 'ci-tests-e2e.yaml',
      'head-sha': '${{ steps.pr-meta.outputs.head-sha }}',
      'artifact-name': 'e2e-coverage',
      'not-found-status': 'skip'
    })
  })
})
