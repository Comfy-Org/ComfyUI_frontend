import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

const testState = vi.hoisted(() => ({
  canvasElement: {
    offsetParent: {} as Element | null,
    offsetWidth: 1920,
    offsetHeight: 1080
  },
  pendingFrames: new Map<number, FrameRequestCallback>(),
  nextFrameId: 1,
  cancelAnimationFrame: vi.fn()
}))

const mockStore = reactive({
  linearMode: false,
  canvas: {
    get canvas() {
      return testState.canvasElement
    }
  }
})

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => mockStore
}))

function runNextAnimationFrame(): void {
  const nextEntry = testState.pendingFrames.entries().next().value
  if (!nextEntry) return
  const [id, callback] = nextEntry
  testState.pendingFrames.delete(id)
  callback(performance.now())
}

describe('useCanvasScheduler', () => {
  beforeEach(async () => {
    mockStore.linearMode = false
    testState.canvasElement.offsetParent = document.body
    testState.canvasElement.offsetWidth = 1920
    testState.canvasElement.offsetHeight = 1080
    testState.pendingFrames.clear()
    testState.nextFrameId = 1
    testState.cancelAnimationFrame.mockReset()

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = testState.nextFrameId++
      testState.pendingFrames.set(id, cb)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      testState.cancelAnimationFrame(id)
      testState.pendingFrames.delete(id)
    })

    vi.resetModules()
  })

  async function createScheduler() {
    const mod = await import('@/renderer/core/canvas/useCanvasScheduler')
    return mod.useCanvasScheduler()
  }

  it('schedule executes operation in next RAF when canvas is ready', async () => {
    const scheduler = await createScheduler()
    const op = vi.fn()

    scheduler.schedule(op)
    expect(op).not.toHaveBeenCalled()

    runNextAnimationFrame()
    expect(op).toHaveBeenCalledOnce()
  })

  it('schedule queues operation when canvas is not ready', async () => {
    const scheduler = await createScheduler()
    const op = vi.fn()

    testState.canvasElement.offsetParent = null
    scheduler.schedule(op)

    expect(scheduler.pending()).toBe(1)
    expect(op).not.toHaveBeenCalled()
    expect(testState.pendingFrames.size).toBe(0)
  })

  it('schedule queues when canvas has zero dimensions', async () => {
    const scheduler = await createScheduler()
    const op = vi.fn()

    testState.canvasElement.offsetWidth = 0
    testState.canvasElement.offsetHeight = 0
    scheduler.schedule(op)

    expect(scheduler.pending()).toBe(1)
    expect(op).not.toHaveBeenCalled()
    expect(testState.pendingFrames.size).toBe(0)
  })

  it('flush executes queued operations when canvas becomes ready', async () => {
    const scheduler = await createScheduler()
    const first = vi.fn()
    const second = vi.fn()

    testState.canvasElement.offsetParent = null
    scheduler.schedule(first)
    scheduler.schedule(second)

    testState.canvasElement.offsetParent = document.body
    scheduler.flush()

    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
    expect(scheduler.pending()).toBe(0)
  })

  it('flush is a no-op when canvas is not ready', async () => {
    const scheduler = await createScheduler()
    const op = vi.fn()

    testState.canvasElement.offsetParent = null
    scheduler.schedule(op)
    scheduler.flush()

    expect(op).not.toHaveBeenCalled()
    expect(scheduler.pending()).toBe(1)
  })

  it('clear discards all pending operations and cancels RAF', async () => {
    const scheduler = await createScheduler()
    const op = vi.fn()

    scheduler.schedule(op)
    expect(testState.pendingFrames.size).toBe(1)

    scheduler.clear()

    expect(scheduler.pending()).toBe(0)
    expect(testState.cancelAnimationFrame).toHaveBeenCalledOnce()
    runNextAnimationFrame()
    expect(op).not.toHaveBeenCalled()
  })

  it('deduplicates RAF scheduling to one pending frame', async () => {
    const scheduler = await createScheduler()

    scheduler.schedule(vi.fn())
    scheduler.schedule(vi.fn())
    scheduler.schedule(vi.fn())

    expect(testState.pendingFrames.size).toBe(1)
  })

  it('executes operations in FIFO order', async () => {
    const scheduler = await createScheduler()
    const calls: string[] = []

    scheduler.schedule(() => calls.push('first'))
    scheduler.schedule(() => calls.push('second'))
    scheduler.schedule(() => calls.push('third'))

    runNextAnimationFrame()

    expect(calls).toEqual(['first', 'second', 'third'])
  })

  it('continues executing remaining ops when one throws', async () => {
    const scheduler = await createScheduler()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const first = vi.fn()
    const failing = vi.fn(() => {
      throw new Error('op failed')
    })
    const third = vi.fn()

    scheduler.schedule(first)
    scheduler.schedule(failing)
    scheduler.schedule(third)

    runNextAnimationFrame()

    expect(first).toHaveBeenCalledOnce()
    expect(failing).toHaveBeenCalledOnce()
    expect(third).toHaveBeenCalledOnce()
    expect(consoleSpy).toHaveBeenCalledOnce()
    consoleSpy.mockRestore()
  })

  it('auto-flushes queued ops when linearMode transitions to false', async () => {
    const scheduler = await createScheduler()
    const op = vi.fn()

    testState.canvasElement.offsetParent = null
    mockStore.linearMode = true
    await nextTick()

    scheduler.schedule(op)
    expect(scheduler.pending()).toBe(1)

    const framesBefore = testState.pendingFrames.size

    testState.canvasElement.offsetParent = document.body
    mockStore.linearMode = false
    await nextTick()

    expect(testState.pendingFrames.size).toBeGreaterThan(framesBefore)

    while (testState.pendingFrames.size > 0) runNextAnimationFrame()
    expect(op).toHaveBeenCalledOnce()
  })
})
