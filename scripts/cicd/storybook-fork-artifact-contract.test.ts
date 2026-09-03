import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  name?: string
  if?: string
  uses?: string
  with?: { name?: string }
}

interface WorkflowJob {
  if?: string
  steps?: WorkflowStep[]
}

interface Workflow {
  jobs?: Record<string, WorkflowJob>
}

const readWorkflow = (path: string) =>
  parse(readFileSync(path, 'utf8')) as Workflow

const findStep = (workflow: Workflow, name: string) => {
  const step = Object.values(workflow.jobs ?? {})
    .flatMap((job) => job.steps ?? [])
    .find((step) => step.name === name)

  expect(step, `Missing workflow step: ${name}`).toBeDefined()
  return step!
}

describe('fork Storybook artifact contract', () => {
  it('uploads the artifact consumed by the trusted fork deployment workflow', () => {
    const producer = readWorkflow('.github/workflows/ci-tests-storybook.yaml')
    const consumer = readWorkflow(
      '.github/workflows/ci-tests-storybook-forks.yaml'
    )
    const upload = findStep(producer, 'Upload Storybook build')
    const download = findStep(consumer, 'Download and Deploy Storybook')

    expect(upload.uses).toMatch(/^actions\/upload-artifact@/)
    expect(upload.if).toBe('success()')
    expect(download.uses).toMatch(/^actions\/download-artifact@/)
    expect(download.with?.name).toBe(upload.with?.name)
  })
})
