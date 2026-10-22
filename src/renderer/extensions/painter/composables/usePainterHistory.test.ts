import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WidgetHistoryScope } from '@/stores/widgetHistoryStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import {
  captureCanvasRegion,
  clampCanvasRect,
  usePainterHistory
} from './usePainterHistory'

function painterScope(nodeId: number): WidgetHistoryScope {
  return {
    rootGraphId: 'root',
    widgetId: widgetId('root', toNodeId(nodeId), 'mask')
  }
}

const scope = painterScope(1)

interface PixelCanvas {
  width: number
  height: number
  pixels: number[]
  getContext: () => CanvasRenderingContext2D
  toBlob: (done: (blob: Blob | null) => void) => void
}

const encoded = new Map<Blob, PixelCanvas>()

function createPixelCanvas(): PixelCanvas {
  const canvas: PixelCanvas = {
    width: 0,
    height: 0,
    pixels: [],
    getContext: () => ctx,
    toBlob: (done) => {
      const png = new Blob(['png'])
      encoded.set(png, { ...canvas, pixels: [...canvas.pixels] })
      done(png)
    }
  }
  const at = (x: number, y: number) => y * canvas.width + x
  const ctx = fromPartial<CanvasRenderingContext2D>({
    canvas: fromAny<HTMLCanvasElement, unknown>(canvas),
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: (x: number, y: number, w: number, h: number) => {
      for (let row = y; row < y + h; row++)
        canvas.pixels.fill(0, at(x, row), at(x + w, row))
    },
    drawImage: fromAny<CanvasRenderingContext2D['drawImage'], unknown>(
      (source: PixelCanvas, ...args: number[]) => {
        const [sx, sy, w, h, dx, dy] =
          args.length === 2
            ? [0, 0, source.width, source.height, args[0], args[1]]
            : args
        for (let row = 0; row < h; row++)
          for (let col = 0; col < w; col++)
            canvas.pixels[at(dx + col, dy + row)] =
              source.pixels[(sy + row) * source.width + sx + col] ?? 0
      }
    )
  })
  return canvas
}

beforeEach(() => {
  vi.spyOn(document, 'createElement').mockImplementation(() =>
    fromAny<HTMLCanvasElement, unknown>(createPixelCanvas())
  )
})

const idleTasks: (() => void)[] = []

beforeEach(() => {
  encoded.clear()
  idleTasks.length = 0
  vi.stubGlobal('requestIdleCallback', (task: () => void) =>
    idleTasks.push(task)
  )
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (png: Blob) => ({ ...encoded.get(png), close: vi.fn() }))
  )
})

function runIdleTasks() {
  for (const task of idleTasks.splice(0)) task()
}

function setup(
  target: WidgetHistoryScope | null = scope,
  options: {
    budgetBytes?: number
    compressMinPixels?: number
    canRestore?: () => boolean
  } = {}
) {
  const canvas = createPixelCanvas()
  canvas.width = 4
  canvas.height = 4
  canvas.pixels = Array.from({ length: 16 }, () => 0)
  const source = fromAny<HTMLCanvasElement, unknown>(canvas)
  const onRestore = vi.fn()
  const history = usePainterHistory({
    scope: () => target,
    context: () => canvas.getContext(),
    onRestore,
    ...options
  })
  const stroke = (x: number, y: number, value: number) => {
    history.record(() =>
      captureCanvasRegion(source, { x, y, width: 1, height: 1 })
    )
    canvas.pixels[y * 4 + x] = value
  }
  const pixel = (x: number, y: number) => canvas.pixels[y * 4 + x]
  return { history, onRestore, stroke, pixel }
}

describe(clampCanvasRect, () => {
  it.for([
    {
      case: 'inside the canvas',
      rect: { x: 1.4, y: 1.6, width: 1, height: 1 },
      expected: { x: 1, y: 1, width: 2, height: 2 }
    },
    {
      case: 'past the edges',
      rect: { x: -2, y: -2, width: 10, height: 10 },
      expected: { x: 0, y: 0, width: 4, height: 4 }
    },
    {
      case: 'outside the canvas',
      rect: { x: 5, y: 5, width: 2, height: 2 },
      expected: null
    }
  ])('clamps a rect $case', ({ rect, expected }) => {
    expect(clampCanvasRect(rect, { width: 4, height: 4 })).toEqual(expected)
  })
})

