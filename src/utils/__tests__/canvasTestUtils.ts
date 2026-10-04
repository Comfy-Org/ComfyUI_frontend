import { vi } from 'vitest'

import type { CanvasPointerEvent, LGraph } from '@/lib/litegraph/src/litegraph'
import { DragAndScale, LGraphCanvas } from '@/lib/litegraph/src/litegraph'

/**
 * Creates a mock LGraphCanvas with minimal required properties for testing
 */
export function createMockCanvas(
  overrides: Partial<LGraphCanvas> | Record<string, unknown> = {}
): LGraphCanvas {
  return {
    setDirty: vi.fn(),
    state: {},
    ...(overrides as Partial<LGraphCanvas>)
  } as LGraphCanvas
}

/**
 * Creates a mock CanvasPointerEvent
 */
export function createMockCanvasPointerEvent(
  canvasX: number,
  canvasY: number,
  overrides: Partial<CanvasPointerEvent> = {}
): CanvasPointerEvent {
  return {
    canvasX,
    canvasY,
    ...overrides
  } as CanvasPointerEvent
}

/**
 * Creates a mock CanvasRenderingContext2D
 */
export function createMockCanvasRenderingContext2D(
  overrides: Partial<CanvasRenderingContext2D> = {}
): CanvasRenderingContext2D {
  const partial: Partial<CanvasRenderingContext2D> = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 }) as TextMetrics),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    roundRect: vi.fn(),
    getTransform: vi.fn(
      () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) as DOMMatrix
    ),
    createPattern: vi.fn(() => null),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    ...overrides
  }
  return partial as CanvasRenderingContext2D
}

/**
 * Creates a mock MinimapCanvas for minimap testing
 */
export function createMockMinimapCanvas(
  overrides: Partial<HTMLCanvasElement> = {}
): HTMLCanvasElement {
  const mockGetContext = vi.fn()
  mockGetContext.mockImplementation((contextId: string) =>
    contextId === '2d' ? createMockCanvasRenderingContext2D() : null
  )

  const partial: Partial<HTMLCanvasElement> = {
    width: 200,
    height: 200,
    clientWidth: 200,
    clientHeight: 200,
    getContext: mockGetContext as HTMLCanvasElement['getContext'],
    ...overrides
  }
  return partial as HTMLCanvasElement
}

export function createTestCanvas(
  graph: LGraph,
  ctx: CanvasRenderingContext2D
): LGraphCanvas {
  const element = createTestCanvasElement({ ctx, cssSize: [800, 600] })
  return new LGraphCanvas(element, graph, { skip_render: true })
}

interface TestCanvasElementOptions {
  /** Backing-store dimensions. */
  width?: number
  height?: number
  /** Layout dimensions reported by `getBoundingClientRect`. */
  cssSize?: [width: number, height: number]
  /** Whether layout reports the canvas as rendered; see {@link setCanvasVisible}. */
  visible?: boolean
  ctx?: CanvasRenderingContext2D
}

export function createTestCanvasElement({
  width = 800,
  height = 600,
  cssSize,
  visible,
  ctx = createMockCanvasRenderingContext2D()
}: TestCanvasElementOptions = {}): HTMLCanvasElement {
  const element = document.createElement('canvas')
  element.width = width
  element.height = height
  element.getContext = vi.fn().mockReturnValue(ctx)
  Object.defineProperties(element, {
    offsetWidth: {
      configurable: true,
      get: () =>
        cssSize?.[0] ??
        (Number.parseFloat(element.style.width) || element.width)
    },
    offsetHeight: {
      configurable: true,
      get: () =>
        cssSize?.[1] ??
        (Number.parseFloat(element.style.height) || element.height)
    }
  })
  if (cssSize) {
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, ...cssSize)
    )
  }
  if (visible !== undefined) setCanvasVisible(element, visible)
  return element
}

/**
 * happy-dom has no layout, so report the box an `auto`-sized canvas gets: its
 * inline CSS dimensions when it has them, and its backing-store attributes
 * otherwise. That is how a browser lays out an unstyled `<canvas>`, and it is
 * what makes the layout box observable in a unit test.
 */
export function setIntrinsicCanvasLayout(element: HTMLCanvasElement): void {
  vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
    const width = Number.parseFloat(element.style.width) || element.width
    const height = Number.parseFloat(element.style.height) || element.height
    return new DOMRect(0, 0, width, height)
  })
}

/** happy-dom has no layout, so report the offset geometry a rendered or hidden canvas has. */
export function setCanvasVisible(element: HTMLElement, visible: boolean): void {
  Object.defineProperties(element, {
    offsetParent: { configurable: true, value: visible ? document.body : null },
    offsetWidth: { configurable: true, value: visible ? 800 : 0 },
    offsetHeight: { configurable: true, value: visible ? 600 : 0 }
  })
}

/** A `DragAndScale` with an applied CSS viewport, as `applyViewport` leaves it. */
export function createTestDragAndScale(
  width = 800,
  height = 600
): DragAndScale {
  const ds = new DragAndScale(createTestCanvasElement({ width, height }))
  ds.setViewportSize(width, height)
  return ds
}
