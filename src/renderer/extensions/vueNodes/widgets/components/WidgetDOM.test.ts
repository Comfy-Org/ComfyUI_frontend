import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const isDOMWidgetMock = vi.hoisted(() => vi.fn(() => true))
vi.mock('@/scripts/domWidget', () => ({
  isDOMWidget: isDOMWidgetMock
}))

import WidgetDOM from './WidgetDOM.vue'
import { createMockWidget } from './widgetTestUtils'

describe('WidgetDOM', () => {
  beforeEach(() => {
    canvasMocks.canvas.graph.getNodeById.mockReset()
    resolveMock.mockReset()
    isDOMWidgetMock.mockReset()
    isDOMWidgetMock.mockReturnValue(true)
  })

  function mountWithWidget(domElement: HTMLElement | null) {
    if (domElement) {
      canvasMocks.canvas.graph.getNodeById.mockReturnValue({ mock: true })
      resolveMock.mockReturnValue({
        node: { mock: true },
        widget: { element: domElement, name: 'dom' }
      })
    }
    return render(WidgetDOM, {
      props: {
        widget: createMockWidget<void>({
          value: undefined,
          name: 'dom',
          type: 'dom'
        }),
        nodeId: 'n1'
      }
    })
  }

  it('mounts the resolved DOM widget element inside the container', () => {
    const hosted = document.createElement('div')
    hosted.setAttribute('data-testid', 'hosted-dom')
    hosted.textContent = 'hosted content'

    const { container } = mountWithWidget(hosted)

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('[data-testid="hosted-dom"]')).toBe(hosted)
  })

  it('renders an empty container when no host node is found', () => {
    canvasMocks.canvas.graph.getNodeById.mockReturnValue(null)
    resolveMock.mockReturnValue(undefined)

    const { container } = render(WidgetDOM, {
      props: {
        widget: createMockWidget<void>({
          value: undefined,
          name: 'dom',
          type: 'dom'
        }),
        nodeId: 'missing'
      }
    })

    // eslint-disable-next-line testing-library/no-node-access
    const root = container.firstElementChild as HTMLElement
    expect(root).toBeInTheDocument()
    // eslint-disable-next-line testing-library/no-node-access
    expect(root.children).toHaveLength(0)
  })

  it('skips mounting when the resolved widget is not a DOM widget', () => {
    const hosted = document.createElement('div')
    hosted.setAttribute('data-testid', 'hosted-dom')

    canvasMocks.canvas.graph.getNodeById.mockReturnValue({ mock: true })
    resolveMock.mockReturnValue({
      node: { mock: true },
      widget: { element: hosted, name: 'dom' }
    })
    isDOMWidgetMock.mockReturnValue(false)

    const { container } = render(WidgetDOM, {
      props: {
        widget: createMockWidget<void>({
          value: undefined,
          name: 'dom',
          type: 'dom'
        }),
        nodeId: 'n1'
      }
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('[data-testid="hosted-dom"]')).toBeNull()
  })

  it('renders a visible root element for pointer-event capture', () => {
    const { container } = mountWithWidget(document.createElement('span'))
    // eslint-disable-next-line testing-library/no-node-access
    const root = container.firstElementChild as HTMLElement
    expect(root).toBeInTheDocument()
  })
})
