import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  name?: string
  run?: string
}

interface WorkflowJob {
  steps?: WorkflowStep[]
}

interface Workflow {
  concurrency?: {
    group?: string
    'cancel-in-progress'?: boolean
  }
  jobs?: Record<string, WorkflowJob>
  on?: {
    pull_request?: unknown
    workflow_dispatch?: unknown
  }
}

const workflow = parse(
  readFileSync('.github/workflows/cloud-backport-tag.yaml', 'utf8')
) as Workflow

const tagScript = workflow.jobs?.['create-tag']?.steps?.find(
  (step) => step.name === 'Create tag for cloud backport'
)?.run

describe('cloud backport tag workflow', () => {
  it('supports merged backports and manual recovery', () => {
    expect(workflow.on?.pull_request).toBeDefined()
    expect(workflow.on?.workflow_dispatch).toBeDefined()
  })

  it('preserves every merged commit as an independent run', () => {
    expect(workflow.concurrency?.group).toContain(
      'github.event.pull_request.merge_commit_sha'
    )
    expect(workflow.concurrency?.group).toContain('github.run_id')
    expect(workflow.concurrency?.['cancel-in-progress']).toBe(false)
  })

  it('creates an exact tag ref through the GitHub API without git push', () => {
    expect(tagScript).toBeDefined()
    expect(tagScript).toContain('--method POST')
    expect(tagScript).toContain('repos/${GITHUB_REPOSITORY}/git/refs')
    expect(tagScript).toContain('-f ref="refs/tags/${TAG}"')
    expect(tagScript).toContain('-f sha="${SHA}"')
    expect(tagScript).not.toMatch(/\bgit push\b/)
  })

  it('treats existing and concurrently created tags as successful no-ops', () => {
    expect(tagScript?.match(/git\/ref\/tags\/\$\{TAG\}/g)).toHaveLength(2)
    expect(tagScript?.match(/\[\[ "\$EXISTING" == "\$SHA" \]\]/g)).toHaveLength(
      2
    )
    expect(tagScript).toContain('was created concurrently')
    expect(tagScript).toContain(
      'already points at ${EXISTING}, expected ${SHA}'
    )
    expect(tagScript).toContain(
      'was created concurrently at ${EXISTING}, expected ${SHA}'
    )
  })
})
