import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasDrop } from '@/composables/useCanvasDrop'
import { createMockCanvas } from '@/utils/__tests__/litegraphTestUtils'

type DropInput = {
  clientX: number
  clientY: number
}

type DropEvent = {
  location: { current: { input: DropInput } }
  source: { data: { type: string; data?: unknown } }
}

type DroppableOptions = {
  getDropEffect: (
    args: DropEvent
  ) => Exclude<DataTransfer['dropEffect'], 'none'>
  onDrop: (event: DropEvent) => Promise<void>
}

const {
  MockComfyModelDef,
  MockComfyNodeDefImpl,
  MockComfyWorkflow,
  captured,
  graph,
  insertWorkflow,
  addNodeOnGraph,
  getNodeProvider,
  getAllNodeProviders,
  withNodeAddSource
} = vi.hoisted(() => {
  class MockComfyNodeDefImpl {
    name: string

    constructor(name = 'NodeDef') {
      this.name = name
    }
  }

  class MockComfyModelDef {
    directory: string
    file_name: string

    constructor(directory = 'checkpoints', fileName = 'model.safetensors') {
      this.directory = directory
      this.file_name = fileName
    }
  }

  class MockComfyWorkflow {
    id: string

    constructor(id = 'workflow') {
      this.id = id
    }
  }

  return {
    MockComfyModelDef,
    MockComfyNodeDefImpl,
    MockComfyWorkflow,
    captured: {
      options: undefined as DroppableOptions | undefined
    },
    graph: {
      getNodeOnPos: vi.fn()
    },
    insertWorkflow: vi.fn(),
    addNodeOnGraph: vi.fn(),
    getNodeProvider: vi.fn(),
    getAllNodeProviders: vi.fn(),
    withNodeAddSource: vi.fn((_source: string, callback: () => unknown) =>
      callback()
    )
  }
})

// useCanvasStore is the seam; useSharedCanvasPositionConversion itself runs
// for real so the drop position math (see useCanvasPositionConversion.test.ts
// for its own coverage) is genuinely exercised here, not reimplemented.
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () =>
      createMockCanvas({
        canvas: document.createElement('canvas'),
        ds: { offset: [0, 0], scale: 1 }
      })
  })
}))

vi.mock('@/composables/usePragmaticDragAndDrop', () => ({
  usePragmaticDroppable: vi.fn(
    (_target: () => HTMLCanvasElement | null, options: DroppableOptions) => {
      captured.options = options
    }
  )
}))

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LiteGraph: { NODE_TITLE_HEIGHT: 24 }
}))

vi.mock('@/platform/telemetry/nodeAdded/nodeAddSource', () => ({
  withNodeAddSource
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({ insertWorkflow })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  ComfyWorkflow: MockComfyWorkflow
}))

vi.mock('@/scripts/app', () => ({
  app: { canvas: { graph } }
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ addNodeOnGraph })
}))

vi.mock('@/stores/modelStore', () => ({
  ComfyModelDef: MockComfyModelDef
}))

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => ({
    getNodeProvider,
    getAllNodeProviders
  })
}))

vi.mock('@/stores/nodeDefStore', () => ({
  ComfyNodeDefImpl: MockComfyNodeDefImpl
}))

function dropEvent(
  data: unknown,
  input: DropInput = { clientX: 20, clientY: 40 }
) {
  return {
    location: { current: { input } },
    source: { data: { type: 'tree-explorer-node', data: { data } } }
  }
}

function options() {
  useCanvasDrop(ref(document.createElement('canvas')))
  const value = captured.options
  if (!value) throw new Error('droppable options were not registered')
  return value
}

beforeEach(() => {
  captured.options = undefined
  graph.getNodeOnPos.mockReset()
  insertWorkflow.mockReset()
  addNodeOnGraph.mockReset()
  getNodeProvider.mockReset()
  getAllNodeProviders.mockReset()
  withNodeAddSource.mockClear()
})

