import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import SelectionGapHandles from '@/components/graph/selectionGrid/SelectionGapHandles.vue'
import type { LayoutBox } from '@/components/graph/selectionGrid/selectionGridLayout'
import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import { useTidySession } from '@/components/graph/selectionGrid/useTidySession'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import en from '@/locales/en/main.json'
import { consultEscapeOverride } from '@/platform/keybindings/escapeOverride'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

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
  messages: { en }
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
      capturePositions: (nodes) => {
        const positions = row.map(({ id, x, y }) => ({ id, x, y }))
        return () => placeBoxes(nodes, positions)
      },
      moveBoxes,
      recordUndoStep,
      tidyUp: vi.fn()
    }))
  })

  const renderSession = () => {
    const dismiss = vi.fn()
    const Harness = defineComponent({
      setup() {
        const { handles } = useTidySession()
        return () =>
          h(SelectionGapHandles, { session: handles, onDismiss: dismiss })
      }
    })
    return {
      ...render(Harness, {
        global: { plugins: [i18n] }
      }),
      dismiss
    }
  }

  const renderHandles = async () => {
    const view = renderSession()
    const handle = await screen.findByRole('spinbutton', {
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

  it.for([
    { key: 'ArrowUp', gap: 151, vertical: false },
    { key: 'ArrowDown', gap: 149, vertical: false },
    { key: 'ArrowRight', gap: 151, vertical: false },
    { key: 'ArrowLeft', gap: 149, vertical: false },
    { key: 'ArrowDown', gap: 149, vertical: true }
  ])(
    'announces an unbounded gap after $key, vertical: $vertical',
    async ({ key, gap, vertical }) => {
      let boxes = row.map((box, index) =>
        vertical ? { ...box, x: 0, y: index * 250 } : { ...box, x: index * 350 }
      )
      vi.mocked(useSelectionGrid).mockReturnValue({
        ...useSelectionGrid(),
        measure: () => boxes
      })
      moveBoxes.mockImplementation((_nodes, positions) => {
        boxes = boxes.map((box) => ({
          ...box,
          ...positions.find(({ id }) => id === box.id)
        }))
        return true
      })
      const user = userEvent.setup()
      const { handle } = await renderHandles()
      expect(handle).toHaveAttribute('aria-valuenow', '150')
      expect(handle).toHaveAttribute('aria-valuemin', '0')
      expect(handle).not.toHaveAttribute('aria-valuemax')
      handle.focus()

      await user.keyboard(`{${key}}`)

      await waitFor(() =>
        expect(handle).toHaveAttribute('aria-valuenow', String(gap))
      )
      expect(handle).toHaveAttribute('aria-valuetext', `${gap} canvas units`)
      expect(recordUndoStep).toHaveBeenCalledTimes(1)
    }
  )

  it.for([
    { gap: 1, label: '1 canvas unit' },
    { gap: 2, label: '2 canvas units' }
  ])('announces $label', async ({ gap, label }) => {
    vi.mocked(useSelectionGrid).mockReturnValue({
      ...useSelectionGrid(),
      measure: () =>
        row.map((box, index) => ({ ...box, x: index * (200 + gap) }))
    })
    const { handle } = await renderHandles()

    expect(handle).toHaveAttribute('aria-valuetext', label)
  })

  it('announces the shrink limit imposed by another row', async () => {
    vi.mocked(useSelectionGrid).mockReturnValue({
      ...useSelectionGrid(),
      measure: () => [
        { id: toNodeId('a'), x: 0, y: 0, width: 200, height: 100 },
        { id: toNodeId('b'), x: 350, y: 0, width: 150, height: 100 },
        { id: toNodeId('c'), x: 0, y: 200, width: 300, height: 100 },
        { id: toNodeId('d'), x: 350, y: 200, width: 150, height: 100 }
      ]
    })
    renderSession()

    const handles = await screen.findAllByRole('spinbutton')
    const wideGap = handles.find(
      (handle) => handle.getAttribute('aria-valuenow') === '150'
    )
    expect(wideGap).toHaveAttribute('aria-valuemin', '100')
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
    expect(handle).not.toHaveTextContent('40')
    expect(recordUndoStep).toHaveBeenCalledTimes(1)
  })

  it('commits when a move arrives with no button pressed after a release it never saw', async () => {
    const user = userEvent.setup()
    const { handle } = await renderHandles()

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
      { captureUndo: false }
    )
    await waitFor(() => expect(handle).not.toHaveTextContent('40'))
    expect(recordUndoStep).toHaveBeenCalledTimes(1)
  })

  it('takes focus and shows the gap while dragging', async () => {
    const user = userEvent.setup()
    const { handle } = await renderHandles()

    await user.pointer(press(handle, 215))
    expect(handle).toHaveFocus()
    expect(handle).toHaveTextContent('30')
    await user.pointer({ keys: '[/MouseLeft]', target: document.body })

    expect(handle).not.toHaveTextContent('30')
  })

  it('cancels a drag on any other key and keeps that key from the canvas', async () => {
    const user = userEvent.setup()
    const { handle } = await renderHandles()
    const keyReachingCanvas = vi.fn()
    window.addEventListener('keydown', keyReachingCanvas)
    onTestFinished(() => {
      window.removeEventListener('keydown', keyReachingCanvas)
    })

    await user.pointer([press(handle, 215), moveTo(225)])
    vi.advanceTimersToNextFrame()
    await user.keyboard('{Shift}z')

    expect(placeBoxes).toHaveBeenCalledWith(expect.any(Array), [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 230, y: 0 }
    ])
    expect(keyReachingCanvas).toHaveBeenCalledTimes(1)
    expect(handle).not.toHaveTextContent('40')
  })

  it.for([
    { key: 'undo', keys: '{Control>}z{/Control}' },
    { key: 'redo', keys: '{Control>}{Shift>}z{/Shift}{/Control}' },
    { key: 'AltGr', keys: '{AltGraph}' }
  ])('leaves a drag running when $key is pressed', async ({ keys }) => {
    const user = userEvent.setup()
    const { handle } = await renderHandles()

    await user.pointer([press(handle, 215), moveTo(225)])
    vi.advanceTimersToNextFrame()
    await user.keyboard(keys)

    expect(placeBoxes).not.toHaveBeenCalled()
    expect(handle).toHaveTextContent('40')
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
    const { handle } = await renderHandles()
    handle.focus()

    await user.keyboard('{ArrowRight>2}')
    await user.tab()

    expect(recordUndoStep).toHaveBeenCalledTimes(1)
    expect(handle).not.toHaveFocus()
  })

  it('does not nudge for an arrow released during a drag', async () => {
    const user = userEvent.setup()
    const { handle } = await renderHandles()
    handle.focus()

    await user.pointer([press(handle, 215), moveTo(225)])
    vi.advanceTimersToNextFrame()
    moveBoxes.mockClear()
    await user.keyboard('{ArrowRight}')

    vi.advanceTimersToNextFrame()
    expect(moveBoxes).not.toHaveBeenCalled()
    expect(handle).not.toHaveTextContent('40')
    expect(placeBoxes).toHaveBeenCalledTimes(1)
  })

  it('asks to close the bar when Escape is pressed on a handle', async () => {
    const user = userEvent.setup()
    const { handle, dismiss } = await renderHandles()
    handle.focus()

    await user.keyboard('{Escape}')

    expect(dismiss).toHaveBeenCalledTimes(1)
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
