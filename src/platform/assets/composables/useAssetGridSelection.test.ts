import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import { useAssetGridSelection } from './useAssetGridSelection'

const assets: AssetItem[] = [
  { id: 'a', name: 'a.png', tags: [] },
  { id: 'b', name: 'b.png', tags: [] },
  { id: 'c', name: 'c.png', tags: [] }
]

const cardBoxes: Record<string, { left: number; right: number }> = {
  a: { left: 0, right: 50 },
  b: { left: 60, right: 110 },
  c: { left: 120, right: 170 }
}

function pointer(type: string, init: PointerEventInit = {}) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    pointerId: 1,
    isPrimary: true,
    ...init
  })
}

function createCallbacks(overrides: Record<string, unknown> = {}) {
  return {
    getAssets: () => assets,
    getSelectedIds: vi.fn(() => [] as string[]),
    setSelectedIds: vi.fn(),
    selectAll: vi.fn(),
    ...overrides
  }
}

async function renderHarness(callbacks: ReturnType<typeof createCallbacks>) {
  const Harness = defineComponent({
    setup() {
      const gridContainerRef = ref<HTMLElement>()
      const hoverTargetRef = ref<HTMLElement>()
      const { marqueeStyle } = useAssetGridSelection({
        marqueeContainerRef: gridContainerRef,
        hoverTargetRef,
        getAssets: callbacks.getAssets,
        getSelectedIds: callbacks.getSelectedIds,
        setSelectedIds: callbacks.setSelectedIds,
        selectAll: callbacks.selectAll
      })
      return { gridContainerRef, hoverTargetRef, marqueeStyle }
    },
    template: `
      <div ref="hoverTargetRef" data-testid="panel">
        <input data-testid="search" />
        <textarea data-testid="textarea"></textarea>
        <div contenteditable="true" data-testid="editable"></div>
        <div ref="gridContainerRef" data-testid="grid">
          <button data-testid="grid-button">x</button>
          <div data-asset-id="a" data-testid="card-a"></div>
          <div data-asset-id="b" data-testid="card-b"></div>
          <div data-asset-id="c" data-testid="card-c"></div>
        </div>
        <div
          v-if="marqueeStyle"
          data-testid="marquee"
          :style="marqueeStyle"
        ></div>
      </div>
    `
  })

  render(Harness)
  await nextTick()
  vi.spyOn(screen.getByTestId('grid'), 'getBoundingClientRect').mockReturnValue(
    fromPartial<DOMRect>({ left: 0, top: 0, right: 1000, bottom: 1000 })
  )
  for (const id of Object.keys(cardBoxes)) {
    vi.spyOn(
      screen.getByTestId(`card-${id}`),
      'getBoundingClientRect'
    ).mockReturnValue(
      fromPartial<DOMRect>({
        left: cardBoxes[id].left,
        right: cardBoxes[id].right,
        top: 0,
        bottom: 50
      })
    )
  }
}

const grid = () => screen.getByTestId('grid')
const panel = () => screen.getByTestId('panel')
const card = (id: string) => screen.getByTestId(`card-${id}`)