describe('useCanvasDrop', () => {
  it('uses copy effect only for tree explorer nodes', () => {
    const droppable = options()

    expect(
      droppable.getDropEffect({
        ...dropEvent(undefined),
        source: { data: { type: 'tree-explorer-node' } }
      })
    ).toBe('copy')
    expect(
      droppable.getDropEffect({
        ...dropEvent(undefined),
        source: { data: { type: 'other' } }
      })
    ).toBe('move')
  })

  it('adds dropped node definitions below the cursor', async () => {
    const nodeDef = new MockComfyNodeDefImpl('KSampler')
    const droppable = options()

    await droppable.onDrop(dropEvent(nodeDef))

    expect(withNodeAddSource).toHaveBeenCalledWith(
      'sidebar_drag',
      expect.any(Function)
    )
    expect(addNodeOnGraph).toHaveBeenCalledWith(nodeDef, {
      pos: [20, 64]
    })
  })

  it('ignores drops that do not come from tree explorer nodes', async () => {
    const nodeDef = new MockComfyNodeDefImpl('KSampler')
    const droppable = options()

    await droppable.onDrop({
      ...dropEvent(nodeDef),
      source: { data: { type: 'other', data: { data: nodeDef } } }
    })

    expect(addNodeOnGraph).not.toHaveBeenCalled()
    expect(insertWorkflow).not.toHaveBeenCalled()
  })

  it('sets a model widget on an existing compatible node', async () => {
    const widget = { name: 'ckpt_name', value: '' }
    const node = { comfyClass: 'CheckpointLoaderSimple', widgets: [widget] }
    const provider = {
      key: 'ckpt_name',
      nodeDef: { name: 'CheckpointLoaderSimple' }
    }
    graph.getNodeOnPos.mockReturnValue(node)
    getAllNodeProviders.mockReturnValue([provider])
    const droppable = options()

    await droppable.onDrop(
      dropEvent(new MockComfyModelDef('checkpoints', 'dream.safetensors'))
    )

    expect(widget.value).toBe('dream.safetensors')
    expect(addNodeOnGraph).not.toHaveBeenCalled()
  })

  it('creates a provider node when the model has no compatible target', async () => {
    const widget = { name: 'lora_name', value: '' }
    const createdNode = { widgets: [widget] }
    const provider = { key: 'lora_name', nodeDef: { name: 'LoraLoader' } }
    graph.getNodeOnPos.mockReturnValue(undefined)
    getNodeProvider.mockReturnValue(provider)
    addNodeOnGraph.mockReturnValue(createdNode)
    const droppable = options()

    await droppable.onDrop(
      dropEvent(new MockComfyModelDef('loras', 'style.safetensors'))
    )

    expect(addNodeOnGraph).toHaveBeenCalledWith(provider.nodeDef, {
      pos: [20, 40]
    })
    expect(widget.value).toBe('style.safetensors')
  })

  it('does nothing for model drops without a compatible or default provider', async () => {
    graph.getNodeOnPos.mockReturnValue({ comfyClass: 'OtherNode' })
    getAllNodeProviders.mockReturnValue([
      { key: 'ckpt_name', nodeDef: { name: 'CheckpointLoaderSimple' } }
    ])
    getNodeProvider.mockReturnValue(null)
    const droppable = options()

    await droppable.onDrop(
      dropEvent(new MockComfyModelDef('checkpoints', 'dream.safetensors'))
    )

    expect(addNodeOnGraph).not.toHaveBeenCalled()
  })

  it('does not set a model value when the target node lacks the provider widget', async () => {
    const provider = { key: 'lora_name', nodeDef: { name: 'LoraLoader' } }
    const createdNode = { widgets: [{ name: 'other', value: '' }] }
    graph.getNodeOnPos.mockReturnValue(undefined)
    getNodeProvider.mockReturnValue(provider)
    addNodeOnGraph.mockReturnValue(createdNode)
    const droppable = options()

    await droppable.onDrop(
      dropEvent(new MockComfyModelDef('loras', 'style.safetensors'))
    )

    expect(createdNode.widgets[0].value).toBe('')
  })

  it('inserts dropped workflows at the canvas position', async () => {
    const workflow = new MockComfyWorkflow('wf-1')
    const droppable = options()

    await droppable.onDrop(dropEvent(workflow))

    expect(insertWorkflow).toHaveBeenCalledWith(workflow, {
      position: [20, 40]
    })
  })
})
