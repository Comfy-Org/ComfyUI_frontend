import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  ISerialisedNode,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { toNodeId } from '@/types/nodeId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'
import { createUuidv4 } from '@/utils/uuid'
import type { UUID } from '@/utils/uuid'

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: { pasteFromClipboard: vi.fn() }
  }
}))

vi.mock('@/scripts/defaultGraph', () => ({
  defaultGraph: {},
  blankGraph: {}
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    prompt: vi.fn(),
    confirm: vi.fn()
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

vi.mock('@/renderer/core/thumbnail/useWorkflowThumbnail', () => ({
  useWorkflowThumbnail: () => ({
    storeThumbnail: vi.fn(),
    getThumbnail: vi.fn()
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackDefaultViewSet: vi.fn(),
    trackWorkflowSaved: vi.fn(),
    trackEnterLinear: vi.fn()
  })
}))

vi.mock('@/platform/workflow/persistence/stores/workflowDraftStoreV2', () => ({
  useWorkflowDraftStoreV2: () => ({
    saveDraft: vi.fn(() => true),
    getDraft: vi.fn(),
    removeDraft: vi.fn(),
    markDraftUsed: vi.fn()
  })
}))

vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({ clear: vi.fn() })
}))

vi.mock('@/stores/subgraphNavigationStore', () => ({
  useSubgraphNavigationStore: () => ({ saveCurrentViewport: vi.fn() })
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({})
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

beforeAll(() => {
  LiteGraph.registerNodeType(PROBE_NODE_TYPE, InsertWorkflowProbeNode)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    createMockCanvasRenderingContext2D() as unknown as ReturnType<
      HTMLCanvasElement['getContext']
    >
  )
})

afterAll(() => {
  LiteGraph.unregisterNodeType(PROBE_NODE_TYPE)
  vi.restoreAllMocks()
})

describe('insertWorkflow scratch graph isolation', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
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

  it('does not add badge rows for inserted nodes that are not in the live graph', async () => {
    const workflowId = createUuidv4()
    const liveGraph = new LGraph(graphJson(workflowId, 7))
    const nodeToDelete = liveGraph.getNodeById(toNodeId(2))
    if (!nodeToDelete) throw new Error('probe node missing')
    liveGraph.remove(nodeToDelete)

    await useWorkflowService().insertWorkflow(
      stubWorkflow(graphJson(workflowId, 7))
    )
  })
})
