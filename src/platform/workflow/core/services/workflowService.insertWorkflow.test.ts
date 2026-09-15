import { useWorkflowDraftStoreV2 } from '@/platform/workflow/persistence/stores/workflowDraftStoreV2'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  ISerialisedNode,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { app } from '@/scripts/app'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'
import { createUuidv4 } from '@/utils/uuid'
import type { UUID } from '@/utils/uuid'

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    canvas: { _deserializeItems: vi.fn() }
  }
}))

vi.mock<unknown>(import('@/scripts/defaultGraph'), () => ({
  defaultGraph: {},
  blankGraph: {}
}))

vi.mock<unknown>(import('@/services/dialogService'), () => ({
  useDialogService: () => ({
    prompt: vi.fn(),
    confirm: vi.fn()
  })
}))

vi.mock<unknown>(import('@/services/litegraphService'), () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

vi.mock<unknown>(
  import('@/renderer/core/thumbnail/useWorkflowThumbnail'), // eslint-disable-line import-x/no-restricted-paths

  () => ({
    useWorkflowThumbnail: () => ({
      storeThumbnail: vi.fn(),
      getThumbnail: vi.fn()
    })
  })
)

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => ({
    trackDefaultViewSet: vi.fn(),
    trackWorkflowSaved: vi.fn(),
    trackEnterLinear: vi.fn()
  })
}))

const PROBE_NODE_TYPE = 'test/insert-workflow-probe'

class InsertWorkflowProbeNode extends LGraphNode {
  constructor() {
    super('Insert Workflow Probe')
    this.addWidget('number', 'value', 0, () => {})
  }
}

function serialisedNode(id: number, widgetValue: number): ISerialisedNode {
  return {
    id,
    type: PROBE_NODE_TYPE,
    pos: [0, 0],
    size: [140, 80],
    flags: {},
    order: 0,
    mode: 0,
    inputs: [],
    outputs: [],
    properties: {},
    widgets_values: [widgetValue]
  }
}

function graphJson(id: UUID, widgetValue: number): SerialisableGraph {
  return {
    id,
    revision: 0,
    version: 1,
    state: { lastGroupId: 0, lastNodeId: 2, lastLinkId: 0, lastRerouteId: 0 },
    config: {},
    nodes: [serialisedNode(1, widgetValue), serialisedNode(2, widgetValue)],
    links: [],
    groups: [],
    extra: {}
  }
}

function stubWorkflow(initialState: SerialisableGraph): ComfyWorkflow {
  return {
    load: vi.fn().mockResolvedValue({ initialState })
  } as unknown as ComfyWorkflow
}

beforeEach(() => {
  LiteGraph.registerNodeType(PROBE_NODE_TYPE, InsertWorkflowProbeNode)
  const canvasPrototype: {
    getContext(
      contextId: '2d',
      options?: CanvasRenderingContext2DSettings
    ): CanvasRenderingContext2D | null
  } = HTMLCanvasElement.prototype
  vi.spyOn(canvasPrototype, 'getContext').mockReturnValue(
    createMockCanvasRenderingContext2D()
  )
})

beforeEach(() => {
  vi.mocked(useWorkflowDraftStoreV2().saveDraft).mockImplementation(() => true)
  vi.mocked(useWorkflowDraftStoreV2().getDraft).mockReturnValue(null)
  vi.mocked(useWorkflowDraftStoreV2().removeDraft).mockImplementation(() => {})
  vi.mocked(useWorkflowDraftStoreV2().markDraftUsed).mockImplementation(
    () => {}
  )
  vi.mocked(useDomWidgetStore().clear).mockImplementation(() => {})
  vi.mocked(
    useSubgraphNavigationStore().saveCurrentViewport
  ).mockImplementation(() => {})
})

describe('insertWorkflow scratch graph isolation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('does not revert live widget edits when inserting a workflow with the same graph id', async () => {
    const workflowId = createUuidv4()
    const liveGraph = new LGraph(graphJson(workflowId, 7))
    const liveWidget = liveGraph.getNodeById(toNodeId(1))?.widgets?.[0]
    if (!liveWidget) throw new Error('probe node widget missing')
    liveWidget.value = 42

    await useWorkflowService().insertWorkflow(
      stubWorkflow(graphJson(workflowId, 7))
    )

    expect(liveWidget.value).toBe(42)
  })

  it('does not change widget rows in the live graph bucket', async () => {
    const workflowId = createUuidv4()
    const liveGraph = new LGraph(graphJson(workflowId, 7))
    const nodeToDelete = liveGraph.getNodeById(toNodeId(2))
    if (!nodeToDelete) throw new Error('probe node missing')
    liveGraph.remove(nodeToDelete)
    const widgetStore = useWidgetValueStore()
    const liveWidgetId = widgetId(workflowId, toNodeId(1), 'value')
    const missingWidgetId = widgetId(workflowId, toNodeId(2), 'value')
    const liveWidgetState = widgetStore.getWidget(liveWidgetId)
    widgetStore.deleteWidget(missingWidgetId)
    expect(liveWidgetState).toBeDefined()
    expect(widgetStore.getWidget(missingWidgetId)).toBeUndefined()

    await useWorkflowService().insertWorkflow(
      stubWorkflow(graphJson(workflowId, 7))
    )

    expect(widgetStore.getWidget(liveWidgetId)).toBe(liveWidgetState)
    expect(widgetStore.getWidget(missingWidgetId)).toBeUndefined()
  })

  it('passes source reroute geometry directly to the destination canvas', async () => {
    const workflow = graphJson(createUuidv4(), 7)
    workflow.state.lastLinkId = 1
    workflow.state.lastRerouteId = 1
    workflow.links = [
      {
        id: 1,
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 0,
        type: 'number',
        parentId: 1
      }
    ]
    workflow.reroutes = [{ id: 1, pos: [320, 240], linkIds: [1] }]

    await useWorkflowService().insertWorkflow(stubWorkflow(workflow), {
      position: [100, 200]
    })

    expect(app.canvas._deserializeItems).toHaveBeenCalledWith(
      expect.objectContaining({
        reroutes: [{ id: 1, pos: [320, 240], linkIds: [1] }]
      }),
      { position: [100, 200] }
    )
  })
})

vi.mock(import('@vueuse/router'), async () => {
  const { ref } = await import('vue')
  return { useRouteHash: () => ref('') }
})
