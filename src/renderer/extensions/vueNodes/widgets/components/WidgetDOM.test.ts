import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveMock = vi.hoisted(() => vi.fn())
vi.mock(
  import('@/renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget'),
  () => ({
    resolveWidgetFromHostNode: resolveMock
  })
)

const isDOMWidgetMock = vi.hoisted(() => vi.fn(() => true))
vi.mock<unknown>(import('@/scripts/domWidget'), () => ({
  isDOMWidget: isDOMWidgetMock
}))

import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import WidgetDOM from './WidgetDOM.vue'
import { createMockWidget } from './widgetTestUtils'

beforeEach(() => {
  useCanvasStore().canvas = fromPartial({
    canvas: document.createElement('canvas'),
    graph: { getNodeById: vi.fn(() => null) }
  })
})

describe('WidgetDOM', () => {
  beforeEach(() => {
    isDOMWidgetMock.mockReturnValue(true)
  })

  function mountWithWidget(domElement: HTMLElement | null) {
    if (domElement) {
      vi.mocked(
        useCanvasStore().getCanvas().graph!.getNodeById
      ).mockReturnValue(new LGraphNode('test'))
      resolveMock.mockReturnValue({
        node: { mock: true },
        widget: { element: domElement, name: 'dom' }
      })
    }
    return render(WidgetDOM, {
      props: {
        widget: createMockWidget<undefined>({
          value: undefined,
          name: 'dom',
          type: 'dom'
        }),
        nodeId: toNodeId('n1')
      }
    })
  }

  it('mounts the resolved DOM widget element inside the container', () => {
    const hosted = document.createElement('div')
    hosted.setAttribute('data-testid', 'hosted-dom')
    hosted.textContent = 'hosted content'

    const { container } = mountWithWidget(hosted)

    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('[data-testid="hosted-dom"]')).toBe(hosted)
  })

  it('renders an empty container when no host node is found', () => {
    vi.mocked(useCanvasStore().getCanvas().graph!.getNodeById).mockReturnValue(
      null
    )
    resolveMock.mockReturnValue(undefined)

    const { container } = render(WidgetDOM, {
      props: {
        widget: createMockWidget<undefined>({
          value: undefined,
          name: 'dom',
          type: 'dom'
        }),
        nodeId: toNodeId('missing')
      }
    })

    // oxlint-disable-next-line testing-library/no-node-access
    const root = container.firstElementChild as HTMLElement
    expect(root).toBeInTheDocument()
    // oxlint-disable-next-line testing-library/no-node-access
    expect(root.children).toHaveLength(0)
  })

  it('skips mounting when the resolved widget is not a DOM widget', () => {
    const hosted = document.createElement('div')
    hosted.setAttribute('data-testid', 'hosted-dom')

    vi.mocked(useCanvasStore().getCanvas().graph!.getNodeById).mockReturnValue(
      new LGraphNode('test')
    )
    resolveMock.mockReturnValue({
      node: { mock: true },
      widget: { element: hosted, name: 'dom' }
    })
    isDOMWidgetMock.mockReturnValue(false)

    const { container } = render(WidgetDOM, {
      props: {
        widget: createMockWidget<undefined>({
          value: undefined,
          name: 'dom',
          type: 'dom'
        }),
        nodeId: toNodeId('n1')
      }
    })

    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('[data-testid="hosted-dom"]')).toBeNull()
  })

  it('mounts the DOM widget of the located owner, not the canvas node with the same id', () => {
    const owner = new LGraphNode('Owner')
    const root = new LGraph()
    root.add(owner)
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(root)
    const owned = document.createElement('div')
    owned.setAttribute('data-testid', 'owned-dom')
    resolveMock.mockImplementation((node) =>
      node === owner
        ? { node, widget: { element: owned, name: 'dom' } }
        : undefined
    )

    render(WidgetDOM, {
      props: {
        widget: createMockWidget<undefined>({
          value: undefined,
          name: 'dom',
          type: 'dom',
          hostNodeLocatorId: createNodeLocatorId(null, owner.id)
        }),
        nodeId: owner.id
      }
    })

    expect(screen.getByTestId('owned-dom')).toBe(owned)
  })

  it('renders a visible root element for pointer-event capture', () => {
    const { container } = mountWithWidget(document.createElement('span'))
    // oxlint-disable-next-line testing-library/no-node-access
    const root = container.firstElementChild as HTMLElement
    expect(root).toBeVisible()
  })
})
