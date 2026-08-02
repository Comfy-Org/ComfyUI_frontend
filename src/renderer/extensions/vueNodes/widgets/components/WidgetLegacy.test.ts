import { render } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

const canvasMocks = vi.hoisted(() => ({
  canvas: {
    graph: {
      getNodeById: vi.fn(() => null as unknown)
    }
  },
  linearMode: false
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => canvasMocks
}))

const resolveMock = vi.hoisted(() => vi.fn())
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget',
  () => ({
    resolveWidgetFromHostNode: resolveMock
  })
)

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: () => ({ activePaletteId: 'default' })
}))

import WidgetLegacy from './WidgetLegacy.vue'
import { createMockWidget } from './widgetTestUtils'

function createMockNode() {
  return {
    id: 1,
    type: 'TestNode',
    size: [300, 200],
    widgets: []
  }
}

function createMockWidgetInstance(): IBaseWidget {
  return {
    name: 'test_custom',
    type: 'custom',
    value: '',
    options: {},
    y: 0,
    last_y: 0,
    width: undefined,
    draw: vi.fn(),
    computeSize: (w: number) => [w, 28] as [number, number]
  } as Partial<IBaseWidget> as IBaseWidget
}

describe('WidgetLegacy', () => {
  let mockNode: ReturnType<typeof createMockNode>
  let mockWidgetInstance: IBaseWidget

  beforeEach(() => {
    canvasMocks.canvas.graph.getNodeById.mockReset()
    resolveMock.mockReset()

    mockNode = createMockNode()
    mockWidgetInstance = createMockWidgetInstance()

    canvasMocks.canvas.graph.getNodeById.mockReturnValue(mockNode)
    resolveMock.mockReturnValue({
      node: mockNode,
      widget: mockWidgetInstance
    })
  })

  afterEach(() => {
    LiteGraph.vueNodesMode = false
  })

  function mountWidget() {
    return render(WidgetLegacy, {
      props: {
        widget: createMockWidget<void>({
          value: undefined,
          name: 'test_custom',
          type: 'custom'
        }),
        nodeId: '1'
      }
    })
  }

  it('does not set widget.width when vueNodesMode is false', () => {
    LiteGraph.vueNodesMode = false
    mountWidget()

    expect(mockWidgetInstance.width).toBeUndefined()
  })

  it('sets widget.width when vueNodesMode is true', () => {
    LiteGraph.vueNodesMode = true
    mountWidget()

    expect(mockWidgetInstance.width).toBeDefined()
  })
})
