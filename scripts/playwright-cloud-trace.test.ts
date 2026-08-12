// @vitest-environment jsdom
// happy-dom (the repo default) resolves @playwright/test's absolute import
// against http://localhost:3000 and dumps an unhandled ECONNREFUSED.
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  rmdirSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { PlaywrightTestConfig } from '@playwright/test'
import { describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'

// The cloud env seeds a real Firebase session, and page.evaluate arguments are
// recorded verbatim in a trace that CI uploads as a public artifact. Tracing
// must therefore be off under CUSTOM_NODES_ENV=cloud - the one invariant in
// this suite whose failure leaks a credential rather than reddening a test.
async function customNodesTrace(
  customNodesEnv: string | undefined
): Promise<unknown> {
  vi.resetModules()
  vi.stubEnv('CUSTOM_NODES_ENV', customNodesEnv)
  try {
    const config = (await import('../playwright.config')).default
    const project = config.projects?.find(
      (candidate) => candidate.name === 'custom-nodes'
    )
    if (!project) throw new Error('custom-nodes project is gone')
    return (project.use as PlaywrightTestConfig['use'])?.trace
  } finally {
    vi.unstubAllEnvs()
  }
}

describe('custom-nodes Playwright tracing', () => {
  it('is off under the cloud env, so a seeded session cannot reach an artifact', async () => {
    expect(await customNodesTrace('cloud')).toBe('off')
  })

  it('is retained on failure everywhere else, so a red core run stays debuggable', async () => {
    expect(await customNodesTrace(undefined)).toBe('retain-on-failure')
    expect(await customNodesTrace('core')).toBe('retain-on-failure')
  })
})

interface WorkflowStep {
  name?: string
  env?: Record<string, unknown>
  run?: string
}

function workflowSteps(path: string): WorkflowStep[] {
  const workflow = parse(readFileSync(path, 'utf8')) as {
    jobs: Record<string, { steps?: WorkflowStep[] }>
  }
  return Object.values(workflow.jobs).flatMap((job) => job.steps ?? [])
}

function runCloudActivationGate() {
  const gate = workflowSteps(
    '.github/workflows/ci-tests-custom-nodes-cloud.yaml'
  ).find((step) => step.name === 'Gate on cloud secrets and manifest')
  if (!gate?.run) throw new Error('Cloud activation gate is missing')
  const cwd = mkdtempSync(join(tmpdir(), 'custom-node-cloud-gate-'))
  const output = join(cwd, 'github-output')
  try {
    return spawnSync('bash', ['-c', gate.run], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_OUTPUT: output,
        SMOKE_ACCOUNT_EMAIL: 'smoke@example.com',
        SMOKE_ACCOUNT_PASSWORD: 'smoke-password'
      }
    })
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

interface WorkflowGate {
  path: string
  total: number
  resultFile: string
  deferS13ToS15: boolean
  collectionLabel: string
}

const workflowGates: WorkflowGate[] = [
  {
    path: '.github/workflows/ci-tests-custom-nodes.yaml',
    total: 33,
    resultFile: 'custom-nodes-results.json',
    deferS13ToS15: false,
    collectionLabel: 'active Core custom-node tests'
  },
  {
    path: '.github/workflows/ci-tests-custom-nodes-cloud.yaml',
    total: 102,
    resultFile: 'custom-nodes-cloud-results.json',
    deferS13ToS15: true,
    collectionLabel: 'S1-S12 tests'
  }
]

function runResultGate(
  workflow: WorkflowGate,
  json: object | string | undefined,
  grepFilter = ''
) {
  const resultGate = workflowSteps(workflow.path).find(
    (step) => step.name === 'Forbid failed, skipped, or flaky tests'
  )
  if (!resultGate?.run)
    throw new Error(`result gate missing in ${workflow.path}`)
  const cwd = mkdtempSync(join(tmpdir(), 'custom-node-result-gate-'))
  const resultPath = join(cwd, workflow.resultFile)
  try {
    if (json !== undefined)
      writeFileSync(
        resultPath,
        typeof json === 'string' ? json : JSON.stringify(json)
      )
    return spawnSync('bash', ['-c', resultGate.run], {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        EXPECTED_TESTS: String(workflow.total),
        GREP_FILTER: grepFilter,
        SUITE_OUTCOME: 'success'
      }
    })
  } finally {
    if (existsSync(resultPath)) unlinkSync(resultPath)
    rmdirSync(cwd)
  }
}

function resultJson(expected: number, unexpected = 0, flaky = 0, skipped = 0) {
  return { stats: { expected, unexpected, flaky, skipped } }
}

const coreS14Enabled =
  "matrix.proof_row != '0' || github.event_name != 'workflow_dispatch' || inputs.enable_s14"

function coreExpectedTests(
  proofRow: string,
  eventName: string,
  enableS14: boolean
) {
  return proofRow !== '0' || eventName !== 'workflow_dispatch' || enableS14
    ? 33
    : 32
}

