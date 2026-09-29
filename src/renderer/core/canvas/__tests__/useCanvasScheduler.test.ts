import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { createCanvasScheduler } from '@/renderer/core/canvas/useCanvasScheduler'

const testState = vi.hoisted(() => ({
  offsetParent: {} as Element | null,
  offsetWidth: 1920,
  offsetHeight: 1080,
  pendingFrames: new Map<number, FrameRequestCallback>(),
  nextFrameId: 1,
  cancelAnimationFrame: vi.fn()
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
    const canvasElement = document.createElement('canvas')
    Object.defineProperties(canvasElement, {
      offsetParent: { configurable: true, get: () => testState.offsetParent },
      offsetWidth: { configurable: true, get: () => testState.offsetWidth },
      offsetHeight: { configurable: true, get: () => testState.offsetHeight }
    })
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial<LGraphCanvas>({ canvas: canvasElement })
    canvasStore.linearMode = false
    testState.offsetParent = document.body
    testState.offsetWidth = 1920
    testState.offsetHeight = 1080
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
  })

  const createScheduler = createCanvasScheduler

  it('schedule executes operation in next RAF when canvas is ready', async () => {
    const scheduler = await createScheduler()
    const op = vi.fn()

    scheduler.schedule({ run: op })
    expect(op).not.toHaveBeenCalled()

    runNextAnimationFrame()
    expect(op).toHaveBeenCalledOnce()
  })

  it('schedule queues operation when canvas is not ready', async () => {
    const scheduler = await createScheduler()
    const op = vi.fn()

    testState.offsetParent = null
    scheduler.schedule({ run: op })

    expect(scheduler.pending()).toBe(1)
    expect(op).not.toHaveBeenCalled()
    expect(testState.pendingFrames.size).toBe(0)
  })

  it('schedule queues when canvas has zero dimensions', async () => {
    const scheduler = await createScheduler()
    const op = vi.fn()

    testState.offsetWidth = 0
    testState.offsetHeight = 0
    scheduler.schedule({ run: op })

    expect(scheduler.pending()).toBe(1)
    expect(op).not.toHaveBeenCalled()
    expect(testState.pendingFrames.size).toBe(0)
  })

  it('flush executes queued operations when canvas becomes ready', async () => {
    const scheduler = await createScheduler()
    const first = vi.fn()
    const second = vi.fn()

    testState.offsetParent = null
    scheduler.schedule({ run: first })
    scheduler.schedule({ run: second })

    testState.offsetParent = document.body
    scheduler.flush()

    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
    expect(scheduler.pending()).toBe(0)
  })

  it('flush executes queued operations after a zero-sized canvas is measured', async () => {
    const scheduler = await createScheduler()
    const op = vi.fn()

    testState.offsetWidth = 0
    scheduler.schedule({ run: op })

    testState.offsetWidth = 1920
    scheduler.flush()

    expect(op).toHaveBeenCalledOnce()
    expect(scheduler.pending()).toBe(0)
  })

  it('flush is a no-op when canvas is not ready', async () => {
    const scheduler = await createScheduler()
    const op = vi.fn()

    testState.offsetParent = null
    scheduler.schedule({ run: op })
    scheduler.flush()

    expect(op).not.toHaveBeenCalled()
    expect(scheduler.pending()).toBe(1)
  })

  it('clear discards all pending operations and cancels RAF', async () => {
    const scheduler = await createScheduler()
    const op = vi.fn()

    scheduler.schedule({ run: op })
    expect(testState.pendingFrames.size).toBe(1)

    scheduler.clear()

    expect(scheduler.pending()).toBe(0)
    expect(testState.cancelAnimationFrame).toHaveBeenCalledOnce()
    runNextAnimationFrame()
    expect(op).not.toHaveBeenCalled()
  })

  it('deduplicates RAF scheduling to one pending frame', async () => {
    const scheduler = await createScheduler()

    scheduler.schedule({ run: vi.fn() })
    scheduler.schedule({ run: vi.fn() })
    scheduler.schedule({ run: vi.fn() })

    expect(testState.pendingFrames.size).toBe(1)
  })

  it('executes operations in FIFO order', async () => {
    const scheduler = await createScheduler()
    const calls: string[] = []

    scheduler.schedule({ run: () => calls.push('first') })
    scheduler.schedule({ run: () => calls.push('second') })
    scheduler.schedule({ run: () => calls.push('third') })

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

    scheduler.schedule({ run: first })
    scheduler.schedule({ run: failing })
    scheduler.schedule({ run: third })

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

    testState.offsetParent = null
    useCanvasStore().linearMode = true
    await nextTick()

    scheduler.schedule({ run: op })
    expect(scheduler.pending()).toBe(1)

    const framesBefore = testState.pendingFrames.size

    testState.offsetParent = document.body
    useCanvasStore().linearMode = false
    await nextTick()

    expect(testState.pendingFrames.size).toBeGreaterThan(framesBefore)

    while (testState.pendingFrames.size > 0) runNextAnimationFrame()
    expect(op).toHaveBeenCalledOnce()
  })

  it('replaces a pending operation with the same key', async () => {
    const scheduler = await createScheduler()
    const stale = vi.fn()
    const current = vi.fn()

    scheduler.schedule({ key: 'camera', run: stale })
    scheduler.schedule({ key: 'camera', run: current })
    runNextAnimationFrame()

    expect(stale).not.toHaveBeenCalled()
    expect(current).toHaveBeenCalledOnce()
  })

  it('does not let a stale operation replace a current keyed operation', async () => {
    const scheduler = await createScheduler()
    const current = vi.fn()
    const stale = vi.fn()

    scheduler.schedule({ key: 'camera', run: current })
    scheduler.schedule({
      key: 'camera',
      isCurrent: () => false,
      run: stale
    })
    runNextAnimationFrame()

    expect(current).toHaveBeenCalledOnce()
    expect(stale).not.toHaveBeenCalled()
  })

  it('drops an operation that becomes stale before flush', async () => {
    const scheduler = await createScheduler()
    const run = vi.fn()
    let current = true

    scheduler.schedule({
      isCurrent: () => current,
      run
    })
    current = false
    runNextAnimationFrame()

    expect(run).not.toHaveBeenCalled()
  })
})
