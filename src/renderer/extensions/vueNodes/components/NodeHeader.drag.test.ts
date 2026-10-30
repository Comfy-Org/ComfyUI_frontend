import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { getActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'

import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyApp } from '@/scripts/app'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import LGraphNode from '@/renderer/extensions/vueNodes/components/LGraphNode.vue'

const mockApp = vi.hoisted(() => {
  let rootGraph: LGraph | undefined
  return {
    get rootGraph() {
      return rootGraph
    },
    set rootGraph(graph: LGraph | undefined) {
      rootGraph = graph
    }
  }
})

vi.mock(import('@/scripts/app'), async () => {
  const { fromPartial } = await import('@total-typescript/shoehorn')
  return {
    app: fromPartial<ComfyApp>({
      get rootGraph() {
        if (!mockApp.rootGraph) throw new Error('root graph is unset')
        return mockApp.rootGraph
      },
      nodeOutputs: {},
      nodePreviewImages: {},
      canvas: { setDirty: vi.fn() },
      dragOverNode: null
    })
  }
})

vi.mock(import('@/composables/useErrorHandling'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

const pointerY = 20

function renderNode() {
  layoutStore.isDraggingVueNodes.value = false
  const graph = new LGraph()
  mockApp.rootGraph = graph
  useCanvasStore().currentGraph = graph
  const nodeData: NodeState = {
    id: toNodeId('1'),
    graphId: graph.id,
    title: 'KSampler',
    type: 'KSampler',
    mode: 0,
    flags: {},
    inputs: [],
    outputs: [],
    properties: {}
  }
  return render(LGraphNode, {
    props: { nodeData },
    global: {
      plugins: [getActivePinia()!, i18n]
    }
  })
}

async function press(
  user: ReturnType<typeof userEvent.setup>,
  header: HTMLElement,
  x: number,
  distance: number,
  move: boolean
) {
  const end = x + distance
  await user.pointer({
    keys: '[MouseLeft>]',
    target: header,
    coords: { x, y: pointerY }
  })
  if (move) {
    await user.pointer({
      target: header,
      coords: { x: end, y: pointerY }
    })
  }
  await user.pointer({
    keys: '[/MouseLeft]',
    target: header,
    coords: { x: end, y: pointerY }
  })
}

async function doubleClickHeader(header: HTMLElement) {
  header.dispatchEvent(
    new MouseEvent('dblclick', { bubbles: true, cancelable: true })
  )
  await nextTick()
}

function cancelPointer(header: HTMLElement, x: number) {
  header.dispatchEvent(
    new PointerEvent('pointercancel', {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      clientX: x,
      clientY: pointerY,
      button: 0,
      buttons: 0
    })
  )
}

describe('NodeHeader title rename', () => {
  it.for([
    {
      name: 'opens the title editor after a stationary double-click',
      distance: () => 0,
      move: false,
      showsEditor: true
    },
    {
      name: 'opens the title editor when the second press stays inside the click drift',
      distance: () => CanvasPointer.maxClickDrift,
      move: true,
      showsEditor: true
    },
    {
      name: 'keeps the title editor closed when the second press moves past the click drift',
      distance: () => CanvasPointer.maxClickDrift + 1,
      move: true,
      showsEditor: false
    },
    {
      name: 'keeps the title editor closed when the second press is released past the click drift',
      distance: () => CanvasPointer.maxClickDrift + 1,
      move: false,
      showsEditor: false
    }
  ])('$name', async ({ distance, move, showsEditor }) => {
    renderNode()
    const header = screen.getByTestId('node-header-1')
    const user = userEvent.setup()

    await press(user, header, 10, 0, false)
    await press(user, header, 12, distance(), move)
    await doubleClickHeader(header)

    expect(screen.queryByTestId('node-title-input') !== null).toBe(showsEditor)
  })

  it('keeps the title editor closed when a drag is followed by a stationary click', async () => {
    renderNode()
    const header = screen.getByTestId('node-header-1')
    const user = userEvent.setup()
    const past = CanvasPointer.maxClickDrift + 1

    await press(user, header, 10, past, true)
    await press(user, header, 12, 0, false)
    await doubleClickHeader(header)

    expect(screen.queryByTestId('node-title-input')).not.toBeInTheDocument()
  })

  it('keeps the title editor closed when a click follows a cancelled drag', async () => {
    renderNode()
    const header = screen.getByTestId('node-header-1')
    const user = userEvent.setup()
    const past = CanvasPointer.maxClickDrift + 1
    const end = 10 + past

    await user.pointer({
      keys: '[MouseLeft>]',
      target: header,
      coords: { x: 10, y: pointerY }
    })
    await user.pointer({
      target: header,
      coords: { x: end, y: pointerY }
    })
    cancelPointer(header, end)
    await press(userEvent.setup(), header, 12, 0, false)
    await doubleClickHeader(header)

    expect(screen.queryByTestId('node-title-input')).not.toBeInTheDocument()
  })

  it('opens the title editor on a later double-click after a drag', async () => {
    renderNode()
    const header = screen.getByTestId('node-header-1')
    const user = userEvent.setup()
    const past = CanvasPointer.maxClickDrift + 1

    await press(user, header, 10, 0, false)
    await press(user, header, 12, past, true)
    await doubleClickHeader(header)
    expect(screen.queryByTestId('node-title-input')).not.toBeInTheDocument()

    await press(user, header, 10, 0, false)
    await press(user, header, 12, 0, false)
    await doubleClickHeader(header)
    expect(screen.getByTestId('node-title-input')).toBeInTheDocument()
  })
})
