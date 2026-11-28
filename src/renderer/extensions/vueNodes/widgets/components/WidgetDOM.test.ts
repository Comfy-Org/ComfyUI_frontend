import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { app } from '@/scripts/app'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock(import('@/scripts/app'))

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

import WidgetDOM from './WidgetDOM.vue'
import { registerTestWidget } from './widgetTestUtils'

beforeEach(() => {
  useCanvasStore().currentGraph = app.rootGraph
})

function addRootNode(): LGraphNode {
  const node = new LGraphNode('test')
  app.rootGraph.add(node)
  return node
}

function resolveDomWidgetOn(host: LGraphNode, element: HTMLElement) {
  resolveMock.mockImplementation((node) =>
    node === host ? { node, widget: { element, name: 'dom' } } : undefined
  )
}

describe('WidgetDOM', () => {
  beforeEach(() => {
    isDOMWidgetMock.mockReturnValue(true)
  })

  function mountWithWidget(domElement: HTMLElement) {
    const host = addRootNode()
    resolveDomWidgetOn(host, domElement)
    return render(WidgetDOM, {
      props: {
        widgetId: registerTestWidget({
          value: undefined,
          name: 'dom',
          type: 'dom'
        }),
        nodeId: host.id
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
    resolveDomWidgetOn(addRootNode(), document.createElement('div'))

    const { container } = render(WidgetDOM, {
      props: {
        widgetId: registerTestWidget({
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

    const host = addRootNode()
    resolveDomWidgetOn(host, hosted)
    isDOMWidgetMock.mockReturnValue(false)

    const { container } = render(WidgetDOM, {
      props: {
        widgetId: registerTestWidget({
          value: undefined,
          name: 'dom',
          type: 'dom'
        }),
        nodeId: host.id
      }
    })

    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('[data-testid="hosted-dom"]')).toBeNull()
  })

  it('mounts the DOM widget of a root graph owner while the canvas shows a subgraph', () => {
    const owner = addRootNode()
    useCanvasStore().currentGraph = createTestSubgraph({
      rootGraph: app.rootGraph
    })
    const owned = document.createElement('div')
    owned.setAttribute('data-testid', 'owned-dom')
    resolveDomWidgetOn(owner, owned)

    render(WidgetDOM, {
      props: {
        widgetId: registerTestWidget({
          value: undefined,
          name: 'dom',
          type: 'dom'
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
