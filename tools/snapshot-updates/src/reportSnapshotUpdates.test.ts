import { assert, describe, expect, it, vi } from 'vitest'

import { workflowStepRun } from './workflowStepRun'

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

async function sectionContent(env: Record<string, string>) {
  const outputs = new Map<string, string>()
  const script = workflowStepRun(
    'snapshot-update-commit.yaml',
    'result',
    'Build the section content'
  )
  assert.exists(script)
  const stepEnv = {
    TITLE: 'Update',
    UNAVAILABLE: '',
    MISSING: '',
    RUN_ID: '900',
    COMMIT_RESULT: 'success',
    HAS_CHANGES: 'false',
    CHANGED_COUNT: '0',
    ...env
  }
  for (const [name, value] of Object.entries(stepEnv)) vi.stubEnv(name, value)
  await new AsyncFunction('core', 'context', script)(
    { setOutput: (name: string, value: string) => outputs.set(name, value) },
    {
      serverUrl: 'https://github.com',
      repo: { owner: 'o', repo: 'r' },
      runId: 1
    }
  )
  return outputs.get('section-content') ?? ''
}

interface ReportCase {
  state: string
  env: Record<string, string>
  alert: string
  message: RegExp
}

describe('snapshot update report', () => {
  it.for<ReportCase>([
    {
      state: 'no changes and every job reported',
      env: {},
      alert: '> [!TIP]',
      message: /^> All screenshots are already up to date\.$/
    },
    {
      state: 'no changes while jobs left nothing to check',
      env: { MISSING: 'shard 3, desktop' },
      alert: '> [!CAUTION]',
      message:
        /cannot be confirmed up to date\..*not checked: shard 3, desktop\./
    },
    {
      state: 'changes while jobs left nothing to check',
      env: {
        MISSING: 'shard 3, desktop',
        HAS_CHANGES: 'true',
        CHANGED_COUNT: '2'
      },
      alert: '> [!WARNING]',
      message:
        /Updated 2 screenshots .*pushed to the branch\. These jobs in the \[E2E run\]\(https:\/\/github\.com\/o\/r\/actions\/runs\/900\) .*not checked: shard 3, desktop\./
    },
    {
      state: 'changes and every job reported',
      env: { HAS_CHANGES: 'true', CHANGED_COUNT: '1' },
      alert: '> [!TIP]',
      message: /^> Updated 1 screenshot taken from .*pushed to the branch\.$/
    }
  ])('reports $state', async ({ env, alert, message }) => {
    const lines = (await sectionContent(env)).split('\n')

    expect(lines.slice(0, 3)).toEqual(['## Update', '', alert])
    expect(lines[3]).toMatch(message)
  })
})
