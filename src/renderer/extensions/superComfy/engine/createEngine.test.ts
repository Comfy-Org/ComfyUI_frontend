import { assert, describe, expect, it } from 'vitest'

import { createEngine } from './createEngine'
import type {
  AppContract,
  ExecutableNode,
  GenerateContract,
  SuperNode
} from './documentSchema'
import {
  appNode,
  deferredExecutor,
  docWith,
  edge,
  fileItem,
  freshOutputs,
  generateNode,
  ioNode,
  port,
  succeeded,
  testHost,
  withLastResult
} from './engineFixtures'
import type { FakeExecutor, TestHost } from './engineFixtures'
import { findNode } from './graphTopology'
import { activityOf, nodeProgress, visibleMissingPorts } from './selectors'
import type { RunEvent, RunOutcome, RunRequest, SuperComfyEvent } from './types'

const imageIn = port('image', 'image', { required: true })

function threeImages() {
  return ioNode('images', 'image', [
    fileItem('a1'),
    fileItem('a2'),
    fileItem('a3')
  ])
}

function sessionsStarted(events: RunEvent[]): number {
  return events.filter(({ type }) => type === 'sessionStarted').length
}

function settledRuns(events: RunEvent[]): number {
  return events.filter(
    ({ type }) => type === 'runSucceeded' || type === 'runFailed'
  ).length
}

function contractOf<T extends GenerateContract | AppContract>(
  node: ExecutableNode & { contract: T | null }
): T {
  assert(node.contract, 'fixture node has a contract')
  return node.contract
}

function applyEdits(harness: TestHost, edits: readonly SuperComfyEvent[]) {
  edits.forEach((event) => harness.edit(event))
}

async function nodesRunBy(
  run: () => Promise<unknown>,
  executors: readonly FakeExecutor[]
): Promise<string[]> {
  const before = executors.map(({ calls }) => calls.length)
  await run()
  return executors.flatMap(({ calls }, position) =>
    calls.slice(before[position]).map(({ request }) => request.node.id)
  )
}

function failFirstRun({ run }: RunRequest): RunOutcome {
  return run.index === 0
    ? { ok: false, message: 'Payment required' }
    : succeeded(fileItem(`r${run.index}`))
}

const generatedFirst = generateNode('first', 'image', { inputs: [imageIn] })
const appFirst = appNode('first', { inputs: [imageIn] })