describe('custom-node S1-S12 workflow gates', () => {
  it('accepts the Cloud gate with its required account secrets and manifest', () => {
    expect(runCloudActivationGate().status).toBe(0)
  })

  it.for(
    workflowGates.map((workflow) => ({
      ...workflow,
      name: workflow.path.includes('cloud') ? 'Cloud' : 'Core'
    }))
  )(
    '$name pins its exact active tier collection',
    ({ path, total, deferS13ToS15, collectionLabel }) => {
      const steps = workflowSteps(path)
      const suite = steps.find((step) =>
        step.name?.startsWith('Run custom-node')
      )
      const resultGate = steps.find(
        (step) => step.name === 'Forbid failed, skipped, or flaky tests'
      )
      const suiteCommand = suite?.run
        ?.split('\n')
        .filter((line) => !line.trimStart().startsWith('#'))
        .join('\n')

      if (deferS13ToS15)
        expect(suiteCommand).toContain('--grep-invert "interaction profiles:"')
      else
        expect(suiteCommand).not.toContain(
          '--grep-invert "interaction profiles:"'
        )
      expect(suiteCommand).toContain(
        'playwright test browser_tests/tests/customNodes/'
      )
      expect(suiteCommand?.match(/--project(?:=|\s+)\S+/g)).toEqual([
        '--project=custom-nodes'
      ])
      expect(suiteCommand?.match(/--reporter(?:=|\s+)\S+/g)).toEqual([
        '--reporter=list,json,html'
      ])
      expect(suiteCommand).not.toMatch(/(?:^|\s)--quiet(?:\s|$)/)
      if (deferS13ToS15)
        expect(suite?.env).toMatchObject({
          CN_ENABLE_S14: '0',
          CN_ENABLE_S15: '0'
        })
      else {
        expect(String(suite?.env?.CN_ENABLE_S14)).toContain(coreS14Enabled)
        expect(String(suite?.env?.CN_ENABLE_S15)).toContain('inputs.enable_s15')
        expect(String(resultGate?.env?.EXPECTED_TESTS)).toContain(
          coreS14Enabled
        )
        expect(String(resultGate?.env?.EXPECTED_TESTS)).toContain(
          "'33' || '32'"
        )
      }
      expect(suiteCommand?.match(/--workers(?:=|\s+)\S+/g)).toEqual([
        '--workers=1'
      ])
      expect(suiteCommand?.match(/--retries(?:=|\s+)\S+/g)).toEqual([
        '--retries=0'
      ])
      expect(suiteCommand).not.toMatch(/--shard(?:=|\s)/)
      if (deferS13ToS15) expect(resultGate?.env?.EXPECTED_TESTS).toBe(total)
      expect(resultGate?.run).toContain(
        '[.stats.expected, .stats.unexpected, .stats.flaky, .stats.skipped] | add'
      )
      expect(resultGate?.run).toContain(
        `expected exactly $EXPECTED_TESTS ${collectionLabel}`
      )
    }
  )

  it('keeps Core S14 execution, count, and summary aligned for every dispatch state', () => {
    const steps = workflowSteps('.github/workflows/ci-tests-custom-nodes.yaml')
    const suite = steps.find((step) => step.name?.startsWith('Run custom-node'))
    const resultGate = steps.find(
      (step) => step.name === 'Forbid failed, skipped, or flaky tests'
    )
    const summary = steps.find((step) => step.name === 'Publish results table')

    expect(String(suite?.env?.CN_ENABLE_S14)).toContain(coreS14Enabled)
    expect(String(resultGate?.env?.EXPECTED_TESTS)).toContain(coreS14Enabled)
    expect(String(summary?.env?.S14_ENABLED)).toContain(coreS14Enabled)

    expect(coreExpectedTests('0', 'workflow_dispatch', true)).toBe(33)
    expect(coreExpectedTests('0', 'workflow_dispatch', false)).toBe(32)
    expect(coreExpectedTests('14', 'workflow_dispatch', false)).toBe(33)
    expect(coreExpectedTests('0', 'pull_request', false)).toBe(33)
  })

  it.for(workflowGates)(
    '$path accepts only the exact all-green result',
    (workflow) => {
      const result = runResultGate(workflow, resultJson(workflow.total))
      expect(result.status).toBe(0)
    }
  )

  it.for(workflowGates)(
    '$path accepts an all-green filtered subset without hiding a failure',
    (workflow) => {
      expect(runResultGate(workflow, resultJson(4), 'S1:').status).toBe(0)
      expect(runResultGate(workflow, resultJson(3, 1), 'S1:').status).not.toBe(
        0
      )
    }
  )

  it.for(
    workflowGates.flatMap((workflow) => [
      {
        workflow,
        name: 'a smaller collection',
        json: resultJson(workflow.total - 1)
      },
      {
        workflow,
        name: 'a larger collection',
        json: resultJson(workflow.total + 1)
      },
      {
        workflow,
        name: 'an unexpected result',
        json: resultJson(workflow.total - 1, 1)
      },
      {
        workflow,
        name: 'a flaky result',
        json: resultJson(workflow.total - 1, 0, 1)
      },
      {
        workflow,
        name: 'a skipped result',
        json: resultJson(workflow.total - 1, 0, 0, 1)
      },
      { workflow, name: 'missing JSON', json: undefined },
      { workflow, name: 'malformed JSON', json: '{' }
    ])
  )('$workflow.path rejects $name', ({ workflow, json }) => {
    expect(runResultGate(workflow, json).status).not.toBe(0)
  })
})
