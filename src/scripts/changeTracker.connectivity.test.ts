import { assert, beforeEach, expect, onTestFinished, test, vi } from 'vitest'
import { markRaw } from 'vue'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LinkConnector
} from '@/lib/litegraph/src/litegraph'
import { withGraphIntentSource } from '@/lib/litegraph/src/graphIntents'
import type { GraphIntentSource } from '@/lib/litegraph/src/graphIntents'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { ChangeTracker } from '@/scripts/changeTracker'
import {
  createMockCanvasPointerEvent,
  createMockCanvasRenderingContext2D
} from '@/utils/__tests__/canvasTestUtils'
import {
  createTestSubgraphData,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/scripts/api'))

beforeEach(() => {
  ChangeTracker.isLoadingGraph = false
  ChangeTracker.resetCanvasTrackerForTest()
})

async function trackedGraph(
  path = 'workflows/connectivity.json',
  linked = false
) {
  const graph = new LGraph()
  const source = new LGraphNode('Source', 'TestSource')
  const replacement = new LGraphNode('Replacement', 'TestSource')
  const sink = new LGraphNode('Sink', 'TestSink')
  source.addOutput('image', 'IMAGE')
  replacement.addOutput('image', 'IMAGE')
  sink.addInput('first', 'IMAGE')
  sink.addInput('second', 'IMAGE')
  graph.add(source)
  graph.add(replacement)
  graph.add(sink)
  if (linked) {
    source.connect(0, sink, 0)
    source.connect(0, sink, 1)
  }

  const initial = await validateComfyWorkflow(graph.serialize())
  assert(initial)
  const workflow = new ComfyWorkflow({ path, modified: 0, size: -1 })
  const tracker = markRaw(new ChangeTracker(workflow, initial))
  workflow.changeTracker = tracker
  const loaded = await workflow.load()
  const store = useWorkflowStore()
  store.attachWorkflow(loaded)
  store.activeWorkflow = loaded
  vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
  const element = document.createElement('canvas')
  element.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  const canvas = new LGraphCanvas(element, graph, {
    skip_events: true,
    skip_render: true
  })
  canvas.onBeforeChange = () => tracker.beforeChange()
  canvas.onAfterChange = () => tracker.afterChange()
  onTestFinished(() => graph.detachCanvas(canvas))
  tracker.bindGraph(graph)
  return { graph, source, replacement, sink, tracker, workflow: loaded }
}

test.for([
  { source: 'local', history: 1 },
  { source: 'load', history: 0 },
  { source: 'agent-remote', history: 0 }
] satisfies { source: GraphIntentSource; history: number }[])(
  '$source connectivity creates $history local undo entries without a gesture',
  async ({ source: provenance, history }) => {
    const { source, sink, tracker } = await trackedGraph()

    withGraphIntentSource(provenance, () => source.connect(0, sink, 0))

    expect(tracker.undoQueue).toHaveLength(history)
    expect(tracker.changeCount).toBe(0)
  }
)

test('replacement of multiple links by one drop records one final snapshot', async () => {
  const { graph, source, replacement, tracker } = await trackedGraph(
    'workflows/multi.json',
    true
  )
  const connector = new LinkConnector(() => {})
  const output = source.outputs[0]
  assert(output)
  connector.moveOutputLink(graph, source, output)

  connector.connectToNode(replacement, createMockCanvasPointerEvent(0, 0))

  expect(tracker.undoQueue).toHaveLength(1)
  expect(tracker.undoQueue[0]?.links).toEqual([
    [1, 1, 0, 3, 0, 'IMAGE'],
    [2, 1, 0, 3, 1, 'IMAGE']
  ])
  expect(tracker.activeState.links).toEqual([
    [3, 2, 0, 3, 0, 'IMAGE'],
    [4, 2, 0, 3, 1, 'IMAGE']
  ])
  expect(tracker.changeCount).toBe(0)
})

test('rejection does not capture unrelated pending changes', async () => {
  const { source, sink, tracker } = await trackedGraph()
  sink.title = 'Uncaptured title'
  sink.onConnectInput = () => false

  expect(source.connect(0, sink, 0)).toBeNull()

  expect(tracker.undoQueue).toEqual([])
  expect(tracker.activeState.nodes.map((node) => node.title)).not.toContain(
    'Uncaptured title'
  )
})

test('reentrant same-owner connections are one completed edit', async () => {
  const { source, replacement, sink, tracker } = await trackedGraph()
  source.onConnectionsChange = (_type, _slot, connected) => {
    if (connected) replacement.connect(0, sink, 1)
  }

  source.connect(0, sink, 0)

  expect(tracker.undoQueue).toHaveLength(1)
  expect(tracker.activeState.links).toHaveLength(2)
})

test('an inactive owner records its own graph without notifying the active canvas', async () => {
  const first = await trackedGraph('workflows/first.json')
  const second = await trackedGraph('workflows/second.json')
  vi.mocked(api.dispatchCustomEvent).mockClear()

  first.source.connect(0, first.sink, 0)

  expect(first.tracker.undoQueue).toHaveLength(1)
  expect(first.tracker.activeState.links).toHaveLength(1)
  expect(first.workflow.isModified).toBe(true)
  expect(second.tracker.undoQueue).toEqual([])
  expect(second.tracker.activeState.links).toHaveLength(0)
  expect(second.workflow.isModified).toBe(false)
  expect(api.dispatchCustomEvent).not.toHaveBeenCalled()
})

test('reentrant edits of another root retain separate owners', async () => {
  const first = await trackedGraph('workflows/first.json')
  const second = await trackedGraph('workflows/second.json')
  first.source.onConnectionsChange = (_type, _slot, connected) => {
    if (connected) second.source.connect(0, second.sink, 0)
  }

  first.source.connect(0, first.sink, 0)

  expect(first.tracker.undoQueue).toHaveLength(1)
  expect(second.tracker.undoQueue).toHaveLength(1)
  expect(first.tracker.activeState.id).toBe(first.graph.id)
  expect(second.tracker.activeState.id).toBe(second.graph.id)
})

test('graph replacement during a callback invalidates the original completion', async () => {
  const { graph, source, sink, tracker } = await trackedGraph()
  source.onConnectionsChange = (_type, _slot, connected) => {
    if (connected) graph.clear()
  }

  expect(source.connect(0, sink, 0)).toBeNull()

  expect(tracker.undoQueue).toEqual([])
  expect(tracker.activeState.nodes).toHaveLength(3)
})

test('closing the workflow during a callback invalidates its owner', async () => {
  const { source, sink, tracker, workflow } = await trackedGraph()
  source.onConnectionsChange = () => {
    workflow.unload()
  }

  source.connect(0, sink, 0)

  expect(tracker.undoQueue).toEqual([])
})

test('an interrupted edit preserves undo for topology already applied', async () => {
  const { graph, source, sink, tracker } = await trackedGraph()
  const failure = new Error('extension callback failed')
  source.onConnectionsChange = () => {
    throw failure
  }

  expect(() => source.connect(0, sink, 0)).toThrow(failure)

  expect(graph.links.size).toBe(1)
  expect(tracker.undoQueue).toHaveLength(1)
  expect(tracker.activeState.links).toHaveLength(1)
  expect(tracker.changeCount).toBe(0)
})

test('an interrupted subgraph input disconnect preserves the applied topology', async () => {
  const { graph, tracker } = await trackedGraph()
  const subgraph = graph.createSubgraph(createTestSubgraphData())
  const input = subgraph.addInput('image', 'IMAGE')
  const node = new LGraphNode('Interior', 'TestSink')
  node.addInput('image', 'IMAGE')
  subgraph.add(node)
  graph.add(createTestSubgraphNode(subgraph))
  input.connect(node.inputs[0], node)
  const initial = await validateComfyWorkflow(graph.serialize())
  assert(initial)
  tracker.reset(initial)
  tracker.undoQueue.length = 0
  const failure = new Error('subgraph callback failed')
  node.onConnectionsChange = () => {
    throw failure
  }

  expect(() => node.disconnectInput(0)).toThrow(failure)

  expect(subgraph.links.size).toBe(0)
  expect(tracker.undoQueue).toHaveLength(1)
  expect(tracker.activeState.definitions?.subgraphs[0]).toMatchObject({
    links: []
  })
})

test('explicit completion does not squash later unrelated writes', async () => {
  const { source, sink, tracker } = await trackedGraph()
  source.connect(0, sink, 0)
  sink.title = 'Later write'

  await vi.advanceTimersByTimeAsync(60)

  expect(tracker.undoQueue).toHaveLength(1)
  expect(tracker.activeState.nodes.map((node) => node.title)).not.toContain(
    'Later write'
  )
})

test('a pending legacy debounce cannot extend a later completed edit', async () => {
  const { source, sink, tracker } = await trackedGraph()
  sink.title = 'Earlier edit'
  tracker.captureCanvasState()
  source.connect(0, sink, 0)
  sink.title = 'Later write'

  await vi.advanceTimersByTimeAsync(60)

  expect(tracker.undoQueue).toHaveLength(2)
  expect(tracker.activeState.nodes.map((node) => node.title)).not.toContain(
    'Later write'
  )
})

test.for([
  { direction: 'input', remaining: 1 },
  { direction: 'output', remaining: 0 }
] as const)(
  'disconnecting an $direction records the completed topology',
  async ({ direction, remaining }) => {
    const { source, sink, tracker } = await trackedGraph(
      'workflows/disconnect.json',
      true
    )
    const disconnect = {
      input: () => sink.disconnectInput(0),
      output: () => source.disconnectOutput(0)
    }

    disconnect[direction]()

    expect(tracker.undoQueue).toHaveLength(1)
    expect(tracker.undoQueue[0]?.links).toHaveLength(2)
    expect(tracker.activeState.links).toHaveLength(remaining)
  }
)

test('floating connectivity is undoable even without an ordinary link', async () => {
  const { source, tracker } = await trackedGraph()
  source.connectFloatingReroute([137, 81], source.outputs[0])

  expect(tracker.undoQueue).toHaveLength(1)
  expect(tracker.activeState.floatingLinks).toHaveLength(1)

  source.disconnectOutput(0)

  expect(tracker.undoQueue).toHaveLength(2)
  expect(tracker.activeState.floatingLinks).toBeUndefined()
})

test('an outer legacy transaction still groups multiple connectivity edits', async () => {
  const { source, replacement, sink, tracker } = await trackedGraph()
  tracker.beforeChange()

  source.connect(0, sink, 0)
  replacement.connect(0, sink, 1)

  expect(tracker.undoQueue).toEqual([])
  tracker.afterChange()
  expect(tracker.undoQueue).toHaveLength(1)
  expect(tracker.activeState.links).toHaveLength(2)
  expect(tracker.changeCount).toBe(0)
})

test('nested remote connectivity does not add a second local undo step', async () => {
  const { source, replacement, sink, tracker } = await trackedGraph()
  source.onConnectionsChange = (_type, _slot, connected) => {
    if (connected) {
      withGraphIntentSource('agent-remote', () =>
        replacement.connect(0, sink, 1)
      )
    }
  }

  source.connect(0, sink, 0)

  expect(tracker.undoQueue).toHaveLength(1)
  expect(tracker.activeState.links).toHaveLength(2)
  expect(tracker.changeCount).toBe(0)
})

test('rebinding the owner during a callback invalidates its earlier edit', async () => {
  const { graph, source, sink, tracker } = await trackedGraph()
  source.onConnectionsChange = () => tracker.bindGraph(graph)

  source.connect(0, sink, 0)

  expect(tracker.undoQueue).toEqual([])
})