describe(createEngine, () => {
  describe('graph runs', () => {
    it('[R2] starts no downstream node until every run of its upstream node has settled', async () => {
      const app = deferredExecutor()
      const generate = deferredExecutor({ answer: freshOutputs() })
      const harness = testHost(
        docWith(
          [
            threeImages(),
            appNode('app', { inputs: [imageIn] }),
            generateNode('gen', 'image', { inputs: [imageIn] })
          ],
          [
            edge('images', 'out', 'app', 'image'),
            edge('app', 'out', 'gen', 'image')
          ]
        ),
        { app, generate }
      )
      const engine = createEngine(harness.host)

      const finished = engine.runGraph()
      await app.untilCalls(3)
      app.calls[0].resolve(succeeded(fileItem('r1')))
      app.calls[1].resolve(succeeded(fileItem('r2')))
      await harness.until((_, events) => settledRuns(events) === 2)

      expect(activityOf(harness.state(), 'gen')).toEqual({
        phase: 'waiting',
        sessionId: 'session-1'
      })
      expect(generate.calls).toHaveLength(0)

      app.calls[2].resolve(succeeded(fileItem('r3')))
      await finished

      expect(generate.calls.map(({ request }) => request.run.inputs)).toEqual([
        { image: [fileItem('r1')] },
        { image: [fileItem('r2')] },
        { image: [fileItem('r3')] }
      ])
    })

    it('[R3a] an I/O node after 9 runs collects all 9 outputs as one batch in run order, even when runs settle in reverse', async () => {
      const app = deferredExecutor({ concurrency: 9 })
      const harness = testHost(
        docWith(
          [
            threeImages(),
            appNode('app', { inputs: [imageIn], runCount: 3 }),
            ioNode('results', 'image')
          ],
          [
            edge('images', 'out', 'app', 'image'),
            edge('app', 'out', 'results', 'in')
          ]
        ),
        { app, generate: deferredExecutor() }
      )
      const engine = createEngine(harness.host)

      const finished = engine.runGraph()
      await app.untilCalls(9)
      app.calls[8].resolve(succeeded(fileItem('out-8')))
      app.calls[7].resolve(succeeded(fileItem('out-7')))
      app.calls[6].resolve(succeeded(fileItem('out-6')))
      app.calls[5].resolve(succeeded(fileItem('out-5')))
      app.calls[4].resolve(succeeded(fileItem('out-4')))
      app.calls[3].resolve(succeeded(fileItem('out-3')))
      app.calls[2].resolve(succeeded(fileItem('out-2')))
      app.calls[1].resolve(succeeded(fileItem('out-1')))
      app.calls[0].resolve(succeeded(fileItem('out-0')))
      await finished

      expect(findNode(harness.state().doc, 'results')).toMatchObject({
        items: [
          fileItem('out-0'),
          fileItem('out-1'),
          fileItem('out-2'),
          fileItem('out-3'),
          fileItem('out-4'),
          fileItem('out-5'),
          fileItem('out-6'),
          fileItem('out-7'),
          fileItem('out-8')
        ]
      })
    })

    it('[R3b] that batch flows on: Image I/O (3) → App ×3 → Image I/O → App 2 plans 9 runs', async () => {
      const app = deferredExecutor({ answer: freshOutputs() })
      const harness = testHost(
        docWith(
          [
            threeImages(),
            appNode('first', { inputs: [imageIn], runCount: 3 }),
            ioNode('middle', 'image'),
            appNode('second', { inputs: [imageIn] })
          ],
          [
            edge('images', 'out', 'first', 'image'),
            edge('first', 'out', 'middle', 'in'),
            edge('middle', 'out', 'second', 'image')
          ]
        ),
        { app, generate: deferredExecutor() }
      )

      await createEngine(harness.host).runGraph()

      expect(
        app.calls
          .filter(({ request }) => request.node.id === 'second')
          .map(({ request }) => request.run.index)
      ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    })

    it('[R6a] a graph run starts nodes in dependency order', async () => {
      const generate = deferredExecutor({ answer: freshOutputs() })
      const harness = testHost(
        docWith(
          [
            generateNode('third', 'image', { inputs: [imageIn] }),
            generateNode('second', 'image', { inputs: [imageIn] }),
            generateNode('first', 'image', { inputs: [imageIn] }),
            ioNode('source', 'image', [fileItem('a')])
          ],
          [
            edge('source', 'out', 'first', 'image'),
            edge('first', 'out', 'second', 'image'),
            edge('second', 'out', 'third', 'image')
          ]
        ),
        { app: deferredExecutor(), generate }
      )

      await createEngine(harness.host).runGraph()

      expect(generate.calls.map(({ request }) => request.node.id)).toEqual([
        'first',
        'second',
        'third'
      ])
    })

    it('[R6b] a second graph run with nothing changed calls no executor and reports the node up to date', async () => {
      const generate = deferredExecutor({ answer: freshOutputs() })
      const harness = testHost(
        docWith(
          [
            ioNode('source', 'image', [fileItem('a'), fileItem('b')]),
            generateNode('gen', 'image', { inputs: [imageIn] }),
            ioNode('results', 'image')
          ],
          [
            edge('source', 'out', 'gen', 'image'),
            edge('gen', 'out', 'results', 'in')
          ]
        ),
        { app: deferredExecutor(), generate }
      )
      const engine = createEngine(harness.host)
      await engine.runGraph()
      expect(generate.calls).toHaveLength(2)

      const second = await engine.runGraph()

      expect(generate.calls).toHaveLength(2)
      expect(second).toMatchObject({ ok: true, outcomes: { gen: 'upToDate' } })
    })

    it.for<{ name: string; first: SuperNode; edits: SuperComfyEvent[] }>([
      {
        name: 'a setting changed',
        first: generatedFirst,
        edits: [
          {
            type: 'valueChanged',
            nodeId: 'first',
            name: 'quality',
            value: 'high'
          }
        ]
      },
      {
        name: 'another model with the same ports was picked',
        first: generatedFirst,
        edits: [
          { type: 'modelPicked', nodeId: 'first', modelId: 'other/model' },
          {
            type: 'modelContractResolved',
            nodeId: 'first',
            modelId: 'other/model',
            modelLabel: 'other',
            contract: contractOf(generatedFirst)
          }
        ]
      },
      {
        name: "the model's schema changed",
        first: generatedFirst,
        edits: [
          {
            type: 'modelContractResolved',
            nodeId: 'first',
            modelId: 'fake/model',
            modelLabel: 'model',
            contract: { ...contractOf(generatedFirst), version: 'v2' }
          }
        ]
      },
      {
        name: 'the saved app changed',
        first: appFirst,
        edits: [
          {
            type: 'appContractResolved',
            nodeId: 'first',
            workflowPath: 'first.app.json',
            title: 'first',
            contract: { ...contractOf(appFirst), version: 2 }
          }
        ]
      }
    ])(
      '[R6c] re-runs a node and its dependents only when $name',
      async ({ first, edits }) => {
        const app = deferredExecutor({ answer: freshOutputs() })
        const generate = deferredExecutor({ answer: freshOutputs() })
        const harness = testHost(
          docWith(
            [
              ioNode('source', 'image', [fileItem('a')]),
              first,
              generateNode('second', 'image', { inputs: [imageIn] }),
              generateNode('unrelated', 'image', { inputs: [imageIn] })
            ],
            [
              edge('source', 'out', 'first', 'image'),
              edge('first', 'out', 'second', 'image'),
              edge('source', 'out', 'unrelated', 'image')
            ]
          ),
          { app, generate }
        )
        const engine = createEngine(harness.host)
        await engine.runGraph()
        applyEdits(harness, edits)

        const rerun = await nodesRunBy(() => engine.runGraph(), [app, generate])

        expect(rerun).toEqual(['first', 'second'])
      }
    )

    it('[R6d] a graph run retries only the failed runs of a partially failed node', async () => {
      const generate = deferredExecutor()
      const harness = testHost(
        docWith(
          [threeImages(), generateNode('gen', 'image', { inputs: [imageIn] })],
          [edge('images', 'out', 'gen', 'image')]
        ),
        { app: deferredExecutor(), generate }
      )
      const engine = createEngine(harness.host)

      const firstRun = engine.runGraph()
      await generate.untilCalls(3)
      generate.calls[0].resolve(succeeded(fileItem('r0')))
      generate.calls[1].resolve({ ok: false, message: 'Provider timed out' })
      generate.calls[2].resolve(succeeded(fileItem('r2')))
      await firstRun
      generate.answerAll(() => succeeded(fileItem('r1')))
      await engine.runGraph()

      expect(generate.calls.map(({ request }) => request.run.index)).toEqual([
        0, 1, 2, 1
      ])
      expect(findNode(harness.state().doc, 'gen')).toMatchObject({
        result: {
          status: 'complete',
          outputs: { out: [fileItem('r0'), fileItem('r1'), fileItem('r2')] }
        }
      })
    })

    it('[R7a] reports settled runs while the node runs (4 of 9)', async () => {
      const app = deferredExecutor({ concurrency: 9 })
      const harness = testHost(
        docWith(
          [threeImages(), appNode('app', { inputs: [imageIn], runCount: 3 })],
          [edge('images', 'out', 'app', 'image')]
        ),
        { app, generate: deferredExecutor() }
      )
      const engine = createEngine(harness.host)

      const finished = engine.runGraph()
      await app.untilCalls(9)
      app.calls[0].resolve(succeeded(fileItem('r0')))
      app.calls[2].resolve({ ok: false, message: 'Out of memory' })
      app.calls[4].resolve(succeeded(fileItem('r4')))
      app.calls[8].resolve(succeeded(fileItem('r8')))
      await harness.until((_, events) => settledRuns(events) === 4)

      expect(nodeProgress(activityOf(harness.state(), 'app'))).toEqual({
        settled: 4,
        failed: 1,
        total: 9
      })

      app.answerAll(() => succeeded(fileItem('rest')))
      await finished
    })

    it('[R7b] one failed run is recorded and the other runs still finish', async () => {
      const generate = deferredExecutor()
      const harness = testHost(
        docWith(
          [threeImages(), generateNode('gen', 'image', { inputs: [imageIn] })],
          [edge('images', 'out', 'gen', 'image')]
        ),
        { app: deferredExecutor(), generate }
      )

      const finished = createEngine(harness.host).runGraph()
      await generate.untilCalls(3)
      generate.calls[1].reject(new Error('socket closed'))
      generate.calls[0].resolve(succeeded(fileItem('r0')))
      generate.calls[2].resolve(succeeded(fileItem('r2')))
      await finished

      expect(findNode(harness.state().doc, 'gen')).toMatchObject({
        result: {
          status: 'partial',
          outputs: { out: [fileItem('r0'), fileItem('r2')] },
          failures: [{ index: 1, code: 'threw', message: 'socket closed' }]
        }
      })
    })

    it('[R7b] a failed run does not stop the runs that had not started yet', async () => {
      const generate = deferredExecutor({
        concurrency: 1,
        answer: failFirstRun
      })
      const harness = testHost(
        docWith(
          [threeImages(), generateNode('gen', 'image', { inputs: [imageIn] })],
          [edge('images', 'out', 'gen', 'image')]
        ),
        { app: deferredExecutor(), generate }
      )

      await createEngine(harness.host).runGraph()

      expect(generate.calls.map(({ request }) => request.run.index)).toEqual([
        0, 1, 2
      ])
      expect(findNode(harness.state().doc, 'gen')).toMatchObject({
        result: {
          status: 'partial',
          outputs: { out: [fileItem('r1'), fileItem('r2')] }
        }
      })
    })

    it('[R7c] shows the queue position an executor reports for a run', async () => {
      const generate = deferredExecutor()
      const harness = testHost(
        docWith(
          [
            ioNode('source', 'image', [fileItem('a')]),
            generateNode('gen', 'image', { inputs: [imageIn] })
          ],
          [edge('source', 'out', 'gen', 'image')]
        ),
        { app: deferredExecutor(), generate }
      )
      const finished = createEngine(harness.host).runGraph()
      await generate.untilCalls(1)

      generate.calls[0].request.onProgress({ queuePosition: 3 })

      expect(activityOf(harness.state(), 'gen')).toMatchObject({
        phase: 'running',
        slots: [{ state: 'running', queuePosition: 3 }]
      })
      generate.answerAll(() => succeeded(fileItem('done')))
      await finished
    })

    it('[R7d] when every run fails, downstream in that graph run is blocked and an unrelated branch still finishes', async () => {
      const app = deferredExecutor({
        answer: () => ({ ok: false, message: 'Insufficient credits' })
      })
      const generate = deferredExecutor({ answer: freshOutputs() })
      const harness = testHost(
        docWith(
          [
            ioNode('source', 'image', [fileItem('a'), fileItem('b')]),
            appNode('failing', { inputs: [imageIn] }),
            generateNode('after', 'image', { inputs: [imageIn] }),
            generateNode('unrelated', 'image', { inputs: [imageIn] })
          ],
          [
            edge('source', 'out', 'failing', 'image'),
            edge('failing', 'out', 'after', 'image'),
            edge('source', 'out', 'unrelated', 'image')
          ]
        ),
        { app, generate }
      )

      const summary = await createEngine(harness.host).runGraph()

      expect(summary).toMatchObject({
        ok: true,
        outcomes: { failing: 'failed', after: 'blocked', unrelated: 'complete' }
      })
      expect(activityOf(harness.state(), 'after')).toMatchObject({
        phase: 'blocked',
        block: { reason: 'upstreamFailed', nodeIds: ['failing'] }
      })
    })

    it('[R7e] a run that returns no output counts as failed', async () => {
      const generate = deferredExecutor({
        answer: () => ({ ok: true, outputs: { out: [] } })
      })
      const harness = testHost(
        docWith(
          [
            ioNode('source', 'image', [fileItem('a')]),
            generateNode('gen', 'image', { inputs: [imageIn] })
          ],
          [edge('source', 'out', 'gen', 'image')]
        ),
        { app: deferredExecutor(), generate }
      )

      await createEngine(harness.host).runGraph()

      expect(findNode(harness.state().doc, 'gen')).toMatchObject({
        result: {
          status: 'failed',
          failures: [{ index: 0, code: 'noOutput' }]
        }
      })
    })

    it("[O7] never runs more than the executor's concurrency at once", async () => {
      const generate = deferredExecutor({ concurrency: 2 })
      const harness = testHost(
        docWith(
          [
            ioNode('source', 'image', [
              fileItem('a'),
              fileItem('b'),
              fileItem('c'),
              fileItem('d'),
              fileItem('e')
            ]),
            generateNode('gen', 'image', { inputs: [imageIn] })
          ],
          [edge('source', 'out', 'gen', 'image')]
        ),
        { app: deferredExecutor(), generate }
      )

      const finished = createEngine(harness.host).runGraph()
      await generate.untilCalls(2)
      expect(generate.calls).toHaveLength(2)

      generate.answerAll(() => succeeded(fileItem('done')))
      await finished

      expect(generate.calls).toHaveLength(5)
      expect(generate.maxInFlight()).toBe(2)
    })
  })

  describe('node runs', () => {
    it('[R5a] a node run uses content already on its inputs and never calls upstream executors', async () => {
      const generate = deferredExecutor({ answer: freshOutputs() })
      const app = deferredExecutor({ answer: freshOutputs() })
      const harness = testHost(
        docWith(
          [
            withLastResult(generateNode('first', 'image'), [
              fileItem('earlier')
            ]),
            appNode('second', { inputs: [imageIn] })
          ],
          [edge('first', 'out', 'second', 'image')]
        ),
        { app, generate }
      )

      await createEngine(harness.host).runNode('second')

      expect(generate.calls).toHaveLength(0)
      expect(app.calls.map(({ request }) => request.run.inputs)).toEqual([
        { image: [fileItem('earlier')] }
      ])
    })

    it('[R5b] a node run with an empty required input calls no executor and marks that input', async () => {
      const generate = deferredExecutor({ answer: freshOutputs() })
      const harness = testHost(
        docWith([
          generateNode('gen', 'image', {
            inputs: [port('prompt', 'text', { required: true, inline: true })]
          })
        ]),
        { app: deferredExecutor(), generate }
      )

      const summary = await createEngine(harness.host).runNode('gen')

      expect(summary).toEqual({ ok: false, reason: 'blocked' })
      expect(generate.calls).toHaveLength(0)
      expect(visibleMissingPorts(harness.state(), 'gen')).toEqual(['prompt'])
    })

    it('[R5e] a node run fills the I/O nodes wired after it and runs nothing else', async () => {
      const generate = deferredExecutor({
        answer: () => succeeded(fileItem('made'))
      })
      const app = deferredExecutor({ answer: freshOutputs() })
      const harness = testHost(
        docWith(
          [
            ioNode('source', 'image', [fileItem('a')]),
            generateNode('gen', 'image', { inputs: [imageIn] }),
            ioNode('firstOut', 'image'),
            ioNode('secondOut', 'image'),
            appNode('later', { inputs: [imageIn] })
          ],
          [
            edge('source', 'out', 'gen', 'image'),
            edge('gen', 'out', 'firstOut', 'in'),
            edge('firstOut', 'out', 'secondOut', 'in'),
            edge('firstOut', 'out', 'later', 'image')
          ]
        ),
        { app, generate }
      )

      await createEngine(harness.host).runNode('gen')

      const { doc } = harness.state()
      expect(findNode(doc, 'firstOut')).toMatchObject({
        items: [fileItem('made')]
      })
      expect(findNode(doc, 'secondOut')).toMatchObject({
        items: [fileItem('made')]
      })
      expect(app.calls).toHaveLength(0)
    })

    it('[R5e] two overlapping node runs that feed one I/O node both land in it', async () => {
      const generate = deferredExecutor()
      const harness = testHost(
        docWith(
          [
            generateNode('first', 'image'),
            generateNode('second', 'image'),
            ioNode('results', 'image')
          ],
          [
            edge('first', 'out', 'results', 'in'),
            edge('second', 'out', 'results', 'in')
          ]
        ),
        { app: deferredExecutor(), generate }
      )
      const engine = createEngine(harness.host)

      const firstRun = engine.runNode('first')
      const secondRun = engine.runNode('second')
      await generate.untilCalls(2)
      generate.calls[1].resolve(succeeded(fileItem('second-new')))
      await secondRun
      generate.calls[0].resolve(succeeded(fileItem('first-new')))
      const firstSummary = await firstRun

      expect(findNode(harness.state().doc, 'results')).toMatchObject({
        items: [fileItem('first-new'), fileItem('second-new')]
      })
      expect(firstSummary).toMatchObject({
        ok: true,
        outcomes: { results: 'collected' }
      })
      expect(activityOf(harness.state(), 'results')).toEqual({ phase: 'idle' })
    })

    it("[R6e] a node's own Run regenerates every run", async () => {
      const generate = deferredExecutor({ answer: freshOutputs() })
      const harness = testHost(
        docWith(
          [
            ioNode('source', 'image', [fileItem('a'), fileItem('b')]),
            generateNode('gen', 'image', { inputs: [imageIn] })
          ],
          [edge('source', 'out', 'gen', 'image')]
        ),
        { app: deferredExecutor(), generate }
      )
      const engine = createEngine(harness.host)
      await engine.runGraph()

      await engine.runNode('gen')

      expect(generate.calls.map(({ request }) => request.run.index)).toEqual([
        0, 1, 0, 1
      ])
    })
  })

  describe('sessions', () => {
    it('[O1] refuses a node run during a graph run', async () => {
      const generate = deferredExecutor()
      const harness = testHost(
        docWith(
          [
            ioNode('source', 'image', [fileItem('a')]),
            generateNode('gen', 'image', { inputs: [imageIn] }),
            appNode('other', { inputs: [imageIn] })
          ],
          [
            edge('source', 'out', 'gen', 'image'),
            edge('source', 'out', 'other', 'image')
          ]
        ),
        { app: deferredExecutor({ answer: freshOutputs() }), generate }
      )
      const engine = createEngine(harness.host)
      const graphRun = engine.runGraph()
      await generate.untilCalls(1)

      await expect(engine.runNode('other')).resolves.toEqual({
        ok: false,
        reason: 'busy'
      })

      generate.answerAll(() => succeeded(fileItem('done')))
      await graphRun
    })

    it('[O2] refuses a graph run while a node run is going', async () => {
      const generate = deferredExecutor()
      const harness = testHost(
        docWith([
          generateNode('gen', 'image', {
            inputs: [port('prompt', 'text', { required: true, inline: true })],
            inline: { prompt: 'a quiet harbour' }
          })
        ]),
        { app: deferredExecutor(), generate }
      )
      const engine = createEngine(harness.host)
      const nodeRun = engine.runNode('gen')
      await generate.untilCalls(1)

      const refused = engine.runGraph()

      expect(sessionsStarted(harness.events)).toBe(1)
      await expect(refused).resolves.toEqual({ ok: false, reason: 'busy' })

      generate.answerAll(() => succeeded(fileItem('done')))
      await nodeRun
    })

    it('[O3] refuses to run a node that is already running', async () => {
      const generate = deferredExecutor()
      const harness = testHost(
        docWith([
          generateNode('gen', 'image', {
            inputs: [port('prompt', 'text', { required: true, inline: true })],
            inline: { prompt: 'a quiet harbour' }
          })
        ]),
        { app: deferredExecutor(), generate }
      )
      const engine = createEngine(harness.host)
      const firstRun = engine.runNode('gen')
      await generate.untilCalls(1)

      const secondRun = engine.runNode('gen')

      expect(sessionsStarted(harness.events)).toBe(1)
      await expect(secondRun).resolves.toEqual({
        ok: false,
        reason: 'alreadyRunning'
      })

      generate.answerAll(() => succeeded(fileItem('done')))
      await firstRun
    })

    it('[O4] starts one session when Run is called twice in the same tick', async () => {
      const harness = testHost(
        docWith(
          [
            ioNode('source', 'image', [fileItem('a')]),
            generateNode('gen', 'image', { inputs: [imageIn] })
          ],
          [edge('source', 'out', 'gen', 'image')]
        ),
        {
          app: deferredExecutor(),
          generate: deferredExecutor({ answer: freshOutputs() })
        }
      )
      const engine = createEngine(harness.host)

      const [, second] = await Promise.all([
        engine.runGraph(),
        engine.runGraph()
      ])

      expect(second).toEqual({ ok: false, reason: 'busy' })
      expect(sessionsStarted(harness.events)).toBe(1)
    })

    it('[O5] Stop returns running nodes to idle at once and never commits the late result', async () => {
      const generate = deferredExecutor()
      const harness = testHost(
        docWith(
          [
            ioNode('source', 'image', [fileItem('a')]),
            generateNode('gen', 'image', { inputs: [imageIn] })
          ],
          [edge('source', 'out', 'gen', 'image')]
        ),
        { app: deferredExecutor(), generate }
      )
      const engine = createEngine(harness.host)
      const finished = engine.runGraph()
      await generate.untilCalls(1)

      engine.stop()

      expect(activityOf(harness.state(), 'gen')).toEqual({ phase: 'idle' })
      generate.calls[0].resolve(succeeded(fileItem('late')))
      await finished
      expect(findNode(harness.state().doc, 'gen')).toMatchObject({
        result: null
      })
    })

    it("[O5] a run started right after Stop is not settled by the stopped run's late result, and commits only its own", async () => {
      const generate = deferredExecutor()
      const harness = testHost(
        docWith(
          [
            ioNode('source', 'image', [fileItem('a')]),
            generateNode('gen', 'image', { inputs: [imageIn] })
          ],
          [edge('source', 'out', 'gen', 'image')]
        ),
        { app: deferredExecutor(), generate }
      )
      const engine = createEngine(harness.host)
      const stopped = engine.runGraph()
      await generate.untilCalls(1)
      engine.stop()
      const restarted = engine.runGraph()
      await generate.untilCalls(2)

      generate.calls[0].resolve(succeeded(fileItem('late')))
      await stopped

      expect(nodeProgress(activityOf(harness.state(), 'gen'))).toEqual({
        settled: 0,
        failed: 0,
        total: 1
      })

      generate.calls[1].resolve(succeeded(fileItem('fresh')))
      await restarted

      expect(findNode(harness.state().doc, 'gen')).toMatchObject({
        result: { status: 'complete', outputs: { out: [fileItem('fresh')] } }
      })
    })

    it('[O6] a graph run after a stopped node run passes on what the node shows, without running it again', async () => {
      const generate = deferredExecutor()
      const harness = testHost(
        docWith(
          [
            ioNode('source', 'image', [fileItem('a'), fileItem('b')]),
            generateNode('gen', 'image', { inputs: [imageIn] }),
            ioNode('results', 'image')
          ],
          [
            edge('source', 'out', 'gen', 'image'),
            edge('gen', 'out', 'results', 'in')
          ]
        ),
        { app: deferredExecutor(), generate }
      )
      const engine = createEngine(harness.host)
      const graphRun = engine.runGraph()
      await generate.untilCalls(2)
      generate.calls[0].resolve(succeeded(fileItem('old-0')))
      generate.calls[1].resolve(succeeded(fileItem('old-1')))
      await graphRun
      const nodeRun = engine.runNode('gen')
      await generate.untilCalls(4)
      generate.calls[2].resolve(succeeded(fileItem('new-0')))
      await harness.until((_, events) => settledRuns(events) === 3)
      engine.stop()
      generate.calls[3].resolve({ ok: false, message: 'Cancelled' })
      await nodeRun

      await engine.runGraph()

      expect(generate.calls).toHaveLength(4)
      expect(findNode(harness.state().doc, 'results')).toMatchObject({
        items: [fileItem('new-0'), fileItem('old-1')]
      })
    })

    it("[O6] a stopped run's late success is reused by the next graph run", async () => {
      const generate = deferredExecutor()
      const harness = testHost(
        docWith(
          [
            ioNode('source', 'image', [fileItem('a'), fileItem('b')]),
            generateNode('gen', 'image', { inputs: [imageIn] })
          ],
          [edge('source', 'out', 'gen', 'image')]
        ),
        { app: deferredExecutor(), generate }
      )
      const engine = createEngine(harness.host)
      const stopped = engine.runGraph()
      await generate.untilCalls(2)
      engine.stop()
      generate.calls[0].resolve(succeeded(fileItem('late')))
      generate.calls[1].resolve({ ok: false, message: 'Cancelled' })
      await stopped

      generate.answerAll(() => succeeded(fileItem('fresh')))
      await engine.runGraph()

      expect(generate.calls.map(({ request }) => request.run.index)).toEqual([
        0, 1, 1
      ])
      expect(findNode(harness.state().doc, 'gen')).toMatchObject({
        result: { outputs: { out: [fileItem('late'), fileItem('fresh')] } }
      })
    })
  })
})
