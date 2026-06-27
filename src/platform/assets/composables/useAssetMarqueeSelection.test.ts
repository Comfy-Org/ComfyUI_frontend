import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope, ref } from 'vue'

import type { AssetId, AssetItem } from '@/platform/assets/schemas/assetSchema'

import { useAssetMarqueeSelection } from './useAssetMarqueeSelection'

const activeScopes: EffectScope[] = []

type TestRect = {
  left: number
  top: number
  width: number
  height: number
}

type PointerOptions = MouseEventInit & {
  pointerId?: number
  target?: EventTarget
}

function createAsset(id: AssetId): AssetItem {
  return {
    id,
    name: `${id}.png`,
    tags: ['output']
  }
}

function setRect(element: HTMLElement, rect: TestRect) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(rect.left, rect.top, rect.width, rect.height)
  })
}

function createPanel() {
  const panel = document.createElement('div')
  panel.tabIndex = -1
  setRect(panel, { left: 0, top: 0, width: 240, height: 240 })
  document.body.append(panel)
  return panel
}

function createAssetElement(id: AssetId, rect: TestRect) {
  const element = document.createElement('button')
  element.dataset.assetId = id
  setRect(element, rect)
  return element
}

function installPointerCapture(element: HTMLElement) {
  const setPointerCapture = vi.fn()
  const releasePointerCapture = vi.fn()
  const hasPointerCapture = vi.fn(() => true)

  Object.defineProperties(element, {
    setPointerCapture: {
      configurable: true,
      value: setPointerCapture
    },
    releasePointerCapture: {
      configurable: true,
      value: releasePointerCapture
    },
    hasPointerCapture: {
      configurable: true,
      value: hasPointerCapture
    }
  })

  return { setPointerCapture, releasePointerCapture }
}

function createPointerEvent(type: string, options: PointerOptions = {}) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: options.button ?? 0,
    clientX: options.clientX ?? 0,
    clientY: options.clientY ?? 0,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    shiftKey: options.shiftKey ?? false
  }) as PointerEvent

  Object.defineProperty(event, 'pointerId', {
    configurable: true,
    value: options.pointerId ?? 1
  })

  if (options.target) {
    Object.defineProperty(event, 'target', {
      configurable: true,
      value: options.target
    })
  }

  return event
}

function createKeyboardEvent(options: KeyboardEventInit = {}) {
  return new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'a',
    ctrlKey: true,
    ...options
  })
}

function hoverPanel(panel: HTMLElement) {
  panel.dispatchEvent(new MouseEvent('mouseenter'))
}

function leavePanel(panel: HTMLElement) {
  panel.dispatchEvent(new MouseEvent('mouseleave'))
}

function mountMarquee(assets = [createAsset('a'), createAsset('b')]) {
  const scope = effectScope()
  activeScopes.push(scope)

  const panel = createPanel()
  const assetPanelRef = ref<HTMLElement | null>(panel)
  const selectedIds = ref<ReadonlySet<AssetId>>(new Set())
  const visibleAssets = ref<AssetItem[]>(assets)
  const isListView = ref(false)
  const showLoadingState = ref(false)
  const showEmptyState = ref(false)
  const selectAll = vi.fn((allAssets: AssetItem[]) => {
    selectedIds.value = new Set(allAssets.map((asset) => asset.id))
  })
  const setSelectedIds = vi.fn((ids: AssetId[]) => {
    selectedIds.value = new Set(ids)
  })

  const marquee = scope.run(() =>
    useAssetMarqueeSelection({
      assetPanelRef,
      isListView,
      showLoadingState,
      showEmptyState,
      visibleAssets,
      selectedIds,
      selectAll,
      setSelectedIds
    })
  )

  if (!marquee) {
    throw new Error('Expected marquee selection composable to mount')
  }

  return {
    isListView,
    marquee,
    panel,
    scope,
    selectedIds,
    selectAll,
    setSelectedIds,
    showEmptyState,
    showLoadingState,
    visibleAssets
  }
}

function selectedIdsArray(selectedIds: ReadonlySet<AssetId>) {
  return Array.from(selectedIds)
}