describe(usePainterHistory, () => {
  it('restores the pixels under a stroke on undo and repaints them on redo', async () => {
    const { history, pixel, stroke, onRestore } = setup()
    stroke(1, 2, 200)

    await history.undo()
    expect(pixel(1, 2)).toBe(0)
    expect(history.canRedo.value).toBe(true)

    await history.redo()
    expect(pixel(1, 2)).toBe(200)
    expect(onRestore).toHaveBeenCalledTimes(2)
  })

  it('undoes overlapping strokes in reverse order', async () => {
    const { history, pixel, stroke } = setup()
    stroke(0, 0, 100)
    stroke(0, 0, 150)

    await history.undo()
    expect(pixel(0, 0)).toBe(100)
    await history.undo()
    expect(pixel(0, 0)).toBe(0)
    expect(history.canUndo.value).toBe(false)
  })

  it('drops its steps when discarded', () => {
    const { history, stroke } = setup()
    stroke(0, 0, 100)

    history.discard()

    expect(history.canUndo.value).toBe(false)
  })

  it('records nothing without a scope', async () => {
    const { history, pixel, stroke, onRestore } = setup(null)
    stroke(0, 0, 100)

    await history.undo()

    expect(pixel(0, 0)).toBe(100)
    expect(history.canUndo.value).toBe(false)
    expect(onRestore).not.toHaveBeenCalled()
  })

  it('drops the oldest step across painters once the shared budget is exceeded', async () => {
    const first = setup(scope, { budgetBytes: 8 })
    const second = setup(painterScope(2), { budgetBytes: 8 })
    first.stroke(0, 0, 100)
    second.stroke(0, 0, 100)

    first.stroke(1, 0, 100)
    await first.history.undo()

    expect(first.pixel(1, 0)).toBe(0)
    expect(first.pixel(0, 0)).toBe(100)
    expect(first.history.canUndo.value).toBe(false)
    expect(second.history.canUndo.value).toBe(true)
  })

  it('restores a step that was compressed while idle', async () => {
    const { history, pixel, stroke } = setup(scope, { compressMinPixels: 1 })
    stroke(2, 1, 180)
    runIdleTasks()

    await history.undo()

    expect(createImageBitmap).toHaveBeenCalledOnce()
    expect(pixel(2, 1)).toBe(0)
    await history.redo()
    expect(pixel(2, 1)).toBe(180)
  })

  it('leaves small steps uncompressed', () => {
    const { stroke } = setup(scope, { compressMinPixels: 4 })
    stroke(0, 0, 100)

    expect(idleTasks).toHaveLength(0)
  })

  it('drops a step that fails to decode and keeps the earlier steps working', async () => {
    const { history, pixel, stroke } = setup(scope, { compressMinPixels: 1 })
    stroke(0, 0, 100)
    stroke(0, 0, 150)
    runIdleTasks()
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error('decode'))

    await history.undo()
    expect(pixel(0, 0)).toBe(150)

    await history.undo()
    expect(pixel(0, 0)).toBe(0)
    expect(history.canUndo.value).toBe(false)
  })

  it('abandons an undo when another step is recorded while it decodes', async () => {
    const { history, pixel, stroke } = setup(scope, { compressMinPixels: 1 })
    stroke(0, 0, 100)
    runIdleTasks()
    let finishDecode = () => {}
    const decoded = new Promise<void>((resolve) => {
      finishDecode = resolve
    })
    vi.mocked(createImageBitmap).mockImplementationOnce(async (png) => {
      await decoded
      return fromAny<ImageBitmap, unknown>({
        ...encoded.get(fromAny<Blob, unknown>(png)),
        close: vi.fn()
      })
    })

    const undoing = history.undo()
    await vi.waitFor(() => expect(createImageBitmap).toHaveBeenCalled())
    stroke(1, 0, 150)
    finishDecode()
    await undoing

    expect(pixel(0, 0)).toBe(100)
    expect(pixel(1, 0)).toBe(150)
    expect(history.canRedo.value).toBe(false)
  })

  it('abandons an undo the painter cannot take right now', async () => {
    const { history, pixel, stroke } = setup(scope, { canRestore: () => false })
    stroke(0, 0, 100)

    await history.undo()

    expect(pixel(0, 0)).toBe(100)
    expect(history.canUndo.value).toBe(true)
  })

  it('reports an undo in progress until it settles', async () => {
    const { history, stroke } = setup()
    stroke(0, 0, 100)

    const undoing = history.undo()
    expect(history.isRestoring()).toBe(true)
    await undoing

    expect(history.isRestoring()).toBe(false)
  })

  it('records nothing when a region cannot be captured', () => {
    vi.mocked(document.createElement).mockImplementation(() =>
      fromPartial<HTMLCanvasElement>({ getContext: () => null })
    )
    const { history, stroke } = setup()
    stroke(0, 0, 100)

    expect(history.canUndo.value).toBe(false)
  })
})
