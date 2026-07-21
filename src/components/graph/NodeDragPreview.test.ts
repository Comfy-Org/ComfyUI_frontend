import { render } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import NodeDragPreview from '@/components/graph/NodeDragPreview.vue'
import { useNodeDragToCanvas } from '@/composables/node/useNodeDragToCanvas'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { fromPartial } from '@total-typescript/shoehorn'

vi.mock(
  '@/renderer/extensions/vueNodes/components/LGraphNodePreview.vue',
  () => ({
    default: { template: '<div data-testid="node-preview" />' }
  })
)

const nodeDef = fromPartial<ComfyNodeDefImpl>({ name: 'TestNode' })

function moveMouse(clientX: number, clientY: number) {
  window.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY }))
}

function ghostElement() {
  return document.querySelector('[data-testid="node-preview"]')?.parentElement
    ?.parentElement
}

describe('NodeDragPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    useNodeDragToCanvas().cancelDrag()
    vi.useRealTimers()
  })

  it('shows no ghost when nothing is being dragged', async () => {
    render(NodeDragPreview)

    moveMouse(100, 200)
    vi.advanceTimersByTime(16)
    await nextTick()

    expect(ghostElement()).toBeFalsy()
  })

  it('keeps the ghost hidden until the mouse position is known', async () => {
    render(NodeDragPreview)

    useNodeDragToCanvas().startDrag(nodeDef)
    await nextTick()
    vi.advanceTimersByTime(16)
    await nextTick()

    expect(ghostElement()).toBeFalsy()
  })

  it('follows the mouse with an offset while dragging', async () => {
    render(NodeDragPreview)

    useNodeDragToCanvas().startDrag(nodeDef)
    await nextTick()
    moveMouse(100, 200)
    vi.advanceTimersByTime(16)
    await nextTick()

    expect(ghostElement()?.style.transform).toBe('translate(112px, 212px)')

    vi.advanceTimersByTime(16)
    await nextTick()

    expect(ghostElement()?.style.transform).toBe('translate(112px, 212px)')

    moveMouse(300, 400)
    vi.advanceTimersByTime(16)
    await nextTick()

    expect(ghostElement()?.style.transform).toBe('translate(312px, 412px)')
  })

  it('removes the ghost when the drag is cancelled', async () => {
    render(NodeDragPreview)

    useNodeDragToCanvas().startDrag(nodeDef)
    await nextTick()
    moveMouse(100, 200)
    vi.advanceTimersByTime(16)
    await nextTick()
    expect(ghostElement()).toBeTruthy()

    useNodeDragToCanvas().cancelDrag()
    await nextTick()

    expect(ghostElement()).toBeFalsy()
  })
})