describe('useAssetGridSelection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('marquee', () => {
    it('selects intersecting cards when dragging from empty space', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      grid().dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      window.dispatchEvent(
        pointer('pointermove', { clientX: 110, clientY: 50 })
      )

      expect(callbacks.setSelectedIds).toHaveBeenLastCalledWith(
        ['a', 'b'],
        assets
      )
    })

    it('unions with the current selection when a modifier is held', async () => {
      const callbacks = createCallbacks({ getSelectedIds: vi.fn(() => ['c']) })
      await renderHarness(callbacks)

      grid().dispatchEvent(
        pointer('pointerdown', { clientX: 0, clientY: 0, shiftKey: true })
      )
      window.dispatchEvent(pointer('pointermove', { clientX: 55, clientY: 50 }))

      expect(
        [...callbacks.setSelectedIds.mock.lastCall![0]].sort(
          (a: string, b: string) => a.localeCompare(b)
        )
      ).toEqual(['a', 'c'])
    })

    it('removes covered cards from the selection when Ctrl+Shift is held (subtractive)', async () => {
      const callbacks = createCallbacks({
        getSelectedIds: vi.fn(() => ['a', 'b'])
      })
      await renderHarness(callbacks)

      grid().dispatchEvent(
        pointer('pointerdown', {
          clientX: 0,
          clientY: 0,
          ctrlKey: true,
          shiftKey: true
        })
      )
      window.dispatchEvent(pointer('pointermove', { clientX: 55, clientY: 50 }))

      expect(callbacks.setSelectedIds.mock.lastCall![0]).toEqual(['b'])
    })

    it('removes covered cards when Cmd+Shift is held (macOS subtractive)', async () => {
      const callbacks = createCallbacks({
        getSelectedIds: vi.fn(() => ['a', 'b'])
      })
      await renderHarness(callbacks)

      grid().dispatchEvent(
        pointer('pointerdown', {
          clientX: 0,
          clientY: 0,
          metaKey: true,
          shiftKey: true
        })
      )
      window.dispatchEvent(pointer('pointermove', { clientX: 55, clientY: 50 }))

      expect(callbacks.setSelectedIds.mock.lastCall![0]).toEqual(['b'])
    })

    it('restores cards when the subtractive marquee shrinks back off them', async () => {
      const callbacks = createCallbacks({
        getSelectedIds: vi.fn(() => ['a', 'b'])
      })
      await renderHarness(callbacks)

      grid().dispatchEvent(
        pointer('pointerdown', {
          clientX: 55,
          clientY: 55,
          ctrlKey: true,
          shiftKey: true
        })
      )
      window.dispatchEvent(pointer('pointermove', { clientX: 5, clientY: 45 }))
      expect(callbacks.setSelectedIds.mock.lastCall![0]).toEqual(['b'])

      window.dispatchEvent(pointer('pointermove', { clientX: 54, clientY: 54 }))
      expect(callbacks.setSelectedIds.mock.lastCall![0]).toEqual(['a', 'b'])
    })

    it('ignores movement below the drag threshold', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      grid().dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      window.dispatchEvent(pointer('pointermove', { clientX: 2, clientY: 2 }))

      expect(callbacks.setSelectedIds).not.toHaveBeenCalled()
    })

    it('does not start a marquee on a plain pointer-down on a card', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      card('a').dispatchEvent(
        pointer('pointerdown', { clientX: 5, clientY: 5 })
      )
      window.dispatchEvent(pointer('pointermove', { clientX: 80, clientY: 40 }))

      expect(callbacks.setSelectedIds).not.toHaveBeenCalled()
    })

    it('starts a marquee on a card when Ctrl is held and blocks native drag', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      card('a').dispatchEvent(
        pointer('pointerdown', { clientX: 5, clientY: 5, ctrlKey: true })
      )
      const dragEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true
      })
      card('a').dispatchEvent(dragEvent)
      window.dispatchEvent(pointer('pointermove', { clientX: 65, clientY: 40 }))

      expect(dragEvent.defaultPrevented).toBe(true)
      expect(callbacks.setSelectedIds).toHaveBeenCalled()
    })

    it('does not block native drag when no marquee is tracking', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      const dragEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true
      })
      card('a').dispatchEvent(dragEvent)

      expect(dragEvent.defaultPrevented).toBe(false)
    })

    it('shows a marquee overlay while dragging and removes it on release', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      grid().dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      window.dispatchEvent(pointer('pointermove', { clientX: 30, clientY: 40 }))
      await nextTick()

      const overlay = screen.getByTestId('marquee')
      expect(overlay.style.width).toBe('30px')
      expect(overlay.style.height).toBe('40px')

      window.dispatchEvent(pointer('pointerup', { clientX: 30, clientY: 40 }))
      await nextTick()
      expect(screen.queryByTestId('marquee')).toBeNull()
    })

    it('clips the overlay to the grid container when dragging past its edge', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      grid().dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10 }))
      window.dispatchEvent(
        pointer('pointermove', { clientX: 2000, clientY: 2000 })
      )
      await nextTick()

      const overlay = screen.getByTestId('marquee')
      expect(overlay.style.left).toBe('10px')
      expect(overlay.style.top).toBe('10px')
      expect(overlay.style.width).toBe('990px')
      expect(overlay.style.height).toBe('990px')
    })

    it('clears the overlay on dragend when a native drag swallows pointerup', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      grid().dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      window.dispatchEvent(pointer('pointermove', { clientX: 30, clientY: 40 }))
      await nextTick()
      expect(screen.getByTestId('marquee')).toBeTruthy()

      window.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
      await nextTick()
      expect(screen.queryByTestId('marquee')).toBeNull()
    })

    it('suppresses the click that trails a drag, but not a plain click', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      grid().dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      window.dispatchEvent(pointer('pointermove', { clientX: 80, clientY: 40 }))
      window.dispatchEvent(pointer('pointerup', { clientX: 80, clientY: 40 }))

      const trailing = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      })
      window.dispatchEvent(trailing)
      expect(trailing.defaultPrevented).toBe(true)

      const next = new MouseEvent('click', { bubbles: true, cancelable: true })
      window.dispatchEvent(next)
      expect(next.defaultPrevented).toBe(false)
    })

    it('does not start a marquee for a non-primary mouse button', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      grid().dispatchEvent(
        pointer('pointerdown', { clientX: 0, clientY: 0, button: 2 })
      )
      window.dispatchEvent(
        pointer('pointermove', { clientX: 110, clientY: 50 })
      )

      expect(callbacks.setSelectedIds).not.toHaveBeenCalled()
    })

    it('does not start a marquee when the press lands on an interactive control', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      screen
        .getByTestId('grid-button')
        .dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      window.dispatchEvent(
        pointer('pointermove', { clientX: 110, clientY: 50 })
      )

      expect(callbacks.setSelectedIds).not.toHaveBeenCalled()
    })

    it('starts a marquee on a card when Cmd/Meta is held', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      card('a').dispatchEvent(
        pointer('pointerdown', { clientX: 5, clientY: 5, metaKey: true })
      )
      window.dispatchEvent(pointer('pointermove', { clientX: 65, clientY: 40 }))

      expect(callbacks.setSelectedIds).toHaveBeenCalled()
    })

    it('clears the selection when a no-modifier marquee covers no card', async () => {
      const callbacks = createCallbacks({ getSelectedIds: vi.fn(() => ['a']) })
      await renderHarness(callbacks)

      grid().dispatchEvent(
        pointer('pointerdown', { clientX: 300, clientY: 300 })
      )
      window.dispatchEvent(
        pointer('pointermove', { clientX: 400, clientY: 400 })
      )

      expect(callbacks.setSelectedIds).toHaveBeenLastCalledWith([], assets)
    })

    it('prevents text selection during a marquee and releases it on pointercancel', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      grid().dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      window.dispatchEvent(pointer('pointermove', { clientX: 30, clientY: 40 }))
      await nextTick()
      expect(screen.getByTestId('marquee')).toBeTruthy()

      const duringDrag = new Event('selectstart', {
        bubbles: true,
        cancelable: true
      })
      grid().dispatchEvent(duringDrag)
      expect(duringDrag.defaultPrevented).toBe(true)

      window.dispatchEvent(
        pointer('pointercancel', { clientX: 30, clientY: 40 })
      )
      await nextTick()
      expect(screen.queryByTestId('marquee')).toBeNull()

      const afterEnd = new Event('selectstart', {
        bubbles: true,
        cancelable: true
      })
      grid().dispatchEvent(afterEnd)
      expect(afterEnd.defaultPrevented).toBe(false)
    })

    it('auto-resets click suppression when a drag ends without a trailing click', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      grid().dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      window.dispatchEvent(pointer('pointermove', { clientX: 80, clientY: 40 }))
      window.dispatchEvent(
        pointer('pointercancel', { clientX: 80, clientY: 40 })
      )

      await new Promise((resolve) => setTimeout(resolve))

      const laterClick = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      })
      window.dispatchEvent(laterClick)
      expect(laterClick.defaultPrevented).toBe(false)
    })

    it('only blocks text selection inside the grid container during a marquee', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      grid().dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      window.dispatchEvent(pointer('pointermove', { clientX: 30, clientY: 40 }))
      await nextTick()

      const insideGrid = new Event('selectstart', {
        bubbles: true,
        cancelable: true
      })
      card('a').dispatchEvent(insideGrid)
      expect(insideGrid.defaultPrevented).toBe(true)

      const outsideGrid = new Event('selectstart', {
        bubbles: true,
        cancelable: true
      })
      screen.getByTestId('search').dispatchEvent(outsideGrid)
      expect(outsideGrid.defaultPrevented).toBe(false)
    })

    it('stops blocking text selection after a normal marquee release', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      grid().dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      window.dispatchEvent(pointer('pointermove', { clientX: 30, clientY: 40 }))

      const duringDrag = new Event('selectstart', {
        bubbles: true,
        cancelable: true
      })
      card('a').dispatchEvent(duringDrag)
      expect(duringDrag.defaultPrevented).toBe(true)

      window.dispatchEvent(pointer('pointerup', { clientX: 30, clientY: 40 }))

      const afterRelease = new Event('selectstart', {
        bubbles: true,
        cancelable: true
      })
      card('a').dispatchEvent(afterRelease)
      expect(afterRelease.defaultPrevented).toBe(false)
    })

    it('does not suppress the click after a sub-threshold press', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      grid().dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      window.dispatchEvent(pointer('pointermove', { clientX: 2, clientY: 2 }))
      window.dispatchEvent(pointer('pointerup', { clientX: 2, clientY: 2 }))

      const click = new MouseEvent('click', { bubbles: true, cancelable: true })
      window.dispatchEvent(click)
      expect(click.defaultPrevented).toBe(false)
    })

    it('does not marquee or clear selection when the container has no cards', async () => {
      const setSelectedIds = vi.fn()
      const Harness = defineComponent({
        setup() {
          const containerRef = ref<HTMLElement>()
          useAssetGridSelection({
            marqueeContainerRef: containerRef,
            hoverTargetRef: containerRef,
            getAssets: () => assets,
            getSelectedIds: () => ['a'],
            setSelectedIds,
            selectAll: vi.fn()
          })
          return { containerRef }
        },
        template: `
          <div ref="containerRef" data-testid="list">
            <div data-testid="row">a.png</div>
          </div>
        `
      })
      render(Harness)
      await nextTick()

      screen
        .getByTestId('list')
        .dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      window.dispatchEvent(
        pointer('pointermove', { clientX: 110, clientY: 50 })
      )

      expect(setSelectedIds).not.toHaveBeenCalled()
    })

    it('does not start a marquee when disabled (e.g. list view)', async () => {
      const setSelectedIds = vi.fn()
      const Harness = defineComponent({
        setup() {
          const containerRef = ref<HTMLElement>()
          useAssetGridSelection({
            marqueeContainerRef: containerRef,
            hoverTargetRef: containerRef,
            getAssets: () => assets,
            getSelectedIds: () => [],
            setSelectedIds,
            selectAll: vi.fn(),
            isEnabled: () => false
          })
          return { containerRef }
        },
        template: `
          <div ref="containerRef" data-testid="disabled-grid">
            <div data-asset-id="a"></div>
            <div data-asset-id="b"></div>
          </div>
        `
      })
      render(Harness)
      await nextTick()

      screen
        .getByTestId('disabled-grid')
        .dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      window.dispatchEvent(
        pointer('pointermove', { clientX: 110, clientY: 50 })
      )

      expect(setSelectedIds).not.toHaveBeenCalled()
    })

    it('ignores a reentrant pointer-down and does not leave text selection blocked', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      grid().dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      grid().dispatchEvent(pointer('pointerdown', { clientX: 5, clientY: 5 }))
      window.dispatchEvent(pointer('pointerup', { clientX: 5, clientY: 5 }))

      const selection = new Event('selectstart', {
        bubbles: true,
        cancelable: true
      })
      grid().dispatchEvent(selection)
      expect(selection.defaultPrevented).toBe(false)
    })

    it('captures the pointer once a marquee drag starts, not on press', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)
      const capture = vi.spyOn(grid(), 'setPointerCapture')

      card('a').dispatchEvent(
        pointer('pointerdown', { clientX: 5, clientY: 5 })
      )
      expect(capture).not.toHaveBeenCalled()

      grid().dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      expect(capture).not.toHaveBeenCalled()

      window.dispatchEvent(
        pointer('pointermove', { clientX: 110, clientY: 50 })
      )
      expect(capture).toHaveBeenCalledWith(1)
    })

    it('does not capture the pointer on a Ctrl/Cmd-click of a card', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)
      const capture = vi.spyOn(grid(), 'setPointerCapture')

      card('a').dispatchEvent(
        pointer('pointerdown', { clientX: 5, clientY: 5, ctrlKey: true })
      )
      window.dispatchEvent(pointer('pointerup', { clientX: 5, clientY: 5 }))

      expect(capture).not.toHaveBeenCalled()
    })

    it('still tracks a marquee when setPointerCapture throws', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)
      vi.spyOn(grid(), 'setPointerCapture').mockImplementation(() => {
        throw new Error('stale pointer id')
      })

      grid().dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }))
      window.dispatchEvent(
        pointer('pointermove', { clientX: 110, clientY: 50 })
      )
      expect(callbacks.setSelectedIds).toHaveBeenLastCalledWith(
        ['a', 'b'],
        assets
      )

      window.dispatchEvent(pointer('pointerup', { clientX: 110, clientY: 50 }))
      await nextTick()
      expect(screen.queryByTestId('marquee')).toBeNull()
    })
  })

  describe('ctrl/cmd + A', () => {
    function pressSelectAll(init: KeyboardEventInit = {}) {
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        ...init
      })
      window.dispatchEvent(event)
      return event
    }

    it('selects all visible assets and blocks the event when hovered', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      panel().dispatchEvent(new MouseEvent('mouseenter'))
      const event = pressSelectAll()

      expect(callbacks.selectAll).toHaveBeenCalledWith(assets)
      expect(event.defaultPrevented).toBe(true)
    })

    it('selects all with the Cmd/Meta key while hovered', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      panel().dispatchEvent(new MouseEvent('mouseenter'))
      pressSelectAll({ ctrlKey: false, metaKey: true })

      expect(callbacks.selectAll).toHaveBeenCalledWith(assets)
    })

    it('does nothing when the panel is not hovered', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      pressSelectAll()

      expect(callbacks.selectAll).not.toHaveBeenCalled()
    })

    it('still selects all when hover desyncs but the pointer stays inside the panel', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)
      vi.spyOn(panel(), 'getBoundingClientRect').mockReturnValue(
        fromPartial<DOMRect>({
          left: 0,
          top: 0,
          right: 500,
          bottom: 500,
          width: 500,
          height: 500
        })
      )

      panel().dispatchEvent(new MouseEvent('mouseenter'))
      window.dispatchEvent(
        pointer('pointermove', { clientX: 100, clientY: 100 })
      )
      // The selection bar under the cursor unmounts on "deselect all", which
      // latches useElementHover false while the pointer is still inside.
      panel().dispatchEvent(new MouseEvent('mouseleave'))

      const event = pressSelectAll()

      expect(callbacks.selectAll).toHaveBeenCalledWith(assets)
      expect(event.defaultPrevented).toBe(true)
    })

    it('does not select all when the live pointer is outside the panel rect', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)
      vi.spyOn(panel(), 'getBoundingClientRect').mockReturnValue(
        fromPartial<DOMRect>({
          left: 0,
          top: 0,
          right: 500,
          bottom: 500,
          width: 500,
          height: 500
        })
      )

      window.dispatchEvent(
        pointer('pointermove', { clientX: 900, clientY: 900 })
      )
      panel().dispatchEvent(new MouseEvent('mouseleave'))

      const event = pressSelectAll()

      expect(callbacks.selectAll).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
    })

    it('ignores other keys and the unmodified A while hovered', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      panel().dispatchEvent(new MouseEvent('mouseenter'))
      pressSelectAll({ ctrlKey: false })
      pressSelectAll({ key: 'b' })

      expect(callbacks.selectAll).not.toHaveBeenCalled()
    })

    it('does not hijack select-all while typing in a field', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      panel().dispatchEvent(new MouseEvent('mouseenter'))
      screen.getByTestId<HTMLInputElement>('search').focus()
      pressSelectAll()

      expect(callbacks.selectAll).not.toHaveBeenCalled()
    })

    it('does not hijack select-all while focused in a textarea', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      panel().dispatchEvent(new MouseEvent('mouseenter'))
      screen.getByTestId<HTMLTextAreaElement>('textarea').focus()
      pressSelectAll()

      expect(callbacks.selectAll).not.toHaveBeenCalled()
    })

    it('does not hijack select-all while focused in a contenteditable element', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      panel().dispatchEvent(new MouseEvent('mouseenter'))
      screen.getByTestId('editable').focus()
      pressSelectAll()

      expect(callbacks.selectAll).not.toHaveBeenCalled()
    })

    it('does not hijack select-all while an aria-modal dialog is open', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)

      panel().dispatchEvent(new MouseEvent('mouseenter'))
      const dialog = document.createElement('div')
      dialog.setAttribute('role', 'dialog')
      dialog.setAttribute('aria-modal', 'true')
      document.body.appendChild(dialog)

      const event = pressSelectAll()

      expect(callbacks.selectAll).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)

      dialog.remove()
    })

    it('stops the select-all keystroke from reaching other handlers when hovered', async () => {
      const callbacks = createCallbacks()
      await renderHarness(callbacks)
      const downstream = vi.fn()
      window.addEventListener('keydown', downstream)

      panel().dispatchEvent(new MouseEvent('mouseenter'))
      pressSelectAll()
      expect(callbacks.selectAll).toHaveBeenCalledTimes(1)
      expect(downstream).not.toHaveBeenCalled()

      panel().dispatchEvent(new MouseEvent('mouseleave'))
      pressSelectAll()
      expect(callbacks.selectAll).toHaveBeenCalledTimes(1)
      expect(downstream).toHaveBeenCalledTimes(1)

      window.removeEventListener('keydown', downstream)
    })
  })
})
