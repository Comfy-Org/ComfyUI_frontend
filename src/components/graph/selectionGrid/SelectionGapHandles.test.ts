import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import SelectionGapHandles from '@/components/graph/selectionGrid/SelectionGapHandles.vue'
import type { LayoutBox } from '@/components/graph/selectionGrid/selectionGridLayout'
import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { consultEscapeOverride } from '@/platform/keybindings/escapeOverride'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { toNodeId } from '@/types/nodeId'

vi.mock(import('@/components/graph/selectionGrid/useSelectionGrid'), {
  spy: true
})
vi.mock(import('@/renderer/core/canvas/useCanvasInteractions'))

const row: LayoutBox[] = [
  { id: toNodeId('a'), x: 0, y: 0, width: 200, height: 100 },
  { id: toNodeId('b'), x: 230, y: 0, width: 150, height: 100 }
]

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { gapHandle: 'Gap between nodes' } } }
})

describe('SelectionGapHandles', () => {
  const moveBoxes = vi.fn<ReturnType<typeof useSelectionGrid>['moveBoxes']>(
    () => true
  )
  const placeBoxes = vi.fn()
  const recordUndoStep = vi.fn()
  const viewport: { scale: number; offset: [number, number] } = {
    scale: 1,
    offset: [0, 0]
  }

  beforeEach(() => {
    viewport.scale = 1
    const canvasElement = document.createElement('canvas')
    canvasElement.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 800)
    document.body.append(canvasElement)
    useCanvasStore().canvas = fromPartial<LGraphCanvas>({
      canvas: canvasElement,
      ds: viewport,
      low_quality: false,
      isDragging: false,
      setDirty: vi.fn()
    })
    vi.mocked(useCanvasInteractions).mockReturnValue(
      fromPartial({ forwardEventToCanvas: vi.fn() })
    )
    vi.mocked(useSelectionGrid).mockImplementation(() => ({
      gridNodes: computed(() =>
        row.map(({ id }) => {
          const node = new LGraphNode(id)
          node.id = id
          return node
        })
      ),
      canTidy: computed(() => true),
      measure: () => row,
      placeBoxes,
      moveBoxes,
      recordUndoStep,
      tidyUp: vi.fn()
    }))
  })

  const renderHandles = async () => {
    const view = render(SelectionGapHandles, {
      global: { plugins: [i18n] }
    })
    const handle = await screen.findByRole('separator', {
      name: 'Gap between nodes'
    })
    return { ...view, handle }
  }

  const press = (target: Element, clientX: number) => ({
    keys: '[MouseLeft>]',
    target,
    coords: { clientX, clientY: 50 }
  })
  const moveTo = (clientX: number, pointerName = 'mouse') => ({
    pointerName,
    target: document.body,
    coords: { clientX, clientY: 50 }
  })

  it('follows only the pointer that started the drag', async () => {
    const user = userEvent.setup()
    const { handle } = await renderHandles()

    await user.pointer([
      press(handle, 215),
      { keys: '[TouchA>]', target: document.body, coords: { clientX: 400 } },
      moveTo(420, 'TouchA'),
      { keys: '[/TouchA]', target: document.body },
      moveTo(225)
    ])

    expect(handle).toHaveTextContent('40')
    await user.pointer({ keys: '[/MouseLeft]', target: document.body })
    expect(moveBoxes).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.any(Array),
      { captureUndo: true }
    )
  })

  it('commits when a move arrives with no button pressed after a release it never saw', async () => {
    const user = userEvent.setup()
    const { handle, emitted } = await renderHandles()

    await user.pointer([press(handle, 215), moveTo(225)])
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 240,
        clientY: 50,
        buttons: 0
      })
    )

    expect(moveBoxes).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.any(Array),
      { captureUndo: true }
    )
    expect(emitted()).toHaveProperty('edited')
  })

  it('takes focus and reports the drag while it runs', async () => {
    const user = userEvent.setup()
    const { handle, emitted } = await renderHandles()

    await user.pointer(press(handle, 215))
    expect(handle).toHaveFocus()
    await user.pointer({ keys: '[/MouseLeft]', target: document.body })

    expect(emitted('update:dragging')).toEqual([[true], [false]])
  })

  it('cancels a drag on any other key and keeps that key from the canvas', async () => {
    const user = userEvent.setup()
    const { handle, emitted } = await renderHandles()
    const keyReachingCanvas = vi.fn()
    window.addEventListener('keydown', keyReachingCanvas)
    onTestFinished(() => {
      window.removeEventListener('keydown', keyReachingCanvas)
    })

    await user.pointer([press(handle, 215), moveTo(225)])
    await new Promise(requestAnimationFrame)
    await user.keyboard('{Shift}z')

    expect(placeBoxes).toHaveBeenCalledWith(expect.any(Array), [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 230, y: 0 }
    ])
    expect(keyReachingCanvas).toHaveBeenCalledTimes(1)
    expect(emitted()).not.toHaveProperty('edited')
    expect(emitted('update:dragging').at(-1)).toEqual([false])
  })

  it('keeps the gap under the pointer when the canvas zooms during a drag', async () => {
    const user = userEvent.setup()
    const { handle } = await renderHandles()

    await user.pointer(press(handle, 215))
    viewport.scale = 2
    await user.pointer(moveTo(450))

    expect(handle).toHaveTextContent('40')
  })

  it('records one undo step for a held arrow key', async () => {
    const user = userEvent.setup()
    const { handle } = await renderHandles()
    handle.focus()

    await user.keyboard('{ArrowRight>3}{/ArrowRight}')

    expect(moveBoxes).toHaveBeenCalledTimes(3)
    expect(moveBoxes).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      { captureUndo: false }
    )
    expect(recordUndoStep).toHaveBeenCalledTimes(1)
  })

  it('records held-arrow nudges when focus leaves the handle before the key is released', async () => {
    const user = userEvent.setup()
    const { handle, emitted } = await renderHandles()
    handle.focus()

    await user.keyboard('{ArrowRight>2}')
    await user.tab()

    expect(recordUndoStep).toHaveBeenCalledTimes(1)
    expect(emitted()).toHaveProperty('edited')
  })

  it('records nothing for an arrow released during a drag', async () => {
    const user = userEvent.setup()
    const { handle, emitted } = await renderHandles()
    handle.focus()

    await user.pointer([press(handle, 215), moveTo(225)])
    await user.keyboard('{ArrowRight}')

    expect(recordUndoStep).not.toHaveBeenCalled()
    expect(emitted()).not.toHaveProperty('edited')
  })

  it('asks to close the bar when Escape is pressed on a handle', async () => {
    const user = userEvent.setup()
    const { handle, emitted } = await renderHandles()
    handle.focus()

    await user.keyboard('{Escape}')

    expect(emitted()).toHaveProperty('dismiss')
  })

  it('keeps Escape on a handle away from the global Escape keybinding', async () => {
    const { handle, unmount } = await renderHandles()
    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true
    })
    handle.dispatchEvent(escape)

    expect(consultEscapeOverride(escape)).toBe(true)
    unmount()
    await waitFor(() => expect(consultEscapeOverride(escape)).toBe(false))
  })
})
