import { assert, beforeEach, expect, onTestFinished, test, vi } from 'vitest'
import { markRaw } from 'vue'
import { createI18n } from 'vue-i18n'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { useArrangeNodes } from '@/composables/graph/useArrangeNodes'
import { useSelectedNodeActions } from '@/composables/graph/useSelectedNodeActions'
import { useSelectionOperations } from '@/composables/graph/useSelectionOperations'
import { withGraphIntentSource } from '@/lib/litegraph/src/graphIntents'
import {
  LGraph,
  LGraphCanvas,
  LGraphEventMode,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvasElement
} from '@/utils/__tests__/canvasTestUtils'
import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/services/dialogService'))

beforeEach(() => {
  ChangeTracker.isLoadingGraph = false
  ChangeTracker.resetCanvasTrackerForTest()
  LiteGraph.registerNodeType('test/selection', class extends LGraphNode {})
  onTestFinished(() => {
    delete LiteGraph.registered_node_types['test/selection']
  })
})

async function selectionGraph(path = 'workflows/selection.json') {
  const graph = new LGraph()
  const first = new LGraphNode('First', 'test/selection')
  const second = new LGraphNode('Second', 'test/selection')
  first.pos = [17, 29]
  second.pos = [401, 313]
  first.size = [180, 240]
  second.size = [200, 280]
  graph.add(first)
  graph.add(second)
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
  const canvas = new LGraphCanvas(
    createTestCanvasElement({ ctx: createMockCanvasRenderingContext2D() }),
    graph,
    { skip_events: true, skip_render: true }
  )
  document.body.append(canvas.canvas)
  vi.spyOn(app, 'canvas', 'get').mockReturnValue(canvas)
  canvas.onBeforeChange = () => tracker.beforeChange()
  canvas.onAfterChange = () => tracker.afterChange()
  const canvasStore = useCanvasStore()
  canvasStore.canvas = markRaw(canvas)
  canvasStore.currentGraph = markRaw(graph)
  canvas.selectItems([first, second])
  tracker.bindGraph(graph)
  onTestFinished(() => {
    graph.detachCanvas(canvas)
    canvas.canvas.remove()
  })
  return { graph, canvas, first, second, tracker }
}

test.for([
  { action: 'toggleNodePin', flags: { pinned: true } },
  { action: 'toggleNodeCollapse', flags: { collapsed: true } }
] as const)(
  '$action records the whole selected batch once',
  async ({ action, flags }) => {
    const { tracker } = await selectionGraph()

    useSelectedNodeActions()[action]()

    expect(tracker.undoQueue).toHaveLength(1)
    expect(tracker.activeState.nodes.map((node) => node.flags)).toEqual([
      flags,
      flags
    ])
    expect(tracker.undoQueue[0]?.nodes.map((node) => node.flags)).toEqual([
      {},
      {}
    ])
  }
)

test('an interrupted resize retains the applied size without capturing another workflow', async () => {
  const firstOwner = await selectionGraph('workflows/first.json')
  const otherOwner = await selectionGraph('workflows/other.json')
  vi.spyOn(app, 'canvas', 'get').mockReturnValue(firstOwner.canvas)
  useCanvasStore().canvas = markRaw(firstOwner.canvas)
  firstOwner.first.onResize = () => {
    throw new Error('Extension failed')
  }
  const original = [...firstOwner.second.size]

  expect(() => useSelectedNodeActions().adjustNodeSize()).toThrow(
    'Extension failed'
  )

  expect(firstOwner.tracker.undoQueue).toHaveLength(1)
  expect(firstOwner.tracker.activeState.nodes[0].size).toEqual([
    ...firstOwner.first.size
  ])
  expect(firstOwner.tracker.activeState.nodes[1].size).toEqual(original)
  expect(otherOwner.tracker.undoQueue).toEqual([])
})

test('blocked collapse does not capture an unrelated pending title', async () => {
  const { first, second, tracker } = await selectionGraph()
  first.pin(true)
  second.pin(true)
  first.title = 'Pending title'

  useSelectedNodeActions().toggleNodeCollapse()

  expect(tracker.undoQueue).toEqual([])
  expect(tracker.activeState.nodes[0].title).toBe('First')
})

test('unchanged-size resize records callback properties but not a repeated no-op', async () => {
  const { first, second, tracker } = await selectionGraph()
  first.size = first.computeSize()
  second.size = second.computeSize()
  const layout = { resized: false }
  first.properties.layout = layout
  tracker.captureCanvasState()
  const before = tracker.undoQueue.length
  first.onResize = () => {
    layout.resized = true
  }

  useSelectedNodeActions().adjustNodeSize()

  expect(tracker.undoQueue).toHaveLength(before + 1)
  expect(tracker.activeState.nodes[0].properties.layout).toEqual({
    resized: true
  })
  expect(tracker.undoQueue.at(-1)?.nodes[0].properties.layout).toEqual({
    resized: false
  })

  first.title = 'Pending title'
  useSelectedNodeActions().adjustNodeSize()
  expect(tracker.undoQueue).toHaveLength(before + 1)
  expect(tracker.activeState.nodes[0].title).toBe('First')
})

test('unchanged-size resize retains properties applied by a throwing callback', async () => {
  const { first, second, tracker } = await selectionGraph()
  first.size = first.computeSize()
  second.size = second.computeSize()
  tracker.captureCanvasState()
  const before = tracker.undoQueue.length
  first.onResize = () => {
    first.properties.resized = true
    throw new Error('Extension failed')
  }

  expect(() => useSelectedNodeActions().adjustNodeSize()).toThrow(
    'Extension failed'
  )

  expect(tracker.undoQueue).toHaveLength(before + 1)
  expect(tracker.activeState.nodes[0].properties.resized).toBe(true)
})