describe('useAssetMarqueeSelection', () => {
  afterEach(() => {
    activeScopes.splice(0).forEach((scope) => {
      scope.stop()
    })
    document.body.replaceChildren()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('selects intersected assets from panel chrome and clips to the panel', () => {
    const { marquee, panel, selectedIds } = mountMarquee([createAsset('a')])
    setRect(panel, { left: 100, top: 50, width: 240, height: 240 })

    const header = document.createElement('div')
    setRect(header, { left: 100, top: 50, width: 240, height: 64 })
    panel.append(
      header,
      createAssetElement('a', { left: 140, top: 150, width: 80, height: 80 })
    )

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: header,
        clientX: 180,
        clientY: 80
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 400, clientY: 190 })
    )

    expect(marquee.isMarqueeSelecting.value).toBe(true)
    expect(selectedIdsArray(selectedIds.value)).toEqual(['a'])
    expect(marquee.marqueeStyle.value).toMatchObject({
      left: '180px',
      top: '80px',
      width: '160px',
      height: '110px'
    })
  })

  it('ignores moves below the marquee threshold', () => {
    const { marquee, panel, setSelectedIds } = mountMarquee([createAsset('a')])
    panel.append(
      createAssetElement('a', { left: 20, top: 20, width: 80, height: 80 })
    )

    expect(marquee.marqueeStyle.value).toEqual({})

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: panel,
        clientX: 10,
        clientY: 10
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', {
        clientX: 12,
        clientY: 12
      })
    )

    expect(marquee.isMarqueeSelecting.value).toBe(false)
    expect(setSelectedIds).not.toHaveBeenCalled()
  })

  it('keeps the active pointer in control when another pointer presses', () => {
    const { marquee, panel } = mountMarquee([createAsset('a')])
    panel.append(
      createAssetElement('a', { left: 20, top: 20, width: 80, height: 80 })
    )

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: panel,
        clientX: 10,
        clientY: 10,
        pointerId: 1
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        pointerId: 1
      })
    )

    expect(marquee.isMarqueeSelecting.value).toBe(true)

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: panel,
        clientX: 200,
        clientY: 200,
        pointerId: 2
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointerup', {
        clientX: 200,
        clientY: 200,
        pointerId: 2
      })
    )

    expect(marquee.isMarqueeSelecting.value).toBe(true)

    window.dispatchEvent(
      createPointerEvent('pointerup', {
        clientX: 100,
        clientY: 100,
        pointerId: 1
      })
    )

    expect(marquee.isMarqueeSelecting.value).toBe(false)
  })

  it('clears the active marquee on pointer cancel', () => {
    const { marquee, panel } = mountMarquee([createAsset('a')])
    panel.append(
      createAssetElement('a', { left: 20, top: 20, width: 80, height: 80 })
    )

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: panel,
        clientX: 10,
        clientY: 10,
        pointerId: 7
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        pointerId: 7
      })
    )

    expect(marquee.isMarqueeSelecting.value).toBe(true)

    window.dispatchEvent(
      createPointerEvent('pointercancel', {
        pointerId: 7
      })
    )

    expect(marquee.isMarqueeSelecting.value).toBe(false)

    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true
    })
    marquee.handleAssetPanelClickCapture(click)

    expect(click.defaultPrevented).toBe(false)
  })

  it('prevents native drag while a marquee gesture is tracking', () => {
    const { marquee, panel } = mountMarquee([createAsset('a')])
    const asset = createAssetElement('a', {
      left: 20,
      top: 20,
      width: 80,
      height: 80
    })
    panel.append(asset)

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: asset,
        clientX: 30,
        clientY: 30,
        pointerId: 1,
        ctrlKey: true
      })
    )

    const dragStart = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true
    })
    marquee.handleAssetPanelDragStartCapture(dragStart)

    expect(dragStart.defaultPrevented).toBe(true)
  })

  it('ignores plain card drags but allows modifier card drags to add', () => {
    const { marquee, panel, selectedIds, selectAll } = mountMarquee()
    selectedIds.value = new Set(['b'])
    const first = createAssetElement('a', {
      left: 20,
      top: 20,
      width: 80,
      height: 80
    })
    const second = createAssetElement('b', {
      left: 120,
      top: 120,
      width: 80,
      height: 80
    })
    panel.append(first, second)

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: first,
        clientX: 30,
        clientY: 30
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 190, clientY: 190 })
    )

    expect(selectAll).not.toHaveBeenCalled()

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: first,
        clientX: 30,
        clientY: 30,
        ctrlKey: true
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 90, clientY: 90 })
    )

    expect(selectedIdsArray(selectedIds.value).sort()).toEqual(['a', 'b'])
  })

  it('does not start marquee selection in disabled panel states', () => {
    const { isListView, marquee, panel, selectAll, showEmptyState } =
      mountMarquee()
    panel.append(
      createAssetElement('a', { left: 20, top: 20, width: 80, height: 80 })
    )

    isListView.value = true
    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: panel,
        clientX: 10,
        clientY: 10
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 100, clientY: 100 })
    )

    isListView.value = false
    showEmptyState.value = true
    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: panel,
        clientX: 10,
        clientY: 10
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 100, clientY: 100 })
    )

    expect(selectAll).not.toHaveBeenCalled()
  })

  it('clears native text selection during a drag from search without blurring', () => {
    const { marquee, panel, selectedIds } = mountMarquee([createAsset('a')])
    const searchInput = document.createElement('input')
    searchInput.type = 'search'
    searchInput.value = 'Search Assets'
    setRect(searchInput, { left: 10, top: 10, width: 160, height: 32 })
    panel.append(
      searchInput,
      createAssetElement('a', { left: 40, top: 80, width: 80, height: 80 })
    )
    searchInput.focus()
    searchInput.setSelectionRange(0, searchInput.value.length)

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: searchInput,
        clientX: 20,
        clientY: 20
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 120, clientY: 120 })
    )

    expect(selectedIdsArray(selectedIds.value)).toEqual(['a'])
    expect(searchInput.selectionStart).toBe(searchInput.value.length)
    expect(searchInput.selectionEnd).toBe(searchInput.value.length)
    expect(document.activeElement).toBe(searchInput)
  })

  it('prevents selectstart inside the panel during a marquee drag', () => {
    const { marquee, panel } = mountMarquee([createAsset('a')])
    const label = document.createElement('span')
    panel.append(
      label,
      createAssetElement('a', { left: 40, top: 80, width: 80, height: 80 })
    )

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: label,
        clientX: 20,
        clientY: 20
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 120, clientY: 120 })
    )

    const event = new Event('selectstart', {
      bubbles: true,
      cancelable: true
    })
    label.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('delays pointer capture until a marquee drag starts', () => {
    const { marquee, panel } = mountMarquee([createAsset('a')])
    const { setPointerCapture } = installPointerCapture(panel)
    const button = document.createElement('button')
    panel.append(
      button,
      createAssetElement('a', { left: 40, top: 80, width: 80, height: 80 })
    )

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: button,
        clientX: 20,
        clientY: 20,
        pointerId: 7
      })
    )

    expect(setPointerCapture).not.toHaveBeenCalled()

    window.dispatchEvent(
      createPointerEvent('pointermove', {
        clientX: 22,
        clientY: 22,
        pointerId: 7
      })
    )

    expect(setPointerCapture).not.toHaveBeenCalled()

    window.dispatchEvent(
      createPointerEvent('pointermove', {
        clientX: 120,
        clientY: 120,
        pointerId: 7
      })
    )

    expect(setPointerCapture).toHaveBeenCalledWith(7)
  })

  it('selects all only when the panel is hovered and text input is not focused', () => {
    const { panel, selectedIds, selectAll } = mountMarquee()
    const input = document.createElement('input')
    panel.append(input)

    hoverPanel(panel)

    window.dispatchEvent(createKeyboardEvent())

    expect(selectAll).toHaveBeenCalledTimes(1)
    expect(selectedIdsArray(selectedIds.value)).toEqual(['a', 'b'])

    input.focus()
    const focusedEvent = createKeyboardEvent()
    input.dispatchEvent(focusedEvent)

    expect(selectAll).toHaveBeenCalledTimes(1)
    expect(focusedEvent.defaultPrevented).toBe(false)

    input.blur()
    leavePanel(panel)
    window.dispatchEvent(createKeyboardEvent())

    expect(selectAll).toHaveBeenCalledTimes(1)
  })

  it('does not select all while a modal dialog is open', () => {
    const { panel, selectAll } = mountMarquee()
    const modal = document.createElement('div')
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    document.body.append(modal)
    hoverPanel(panel)

    const event = createKeyboardEvent()
    window.dispatchEvent(event)

    expect(selectAll).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('suppresses the trailing click after a marquee drag', () => {
    const { marquee, panel, selectedIds } = mountMarquee()
    selectedIds.value = new Set(['a'])
    panel.append(
      createAssetElement('a', { left: 20, top: 20, width: 80, height: 80 })
    )

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: panel,
        clientX: 10,
        clientY: 10
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 100, clientY: 100 })
    )
    window.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 100, clientY: 100 })
    )

    const trailingClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true
    })
    marquee.handleAssetPanelClickCapture(trailingClick)

    expect(trailingClick.defaultPrevented).toBe(true)
  })

  it('does not suppress later panel clicks when no trailing click arrives', () => {
    vi.useFakeTimers()
    const { marquee, panel } = mountMarquee()
    panel.append(
      createAssetElement('a', { left: 20, top: 20, width: 80, height: 80 })
    )

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: panel,
        clientX: 10,
        clientY: 10
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 100, clientY: 100 })
    )
    window.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 500, clientY: 500 })
    )

    vi.runOnlyPendingTimers()

    const laterClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true
    })
    marquee.handleAssetPanelClickCapture(laterClick)

    expect(laterClick.defaultPrevented).toBe(false)
  })

  it('continues selecting when pointer capture is unavailable', () => {
    const { marquee, panel, selectedIds } = mountMarquee([createAsset('a')])
    Object.defineProperty(panel, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(() => {
        throw new Error('unsupported')
      })
    })
    panel.append(
      createAssetElement('a', { left: 20, top: 20, width: 80, height: 80 })
    )

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: panel,
        clientX: 10,
        clientY: 10,
        pointerId: 7
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        pointerId: 7
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointerup', {
        clientX: 100,
        clientY: 100,
        pointerId: 7
      })
    )

    expect(selectedIdsArray(selectedIds.value)).toEqual(['a'])
    expect(marquee.isMarqueeSelecting.value).toBe(false)
  })

  it('does not throw when releasing pointer capture fails', () => {
    const { marquee, panel } = mountMarquee([createAsset('a')])
    const releasePointerCapture = vi.fn(() => {
      throw new Error('already released')
    })
    Object.defineProperties(panel, {
      setPointerCapture: {
        configurable: true,
        value: vi.fn()
      },
      releasePointerCapture: {
        configurable: true,
        value: releasePointerCapture
      }
    })
    panel.append(
      createAssetElement('a', { left: 20, top: 20, width: 80, height: 80 })
    )

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: panel,
        clientX: 10,
        clientY: 10,
        pointerId: 7
      })
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        pointerId: 7
      })
    )

    expect(marquee.isMarqueeSelecting.value).toBe(true)

    window.dispatchEvent(
      createPointerEvent('pointerup', {
        clientX: 100,
        clientY: 100,
        pointerId: 7
      })
    )

    expect(releasePointerCapture).toHaveBeenCalledWith(7)
    expect(marquee.isMarqueeSelecting.value).toBe(false)
  })

  it('ends an off-panel drag when the canvas stops pointerup propagation', () => {
    const { marquee, panel } = mountMarquee([createAsset('a')])
    const { releasePointerCapture, setPointerCapture } =
      installPointerCapture(panel)
    const canvas = document.createElement('canvas')
    canvas.addEventListener('pointerup', (event) => event.stopPropagation(), {
      capture: true
    })
    document.body.append(canvas)
    panel.append(
      createAssetElement('a', { left: 20, top: 20, width: 80, height: 80 })
    )

    marquee.handleMarqueePointerDown(
      createPointerEvent('pointerdown', {
        target: panel,
        clientX: 10,
        clientY: 10,
        pointerId: 7
      })
    )
    canvas.dispatchEvent(
      createPointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        pointerId: 7
      })
    )

    expect(setPointerCapture).toHaveBeenCalledWith(7)
    expect(marquee.isMarqueeSelecting.value).toBe(true)

    canvas.dispatchEvent(
      createPointerEvent('pointerup', {
        clientX: 100,
        clientY: 100,
        pointerId: 7
      })
    )

    expect(marquee.isMarqueeSelecting.value).toBe(false)
    expect(releasePointerCapture).toHaveBeenCalledWith(7)
  })
})
