import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const workflowSchema = z.object({
  name: z.string(),
  permissions: z.record(z.string(), z.string()),
  on: z.record(
    z.string(),
    z.object({
      types: z.array(z.string()).default([]),
      workflows: z.array(z.string()).default([])
    })
  ),
  jobs: z.record(
    z.string(),
    z.object({
      if: z.string().optional(),
      needs: z.string().optional(),
      permissions: z.record(z.string(), z.string()).optional(),
      steps: z
        .array(
          z.object({
            id: z.string().optional(),
            if: z.string().optional(),
            run: z.string().optional(),
            env: z.record(z.string(), z.string()).default({}),
            uses: z.string().optional(),
            with: z.record(z.string(), z.unknown()).default({})
          })
        )
        .default([])
    })
  )
})

function readWorkflow(file: string) {
  return workflowSchema.parse(parse(readFileSync(file, 'utf8')))
}

const producer = readWorkflow('.github/workflows/ci-feature-flag-policy.yaml')
const publisher = readWorkflow('.github/workflows/pr-feature-flag-policy.yaml')
const riskWorkflow = readWorkflow('.github/workflows/ci-pr-risk.yml')
const requestJob = producer.jobs.request
const gradingRequestJob = riskWorkflow.jobs['flag-policy-request']
const publishingJob = publisher.jobs.policy

it('binds privileged publication to a successful read-only producer run', () => {
  const checkout = publishingJob.steps.find((step) =>
    step.uses?.startsWith('actions/checkout@')
  )
  expect(checkout?.with).toMatchObject({
    ref: '${{ github.event.repository.default_branch }}',
    'persist-credentials': false
  })
  const upload = requestJob.steps.find((step) =>
    step.uses?.startsWith('actions/upload-artifact@')
  )
  const download = publishingJob.steps.find((step) =>
    step.uses?.startsWith('actions/download-artifact@')
  )
  expect(producer.permissions).toEqual({})
  expect(publisher.permissions).toEqual({
    contents: 'read',
    'pull-requests': 'read',
    actions: 'read',
    checks: 'write'
  })
  expect(publisher.on.workflow_run.workflows).toContain(producer.name)
  expect(z.string().parse(download?.with.name)).toBe(
    z.string().parse(upload?.with.name)
  )
  expect(download?.with['run-id']).toBe('${{ github.event.workflow_run.id }}')
  expect(publishingJob.if?.replace(/\s+/g, ' ').trim()).toBe(
    "(github.event.workflow_run.event == 'pull_request' || (github.event.workflow_run.event == 'workflow_dispatch' && github.event.workflow_run.name == 'CI - PR Risk Grade' && github.event.workflow_run.head_branch == github.event.repository.default_branch)) && (github.event.workflow_run.conclusion == 'success' || (github.event.workflow_run.name == 'CI - PR Risk Grade' && github.event.workflow_run.conclusion == 'failure'))"
  )
})

it('refreshes policy after label edits and automated risk grading without new write permissions', () => {
  const requestEvents = producer.on.pull_request.types
  const gradingEvents = riskWorkflow.on.pull_request.types
  expect([...requestEvents, ...gradingEvents]).toEqual(
    expect.arrayContaining([
      'opened',
      'edited',
      'labeled',
      'unlabeled',
      'synchronize'
    ])
  )
  expect(
    requestEvents.filter((event) => gradingEvents.includes(event))
  ).toEqual([])
  expect(publisher.on.workflow_run.workflows).toContain(riskWorkflow.name)
  expect(gradingRequestJob.needs).toBe('pr-risk')
  expect(gradingRequestJob.permissions).toEqual({ 'pull-requests': 'read' })
  const upload = gradingRequestJob.steps.find((step) =>
    step.uses?.startsWith('actions/upload-artifact@')
  )
  expect(upload?.with.name).toBe('feature-flag-request')
  expect(publishingJob.steps.find((step) => step.id === 'pr')?.if).toBe(
    "github.event.workflow_run.event == 'pull_request'"
  )
  expect(
    publishingJob.steps.find((step) => 'POLICY_REQUEST_PATH' in step.env)?.env
      .TRUSTED_DEFAULT_BRANCH_DISPATCH
  ).toBe(
    "${{ github.event.workflow_run.event == 'workflow_dispatch' && github.event.workflow_run.name == 'CI - PR Risk Grade' && github.event.workflow_run.head_branch == github.event.repository.default_branch }}"
  )
})

describe('request capture at the workflow boundary', () => {
  let directory = ''
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'feature-flag-request-'))
    writeFileSync(
      join(directory, 'event.json'),
      JSON.stringify({
        pull_request: { number: 17526, head: { sha: 'a'.repeat(40) } }
      })
    )
    writeFileSync(
      join(directory, 'gh'),
      `#!/bin/sh
case "$2" in
  repos/Comfy-Org/ComfyUI_frontend/pulls/17526) printf '%s\\n' '{"pr_number":17526,"head_sha":"${'a'.repeat(40)}"}' ;;
  repos/Comfy-Org/ComfyUI_frontend/pulls/17527) printf '%s\\n' '{"pr_number":17527,"head_sha":"${'b'.repeat(40)}"}' ;;
  *) exit 42 ;;
esac
`,
      { mode: 0o700 }
    )
  })
  afterEach(() => rmSync(directory, { recursive: true, force: true }))

  function captureScript(job: typeof requestJob) {
    return z
      .string()
      .parse(
        job.steps.find((step) =>
          step.run?.includes('feature-flag-request.json')
        )?.run
      )
  }

  function capture(source: string, event: string, targets = '') {
    execFileSync('bash', ['-e', '-o', 'pipefail', '-c', source], {
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        GH_TOKEN: 'test-token',
        GITHUB_REPOSITORY: 'Comfy-Org/ComfyUI_frontend',
        GITHUB_EVENT_NAME: event,
        GITHUB_EVENT_PATH: join(directory, 'event.json'),
        RUNNER_TEMP: directory,
        PR_NUMBERS: targets
      },
      stdio: 'pipe'
    })
    const result: unknown = JSON.parse(
      readFileSync(join(directory, 'feature-flag-request.json'), 'utf8')
    )
    return result
  }

  it.for([
    { name: 'body edits', job: requestJob },
    {
      name: 'automatic risk grading',
      job: gradingRequestJob
    }
  ])('captures only the triggering PR and head for $name', ({ job }) => {
    expect(capture(captureScript(job), 'pull_request')).toEqual([
      { pr_number: 17526, head_sha: 'a'.repeat(40) }
    ])
  })

  it('captures every distinct manually graded target from live PR metadata', () => {
    expect(
      capture(
        captureScript(gradingRequestJob),
        'workflow_dispatch',
        ' 17526,17527,17526 '
      )
    ).toEqual([
      { pr_number: 17526, head_sha: 'a'.repeat(40) },
      { pr_number: 17527, head_sha: 'b'.repeat(40) }
    ])
  })

  it.for(['', '17526,invalid', '0', '-1'])(
    'rejects invalid dispatch targets: %s',
    (targets) => {
      expect(() =>
        capture(captureScript(gradingRequestJob), 'workflow_dispatch', targets)
      ).toThrow()
    }
  )
})
