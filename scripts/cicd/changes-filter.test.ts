import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'

import { assert, expect, it } from 'vitest'
import { parse, parseDocument } from 'yaml'
import { z } from 'zod'

const action = z
  .object({
    outputs: z.record(z.string(), z.object({ value: z.string() })),
    runs: z.object({
      steps: z.array(
        z.object({
          id: z.string(),
          if: z.string().optional(),
          run: z.string().optional(),
          env: z.object({ EVALUATE: z.string() }).optional()
        })
      )
    })
  })
  .parse(
    parse(readFileSync('.github/actions/changes-filter/action.yaml', 'utf8'))
  )

function evaluateBoolean(expression: string, context: object) {
  const javascript = expression
    .slice(3, -2)
    .replace(/\.([a-zA-Z_][\w-]*)/g, '["$1"]')
  return z.boolean().parse(runInNewContext(javascript, context))
}

function selectChecks(eventName: string, relevant: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'changes-filter-'))
  try {
    const output = join(root, 'output')
    const mode = action.runs.steps.find((step) => step.id === 'mode')
    assert.exists(mode?.env)
    assert.exists(mode.run)
    const evaluate = evaluateBoolean(mode.env.EVALUATE, {
      github: { event_name: eventName },
      inputs: { 'evaluate-candidate': 'true' }
    })
    const result = spawnSync('bash', ['-eo', 'pipefail', '-c', mode.run], {
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        EVALUATE: String(evaluate),
        GITHUB_OUTPUT: output
      }
    })
    expect(result).toMatchObject({ status: 0, stderr: '' })
    const modeOutputs = Object.fromEntries(
      readFileSync(output, 'utf8')
        .trim()
        .split('\n')
        .map((line) => line.split('='))
    )
    const context = {
      steps: {
        mode: { outputs: modeOutputs },
        relevant: { outputs: {} },
        filter: { outputs: {} }
      }
    }
    const relevantStep = action.runs.steps.find(
      (step) => step.id === 'relevant'
    )
    assert.exists(relevantStep?.if)
    context.steps.relevant.outputs = evaluateBoolean(relevantStep.if, context)
      ? relevant
      : {}
    return Object.fromEntries(
      Object.entries(action.outputs).map(([name, { value }]) => [
        name,
        evaluateBoolean(value, context)
      ])
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const unitTestOnly = {
  relevant: 'true',
  unit: 'true',
  e2e: 'false',
  source: 'false'
}

it('requires E2E for an earlier source change followed by a unit-test-only queue candidate', () => {
  const selected = selectChecks('merge_group', unitTestOnly)
  const workflow = parseDocument(
    readFileSync('.github/workflows/ci-tests-e2e.yaml', 'utf8')
  )
  const command = z
    .string()
    .parse(workflow.getIn(['jobs', 'e2e-status', 'steps', 0, 'run']))
  const result = spawnSync('bash', ['-eo', 'pipefail', '-c', command], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      PREFLIGHT: 'success',
      CHANGES: 'success',
      SHOULD_RUN: String(selected['should-run-e2e']),
      SHARDED: 'skipped',
      CLOUD: 'skipped',
      BROWSERS: 'skipped',
      VIDEO: 'skipped'
    }
  })

  expect(result).toMatchObject({
    status: 1,
    stdout: expect.stringContaining('E2E failed')
  })
})

it.for(['merge_group', 'push', 'workflow_dispatch'])(
  'runs every check on %s without relying on a candidate-only range',
  (eventName) => {
    const selected = selectChecks(eventName, unitTestOnly)

    expect(selected).toEqual({
      'should-run': true,
      'should-run-unit': true,
      'should-run-e2e': true,
      'should-run-source': true,
      'app-website-changes': true,
      'app-billing-web-changes': true,
      'app-frontend-changes': true,
      'packages-changes': true,
      'storybook-changes': true,
      'docs-changes': true,
      'dependency-changes': true
    })
  }
)

it.for([
  { paths: unitTestOnly, unit: true, e2e: false, source: false },
  {
    paths: { relevant: 'true', unit: 'true', e2e: 'true', source: 'true' },
    unit: true,
    e2e: true,
    source: true
  },
  {
    paths: { relevant: 'false', unit: 'false', e2e: 'false', source: 'false' },
    unit: false,
    e2e: false,
    source: false
  }
])('preserves PR path selection: $paths', ({ paths, unit, e2e, source }) => {
  expect(selectChecks('pull_request', paths)).toMatchObject({
    'should-run-unit': unit,
    'should-run-e2e': e2e,
    'should-run-source': source
  })
})
