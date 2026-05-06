import type { MockInstance } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CompassCorners } from '@/lib/litegraph/src/interfaces'
import { MIN_NODE_WIDTH } from '@/renderer/core/layout/transform/graphRenderTransform'

import type { ResizeCallbackPayload } from './useNodeResize'

type ResizeCallback = (
  payload: ResizeCallbackPayload,
  element: HTMLElement
) => void

// Capture pointermove/pointerup handlers registered via useEventListener
const eventHandlers = vi.hoisted(() => ({
  pointermove: null as ((e: PointerEvent) => void) | null,
  pointerup: null as ((e: PointerEvent) => void) | null
}))

vi.mock('@vueuse/core', () => ({
  useEventListener: vi.fn(
    (eventName: string, handler: (...args: unknown[]) => void) => {
      if (eventName === 'pointermove' || eventName === 'pointerup') {
        eventHandlers[eventName] = handler as (e: PointerEvent) => void
      }
      return vi.fn()
    }
  )
}))

vi.mock('@/renderer/core/layout/transform/useTransformState', () => ({
  useTransformState: () => ({
    camera: { x: 0, y: 0, z: 1 }
  })
}))

const snapState = vi.hoisted(() => ({
  shouldSnap: false,
  applySnapToPosition: (pos: { x: number; y: number }) => pos,
  applySnapToSize: (size: { width: number; height: number }) => size
}))

vi.mock('@/renderer/extensions/vueNodes/composables/useNodeSnap', () => ({
  useNodeSnap: () => ({
    shouldSnap: vi.fn(() => snapState.shouldSnap),
    applySnapToPosition: vi.fn((pos: { x: number; y: number }) =>
      snapState.applySnapToPosition(pos)
    ),
    applySnapToSize: vi.fn((size: { width: number; height: number }) =>
      snapState.applySnapToSize(size)
    )
  })
}))

vi.mock('@/renderer/extensions/vueNodes/composables/useShiftKeySync', () => ({
  useShiftKeySync: () => ({
    trackShiftKey: vi.fn(() => vi.fn())
  })
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    isResizingVueNodes: { value: false },
    getNodeLayoutRef: vi.fn(() => ({
      value: {
        position: { x: 100, y: 200 },
        size: { width: 300, height: 400 }
      }
    }))
  }
}))

function createMockNodeElement(
  width = 300,
  height = 400,
  minContentHeight = 150
): HTMLElement {
  const element = document.createElement('div')
  element.setAttribute('data-node-id', 'test-node')
  element.style.setProperty('min-width', `${MIN_NODE_WIDTH}px`)
  element.getBoundingClientRect = () => {
    // When --node-height is '0px', return the content-driven minimum height
    const nodeHeight = element.style.getPropertyValue('--node-height')
    const h = nodeHeight === '0px' ? minContentHeight : height
    return {
      width,
      height: h,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: h,
      toJSON: () => {}
    } as DOMRect
  }
  return element
}

function createMockHandle(nodeElement: HTMLElement): HTMLElement {
  const handle = document.createElement('div')
  nodeElement.appendChild(handle)
  handle.setPointerCapture = vi.fn()
  handle.releasePointerCapture = vi.fn()
  return handle
}

function createPointerEvent(
  type: string,
  overrides: Partial<PointerEvent> = {}
): PointerEvent {
  return {
    type,
    clientX: 0,
    clientY: 0,
    pointerId: 1,
    shiftKey: false,
    currentTarget: null,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides
  } as Partial<PointerEvent> as PointerEvent
}

function startResizeAt(
  startResize: (event: PointerEvent, corner: CompassCorners) => void,
  handle: HTMLElement,
  corner: CompassCorners,
  clientX = 500,
  clientY = 500
) {
  const downEvent = createPointerEvent('pointerdown', {
    currentTarget: handle,
    clientX,
    clientY
  } as Partial<PointerEvent>)
  startResize(downEvent, corner)
}

