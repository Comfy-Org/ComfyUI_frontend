import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type * as VueUseCore from '@vueuse/core'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import SelectionRectangle from './SelectionRectangle.vue'

const rafCallbacks = vi.hoisted(() => [] as Array<() => void>)

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof VueUseCore>()

  return {
    ...actual,
    useRafFn: vi.fn((callback: () => void) => {
      rafCallbacks.push(callback)
      return {
        pause: vi.fn(),
        resume: vi.fn()
      }
    })
  }
})

type StubCanvas = {
  canvas: HTMLCanvasElement
  dragging_rectangle: [number, number, number, number] | null
  pointer: {
    eDown?: PointerLike
    eMove?: PointerLike
  }
}

type PointerLike = {
  clientX: number
  clientY: number
}

function createCanvasElement(rect: DOMRect) {
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect
  })

  return canvas
}

function createPointer(clientX: number, clientY: number): PointerLike {
  return { clientX, clientY }
}

async function runFrame() {
  rafCallbacks.at(-1)?.()
  await nextTick()
}

describe('SelectionRectangle', () => {
  beforeEach(() => {
    rafCallbacks.length = 0
    document.body.replaceChildren()
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('clips the canvas selection rectangle to the graph canvas bounds', async () => {
    const store = useCanvasStore()
    const canvas = createCanvasElement(new DOMRect(100, 50, 300, 200))
    store.canvas = {
      canvas,
      dragging_rectangle: [0, 0, 1, 1],
      pointer: {
        eDown: createPointer(50, 20),
        eMove: createPointer(250, 180)
      }
    } as StubCanvas as unknown as LGraphCanvas

    const { unmount } = render(SelectionRectangle)

    await runFrame()

    const element = screen.getByTestId('selection-rectangle')
    expect(element.style.display).not.toBe('none')
    expect(element.style.left).toBe('0px')
    expect(element.style.top).toBe('0px')
    expect(element.style.width).toBe('150px')
    expect(element.style.height).toBe('130px')

    unmount()
  })

  it('normalizes and clips an up-left drag to an offset canvas panel', async () => {
    const store = useCanvasStore()
    const canvas = createCanvasElement(new DOMRect(100, 50, 600, 400))
    const panel = document.createElement('div')
    panel.className = 'graph-canvas-panel'
    Object.defineProperty(panel, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(250, 100, 350, 300)
    })
    document.body.append(panel)

    store.canvas = {
      canvas,
      dragging_rectangle: [0, 0, 1, 1],
      pointer: {
        eDown: createPointer(650, 450),
        eMove: createPointer(150, 80)
      }
    } as StubCanvas as unknown as LGraphCanvas

    const { unmount } = render(SelectionRectangle)

    await runFrame()

    const element = screen.getByTestId('selection-rectangle')
    expect(element.style.display).not.toBe('none')
    expect(element.style.left).toBe('150px')
    expect(element.style.top).toBe('50px')
    expect(element.style.width).toBe('350px')
    expect(element.style.height).toBe('300px')

    unmount()
  })

  it('hides the canvas selection rectangle when the drag misses the canvas', async () => {
    const store = useCanvasStore()
    const canvas = createCanvasElement(new DOMRect(100, 50, 300, 200))
    store.canvas = {
      canvas,
      dragging_rectangle: [0, 0, 1, 1],
      pointer: {
        eDown: createPointer(10, 10),
        eMove: createPointer(50, 40)
      }
    } as StubCanvas as unknown as LGraphCanvas

    const { unmount } = render(SelectionRectangle)

    await runFrame()

    expect(screen.getByTestId('selection-rectangle').style.display).toBe('none')

    unmount()
  })
})
