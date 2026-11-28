import { readFileSync } from 'node:fs'

import { assert, describe, expect, it } from 'vitest'
import { isMap, isSeq, parseDocument } from 'yaml'
import { z } from 'zod'

const action = parseDocument(
  readFileSync('.github/actions/find-workflow-run/action.yaml', 'utf8')
)
const script = z
  .string()
  .parse(action.getIn(['runs', 'steps', 0, 'with', 'script']))
const producer = parseDocument(
  readFileSync('.github/workflows/ci-dist-inspection.yaml', 'utf8')
)
const reporter = parseDocument(
  readFileSync('.github/workflows/pr-report.yaml', 'utf8')
)
const steps = reporter.getIn(['jobs', 'comment', 'steps'])
assert(isSeq(steps))
const reporterSteps = z
  .array(z.object({ id: z.string().optional(), with: z.unknown().optional() }))
  .parse(steps.toJSON())
const sizeInputs = z
  .record(z.string(), z.string())
  .parse(reporterSteps.find((step) => step.id === 'find-size')?.with)

function interpolate(value: string, bindings: Record<string, string>) {
  return value.replace(/\$\{\{(.*?)\}\}/g, (_, expression: string) => {
    const key = expression.trim()
    if (!(key in bindings)) throw new Error(`Missing binding: ${key}`)
    return bindings[key]
  })
}

const inputBindings = Object.fromEntries(
  Object.entries(sizeInputs).map(([name, value]) => [
    `inputs.${name}`,
    interpolate(value, {
      'steps.pr-meta.outputs.head-sha': 'same-head',
      'steps.pr-meta.outputs.number': '17',
      'secrets.GITHUB_TOKEN': 'test-token'
    })
  ])
)
const env = action.getIn(['runs', 'steps', 0, 'env'])
assert(isMap(env))
const sizeEnv = Object.fromEntries(
  Object.entries(z.record(z.string(), z.string()).parse(env.toJSON())).map(
    ([name, value]) => [name, interpolate(value, inputBindings)]
  )
)

const AsyncFunction: new (
  ...args: string[]
) => (...args: unknown[]) => Promise<void> = Object.getPrototypeOf(
  async () => {}
).constructor

type Run = {
  id: number
  display_title: string
  event: string
  head_sha: string
  status: string
  conclusion: string | null
}

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: 42,
    display_title: interpolate(z.string().parse(producer.get('run-name')), {
      'github.event.pull_request.number || github.ref': '17'
    }),
    event: 'pull_request',
    head_sha: 'same-head',
    status: 'completed',
    conclusion: 'success',
    ...overrides
  }
}

async function findRun(
  runs: Run[],
  env: Record<string, string>,
  artifacts = [{ name: 'size-data', expired: false }]
) {
  const outputs: Record<string, string> = {}
  const listWorkflowRuns = async ({
    event,
    head_sha,
    per_page,
    page = 1
  }: {
    event?: string
    head_sha: string
    per_page: number
    page?: number
  }) => ({
    data: {
      workflow_runs: runs
        .filter((run) => run.head_sha === head_sha)
        .filter((run) => !event || run.event === event)
        .slice((page - 1) * per_page, page * per_page)
    }
  })
  const paginate = Object.assign(async () => artifacts, {
    async *iterator(
      method: typeof listWorkflowRuns,
      parameters: Parameters<typeof listWorkflowRuns>[0]
    ): AsyncIterable<{ data: Run[] }> {
      for (let page = 1; ; page++) {
        const response = await method({ ...parameters, page })
        yield { data: response.data.workflow_runs }
        if (response.data.workflow_runs.length < parameters.per_page) return
      }
    }
  })
  await new AsyncFunction('github', 'context', 'core', 'process', script)(
    {
      rest: { actions: { listWorkflowRuns, listWorkflowRunArtifacts() {} } },
      paginate
    },
    { repo: { owner: 'Comfy-Org', repo: 'ComfyUI_frontend' } },
    {
      setOutput(name: string, value: string) {
        outputs[name] = value
      }
    },
    { env }
  )
  return outputs
}

describe('size workflow run selection', () => {
  it.for(['completed', 'in_progress'])(
    'ignores a newer %s run for another PR sharing the same head',
    async (status) => {
      const outputs = await findRun(
        [
          run({ id: 99, event: 'push' }),
          run({ id: 81, display_title: 'Dist inspection for 29', status }),
          run()
        ],
        sizeEnv
      )

      expect(outputs).toEqual({ status: 'ready', 'run-id': '42' })
    }
  )

  it('finds the PR run beyond the first page', async () => {
    const outputs = await findRun(
      [
        ...Array.from({ length: 100 }, (_, id) =>
          run({ id: id + 100, display_title: 'Dist inspection for 29' })
        ),
        run()
      ],
      sizeEnv
    )

    expect(outputs).toEqual({ status: 'ready', 'run-id': '42' })
  })

  it('does not substitute another PR when the requested run is absent', async () => {
    const outputs = await findRun(
      [run({ display_title: 'Dist inspection for 29' })],
      sizeEnv
    )

    expect(outputs).toEqual({ status: 'skip' })
  })

  it('reports pending for the newest matching run instead of an older artifact', async () => {
    const outputs = await findRun(
      [run({ id: 51, status: 'in_progress', conclusion: null }), run()],
      sizeEnv
    )

    expect(outputs).toEqual({ status: 'pending' })
  })

  it('preserves newest-run selection for callers without a run name', async () => {
    const outputs = await findRun(
      [run({ id: 81, display_title: 'Another workflow' }), run()],
      { ...sizeEnv, RUN_NAME: '' }
    )

    expect(outputs).toEqual({ status: 'ready', 'run-id': '81' })
  })

  it.for([
    {
      name: 'uses size data despite a sibling check failure',
      conclusion: 'failure',
      artifacts: [{ name: 'size-data', expired: false }],
      expected: { status: 'ready', 'run-id': '42' }
    },
    {
      name: 'skips successful runs without size data',
      conclusion: 'success',
      artifacts: [],
      expected: { status: 'skip' }
    },
    {
      name: 'reports failure when a failed run has no size data',
      conclusion: 'failure',
      artifacts: [],
      expected: { status: 'failed' }
    }
  ])('$name', async ({ conclusion, artifacts, expected }) => {
    expect(await findRun([run({ conclusion })], sizeEnv, artifacts)).toEqual(
      expected
    )
  })
})