test.for([
  { source: 'local', entries: 1 },
  { source: 'agent-remote', entries: 0 },
  { source: 'load', entries: 0 }
] as const)(
  '$source mode batches create $entries local history entries',
  async ({ source, entries }) => {
    const { first, second, tracker } = await selectionGraph()

    withGraphIntentSource(source, () =>
      useSelectedLiteGraphItems().toggleSelectedNodesMode(LGraphEventMode.NEVER)
    )

    expect([first.mode, second.mode]).toEqual([
      LGraphEventMode.NEVER,
      LGraphEventMode.NEVER
    ])
    expect(tracker.undoQueue).toHaveLength(entries)
  }
)

test.for(['pasteSelection', 'duplicateSelection'] as const)(
  '%s records linkless pasted nodes once',
  async (action) => {
    const { graph, canvas, tracker } = await selectionGraph()
    canvas.copyToClipboard()

    useSelectionOperations()[action]()

    expect(graph.nodes).toHaveLength(4)
    expect(tracker.activeState.nodes).toHaveLength(4)
    expect(tracker.undoQueue).toHaveLength(1)
    expect(tracker.undoQueue[0]?.nodes).toHaveLength(2)
  }
)

test('deleting nodes and groups records the whole batch once', async () => {
  const { graph, canvas, first, second, tracker } = await selectionGraph()
  const group = new LGraphGroup('Selected group')
  graph.add(group)
  tracker.captureCanvasState()
  canvas.selectItems([first, second, group])

  useSelectionOperations().deleteSelection()

  expect(tracker.undoQueue).toHaveLength(2)
  expect(tracker.undoQueue[1]?.groups).toHaveLength(1)
  expect(tracker.activeState.nodes).toEqual([])
  expect(tracker.activeState.groups).toEqual([])
  expect(tracker.changeCount).toBe(0)
})

test('refused deletion does not capture pending changes', async () => {
  const { first, second, tracker } = await selectionGraph()
  first.block_delete = second.block_delete = true
  first.title = 'Pending title'

  useSelectionOperations().deleteSelection()

  expect(tracker.undoQueue).toEqual([])
  expect(tracker.activeState.nodes.map((node) => node.title)).toEqual([
    'First',
    'Second'
  ])
})

test('deletion interrupted by an extension still records the removed node', async () => {
  const { first, tracker } = await selectionGraph()
  first.onRemoved = () => {
    throw new Error('Extension failed')
  }

  expect(() => useSelectionOperations().deleteSelection()).toThrow(
    'Extension failed'
  )

  expect(tracker.undoQueue).toHaveLength(1)
  expect(tracker.activeState.nodes.map((node) => node.title)).toEqual([
    'Second'
  ])
  expect(tracker.changeCount).toBe(0)
})

test('arrangement records positions once and does not capture a repeated no-op', async () => {
  const { first, second, tracker } = await selectionGraph()
  const { arrangeNodes } = useArrangeNodes()

  arrangeNodes('vertical')

  expect([Array.from(first.pos), Array.from(second.pos)]).toEqual([
    [17, 29],
    [17, 311]
  ])
  expect(tracker.undoQueue).toHaveLength(1)
  first.title = 'Pending title'
  arrangeNodes('vertical')
  expect(tracker.undoQueue).toHaveLength(1)
  expect(tracker.activeState.nodes[0].title).toBe('First')
})

test('arrangement can opt out of local history', async () => {
  const { first, second, tracker } = await selectionGraph()

  useArrangeNodes().arrangeNodes('horizontal', { captureUndo: false })

  expect([Array.from(first.pos), Array.from(second.pos)]).toEqual([
    [17, 29],
    [209, 29]
  ])
  expect(tracker.undoQueue).toEqual([])
})

test('one color choice captures selected nodes and groups together', async () => {
  const { graph, canvas, first, tracker } = await selectionGraph()
  const group = new LGraphGroup('Selected group')
  graph.add(group)
  tracker.captureCanvasState()
  canvas.selectItems([first, group])
  const user = userEvent.setup()
  const view = render(ColorPickerButton, {
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: {
            en: {
              g: { color: 'Color' },
              color: { noColor: 'No Color', red: 'Red' }
            }
          }
        })
      ]
    }
  })
  onTestFinished(() => view.unmount())

  await user.click(screen.getByRole('button', { name: 'Color' }))
  await user.click(screen.getByRole('button', { name: 'Red' }))

  expect(tracker.undoQueue).toHaveLength(2)
  expect(tracker.activeState.nodes[0]).toMatchObject({
    color: '#322',
    bgcolor: '#533'
  })
  expect(tracker.activeState.groups?.[0].color).toBe('#A88')
})

test('deleting linked nodes and reroutes is one completed selection edit', async () => {
  const { graph, canvas, first, second, tracker } = await selectionGraph()
  first.addOutput('image', 'IMAGE')
  second.addInput('image', 'IMAGE')
  const link = first.connect(0, second, 0)
  assert(link)
  const reroute = graph.createReroute([210, 90], link)
  assert(reroute)
  tracker.captureCanvasState()
  const before = tracker.undoQueue.length
  canvas.selectItems([first, second, reroute])

  useSelectionOperations().deleteSelection()

  expect(tracker.undoQueue).toHaveLength(before + 1)
  expect(tracker.activeState.nodes).toEqual([])
  expect(tracker.activeState.links).toEqual([])
  expect(graph.reroutes.size).toBe(0)
})
