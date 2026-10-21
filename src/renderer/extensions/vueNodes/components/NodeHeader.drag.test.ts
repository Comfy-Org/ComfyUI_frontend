import { fireEvent, render, screen } from '@testing-library/vue'
import { getActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import LGraphNode from '@/renderer/extensions/vueNodes/components/LGraphNode.vue'
import { toNodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'

const mockApp: {
  rootGraph?: LGraph
  nodeOutputs: Record<string, never>
  nodePreviewImages: Record<string, never>
  canvas: { setDirty: ReturnType<typeof vi.fn> }
  dragOverNode: null
} = vi.hoisted(() => ({
  nodeOutputs: {},
  nodePreviewImages: {},
  canvas: { setDirty: vi.fn() },
  dragOverNode: null
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: mockApp
}))

vi.mock(import('@/composables/useErrorHandling'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

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

function pointerInit(x: number, buttons: number) {
  return {
    button: 0,
    buttons,
    clientX: x,
    clientY: 20,
    pointerId: 1
  }
}

/* oxlint-disable testing-library/prefer-user-event */
async function press(
  header: HTMLElement,
  x: number,
  distance: number,
  move: boolean
) {
  const end = x + distance
  await fireEvent.pointerDown(header, pointerInit(x, 1))
  if (move) await fireEvent.pointerMove(header, pointerInit(end, 1))
  await fireEvent.pointerUp(header, pointerInit(end, 0))
}
/* oxlint-enable testing-library/prefer-user-event */

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

    await press(header, 10, 0, false)
    await press(header, 12, distance(), move)
    // oxlint-disable-next-line testing-library/prefer-user-event
    await fireEvent.dblClick(header)

    const editor = screen.queryByTestId('node-title-input')
    if (showsEditor) expect(editor).toBeInTheDocument()
    else expect(editor).not.toBeInTheDocument()
  })

  it('opens the title editor on a later double-click after a drag', async () => {
    renderNode()
    const header = screen.getByTestId('node-header-1')
    const past = CanvasPointer.maxClickDrift + 1

    await press(header, 10, 0, false)
    await press(header, 12, past, true)
    // oxlint-disable-next-line testing-library/prefer-user-event
    await fireEvent.dblClick(header)
    expect(screen.queryByTestId('node-title-input')).not.toBeInTheDocument()

    await press(header, 10, 0, false)
    await press(header, 12, 0, false)
    // oxlint-disable-next-line testing-library/prefer-user-event
    await fireEvent.dblClick(header)
    expect(screen.getByTestId('node-title-input')).toBeInTheDocument()
  })
})