function simulateMove(
  deltaX: number,
  deltaY: number,
  startX = 500,
  startY = 500
) {
  const moveEvent = createPointerEvent('pointermove', {
    clientX: startX + deltaX,
    clientY: startY + deltaY
  })
  eventHandlers.pointermove?.(moveEvent)
}

describe('useNodeResize', () => {
  let callback: ResizeCallback & MockInstance<ResizeCallback>
  let nodeElement: HTMLElement
  let handle: HTMLElement

  beforeEach(async () => {
    vi.clearAllMocks()
    eventHandlers.pointermove = null
    eventHandlers.pointerup = null
    snapState.shouldSnap = false
    snapState.applySnapToPosition = (pos) => pos
    snapState.applySnapToSize = (size) => size

    callback = vi.fn<ResizeCallback>()
    nodeElement = createMockNodeElement()
    handle = createMockHandle(nodeElement)

    // Need fresh import after mocks are set up
    const { useNodeResize } = await import('./useNodeResize')
    const { startResize } = useNodeResize(callback)

    // Store startResize for access in tests
    ;(globalThis as Record<string, unknown>).__testStartResize = startResize
  })

  function getStartResize() {
    return (globalThis as Record<string, unknown>).__testStartResize as (
      event: PointerEvent,
      corner: CompassCorners
    ) => void
  }

  describe('SE corner (default)', () => {
    it('increases size when dragging right and down', () => {
      startResizeAt(getStartResize(), handle, 'SE')
      simulateMove(50, 30)

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          size: { width: 350, height: 430 }
        }),
        nodeElement
      )
    })

    it('does not include position in payload', () => {
      startResizeAt(getStartResize(), handle, 'SE')
      simulateMove(50, 30)

      const payload: ResizeCallbackPayload = callback.mock.calls[0][0]
      expect(payload.position).toBeUndefined()
    })

    it('clamps width to minimum', () => {
      startResizeAt(getStartResize(), handle, 'SE')
      simulateMove(-200, 0)

      const payload: ResizeCallbackPayload = callback.mock.calls[0][0]
      expect(payload.size.width).toBe(MIN_NODE_WIDTH)
    })
  })

  describe('NE corner', () => {
    it('increases width right, decreases height upward, shifts y position', () => {
      startResizeAt(getStartResize(), handle, 'NE')
      simulateMove(50, -30)

      const payload: ResizeCallbackPayload = callback.mock.calls[0][0]
      expect(payload.size).toEqual({ width: 350, height: 430 })
      expect(payload.position).toEqual({ x: 100, y: 170 })
    })

    it('clamps height to content minimum and fixes bottom edge', () => {
      startResizeAt(getStartResize(), handle, 'NE')
      simulateMove(0, 500)

      const payload: ResizeCallbackPayload = callback.mock.calls[0][0]
      // minContentHeight = 150, so height clamps to 150
      expect(payload.size.height).toBe(150)
      // y = startY + startHeight - minContentHeight = 200 + 400 - 150 = 450
      expect(payload.position!.y).toBe(450)
    })
  })

  describe('SW corner', () => {
    it('decreases width leftward, increases height downward, shifts x position', () => {
      startResizeAt(getStartResize(), handle, 'SW')
      simulateMove(-50, 30)

      const payload: ResizeCallbackPayload = callback.mock.calls[0][0]
      expect(payload.size).toEqual({ width: 350, height: 430 })
      expect(payload.position).toEqual({ x: 50, y: 200 })
    })

    it('clamps width to minimum and fixes right edge', () => {
      startResizeAt(getStartResize(), handle, 'SW')
      simulateMove(200, 0)

      const payload: ResizeCallbackPayload = callback.mock.calls[0][0]
      expect(payload.size.width).toBe(MIN_NODE_WIDTH)
      // x = startX + startWidth - minWidth = 100 + 300 - MIN_NODE_WIDTH
      expect(payload.position!.x).toBe(100 + 300 - MIN_NODE_WIDTH)
    })
  })

  describe('NW corner', () => {
    it('decreases width leftward, decreases height upward, shifts both x and y', () => {
      startResizeAt(getStartResize(), handle, 'NW')
      simulateMove(-50, -30)

      const payload: ResizeCallbackPayload = callback.mock.calls[0][0]
      expect(payload.size).toEqual({ width: 350, height: 430 })
      expect(payload.position).toEqual({ x: 50, y: 170 })
    })

    it('clamps width to minimum and fixes right edge', () => {
      startResizeAt(getStartResize(), handle, 'NW')
      simulateMove(200, 0)

      const payload: ResizeCallbackPayload = callback.mock.calls[0][0]
      expect(payload.size.width).toBe(MIN_NODE_WIDTH)
      // x = startX + startWidth - minWidth = 100 + 300 - MIN_NODE_WIDTH
      expect(payload.position!.x).toBe(100 + 300 - MIN_NODE_WIDTH)
    })

    it('clamps height to content minimum and fixes bottom edge', () => {
      startResizeAt(getStartResize(), handle, 'NW')
      simulateMove(0, 500)

      const payload: ResizeCallbackPayload = callback.mock.calls[0][0]
      // minContentHeight = 150, so height clamps to 150
      expect(payload.size.height).toBe(150)
      // y = startY + startHeight - minContentHeight = 200 + 400 - 150 = 450
      expect(payload.position!.y).toBe(450)
    })
  })

  describe('dynamic content height (re-measured per move)', () => {
    function makeReflowingElement(
      width: number,
      height: number,
      getMinContentHeight: () => number
    ): HTMLElement {
      const element = document.createElement('div')
      element.setAttribute('data-node-id', 'test-node')
      element.style.setProperty('min-width', `${MIN_NODE_WIDTH}px`)
      element.getBoundingClientRect = () => {
        const nodeHeight = element.style.getPropertyValue('--node-height')
        const h = nodeHeight === '0px' ? getMinContentHeight() : height
        return {
          width,
          height: h,
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: width,
          bottom: h,
          toJSON: () => {}
        } as DOMRect
      }
      return element
    }

    async function setupDynamic(getMinContentHeight: () => number) {
      vi.clearAllMocks()
      eventHandlers.pointermove = null
      eventHandlers.pointerup = null
      const cb = vi.fn<ResizeCallback>()
      const el = makeReflowingElement(300, 400, getMinContentHeight)
      const h = createMockHandle(el)
      const { useNodeResize } = await import('./useNodeResize')
      const { startResize } = useNodeResize(cb)
      return { cb, el, handle: h, startResize }
    }

    it('uses the latest measured content height when content reflows taller', async () => {
      let currentMinHeight = 150
      const {
        cb,
        handle: h,
        startResize
      } = await setupDynamic(() => currentMinHeight)

      startResizeAt(startResize, h, 'SE')

      // First move: clamp uses initial minContentHeight = 150
      simulateMove(0, -300)
      const firstPayload = cb.mock.calls.at(-1)![0] as ResizeCallbackPayload
      expect(firstPayload.size.height).toBe(150)

      // Content reflows taller (e.g. painter switches to compact layout)
      currentMinHeight = 280

      // Second move at the same position must reflect the new minimum,
      // not the value captured at drag start.
      simulateMove(0, -300)
      const secondPayload = cb.mock.calls.at(-1)![0] as ResizeCallbackPayload
      expect(secondPayload.size.height).toBe(280)
    })

    it('also re-measures for N corners and updates the y-position clamp', async () => {
      let currentMinHeight = 150
      const {
        cb,
        handle: h,
        startResize
      } = await setupDynamic(() => currentMinHeight)

      startResizeAt(startResize, h, 'NW')

      simulateMove(0, 500)
      const firstPayload = cb.mock.calls.at(-1)![0] as ResizeCallbackPayload
      expect(firstPayload.size.height).toBe(150)
      expect(firstPayload.position!.y).toBe(450) // 200 + 400 - 150

      currentMinHeight = 220

      simulateMove(0, 500)
      const secondPayload = cb.mock.calls.at(-1)![0] as ResizeCallbackPayload
      expect(secondPayload.size.height).toBe(220)
      expect(secondPayload.position!.y).toBe(380) // 200 + 400 - 220
    })

    it('stops responding to pointermove after pointerup', async () => {
      const currentMinHeight = 150
      const {
        cb,
        handle: h,
        startResize
      } = await setupDynamic(() => currentMinHeight)

      startResizeAt(startResize, h, 'SE')
      simulateMove(20, 20)
      const callsBeforeUp = cb.mock.calls.length

      const upEvent = createPointerEvent('pointerup', { pointerId: 1 })
      eventHandlers.pointerup?.(upEvent)

      // Subsequent moves should be ignored after cleanup
      simulateMove(40, 40)
      expect(cb.mock.calls.length).toBe(callsBeforeUp)
    })

    it('handles releasePointerCapture throwing without breaking cleanup', async () => {
      const { cb, el, handle: h, startResize } = await setupDynamic(() => 150)
      h.releasePointerCapture = vi.fn(() => {
        throw new Error('already released')
      })

      startResizeAt(startResize, h, 'SE')
      simulateMove(10, 10)

      const upEvent = createPointerEvent('pointerup', { pointerId: 1 })
      expect(() => eventHandlers.pointerup?.(upEvent)).not.toThrow()

      // Further moves are ignored — cleanup still ran.
      const callsAfterUp = cb.mock.calls.length
      simulateMove(50, 50)
      expect(cb.mock.calls.length).toBe(callsAfterUp)
      expect(el).toBeDefined()
    })

    it('applies snap-to-grid on SE (size only)', async () => {
      snapState.shouldSnap = true
      snapState.applySnapToSize = ({ width, height }) => ({
        width: Math.round(width / 10) * 10,
        height: Math.round(height / 10) * 10
      })

      const { cb, handle: h, startResize } = await setupDynamic(() => 50)
      startResizeAt(startResize, h, 'SE')
      simulateMove(53, 27)

      const payload = cb.mock.calls.at(-1)![0] as ResizeCallbackPayload
      expect(payload.size.width).toBe(350) // 353 -> 350
      expect(payload.size.height).toBe(430) // 427 -> 430
      expect(payload.position).toBeUndefined()
    })

    it('applies snap-to-grid on NW (position + size compensation)', async () => {
      snapState.shouldSnap = true
      // Snap position down to nearest 10
      snapState.applySnapToPosition = ({ x, y }) => ({
        x: Math.floor(x / 10) * 10,
        y: Math.floor(y / 10) * 10
      })
      snapState.applySnapToSize = ({ width, height }) => ({
        width: Math.round(width / 10) * 10,
        height: Math.round(height / 10) * 10
      })

      const { cb, handle: h, startResize } = await setupDynamic(() => 50)
      startResizeAt(startResize, h, 'NW')
      // delta: x=-53, y=-27 -> raw newX=47, newY=173
      // applySnapToPosition floors -> {40, 170}
      // size compensated: width += 47-40=7 (-> 360), height += 173-170=3 (-> 430)
      // applySnapToSize rounds -> 360, 430
      simulateMove(-53, -27)

      const payload = cb.mock.calls.at(-1)![0] as ResizeCallbackPayload
      expect(payload.position).toEqual({ x: 40, y: 170 })
      expect(payload.size).toEqual({ width: 360, height: 430 })
    })

    it('restores --node-height after measuring (does not clobber state)', async () => {
      const { el, handle: h, startResize } = await setupDynamic(() => 150)
      el.style.setProperty('--node-height', '400px')

      startResizeAt(startResize, h, 'SE')
      simulateMove(10, 10)

      // Probe value should be reverted, not left at '0px'
      expect(el.style.getPropertyValue('--node-height')).toBe('400px')
    })
  })
})
