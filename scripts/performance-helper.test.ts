import type { CDPSession, Page } from '@playwright/test'
import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { PerformanceHelper } from '../browser_tests/fixtures/helpers/PerformanceHelper'

const RAF_STATE_KEY = '__perfRafCollectorState'

const REQUIRED_METRICS = [
  'RecalcStyleCount',
  'RecalcStyleDuration',
  'LayoutCount',
  'LayoutDuration',
  'TaskDuration',
  'JSHeapUsedSize',
  'Timestamp',
  'Nodes',
  'JSHeapTotalSize',
  'ScriptDuration',
  'JSEventListeners'
]

function installControlledRaf() {
  const callbacks = new Map<number, FrameRequestCallback>()
  let nextHandle = 1
  const createDeferred = () => {
    let resolve: () => void = () => {
      throw new Error('Deferred promise was not initialized')
    }
    const promise = new Promise<void>((resolvePromise) => {
      resolve = resolvePromise
    })
    return { promise, resolve }
  }
  let requested = createDeferred()

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const handle = nextHandle++
    callbacks.set(handle, callback)
    requested.resolve()
    return handle
  })
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
    callbacks.delete(handle)
  })

  return {
    waitUntilRequested: () => requested.promise,
    async runNext(timestamp: number) {
      if (callbacks.size === 0) await requested.promise
      const entry = callbacks.entries().next().value
      if (!entry) throw new Error('Expected a queued animation frame')
      const [handle, callback] = entry
      callbacks.delete(handle)
      requested = createDeferred()
      callback(timestamp)
    }
  }
}

function createPage(send: (method: string) => Promise<unknown>): Page {
  const cdp = fromAny<CDPSession, unknown>({ send, detach: vi.fn() })
  const evaluate = async (fn: (arg?: unknown) => unknown, arg?: unknown) =>
    fn(arg)
  return fromAny<Page, unknown>({
    context: () => ({
      newCDPSession: async () => cdp,
      browser: () => ({ version: () => 'test' })
    }),
    evaluate
  })
}

function installPageGlobals() {
  delete window.__perfLongtaskState
  delete window.__perfRafCollectorState
  const observer = {
    disconnect: vi.fn(),
    observe: vi.fn(),
    takeRecords: vi.fn(() => [])
  }
  class PerformanceObserverStub {
    disconnect = observer.disconnect
    observe = observer.observe
    takeRecords = observer.takeRecords
  }
  vi.stubGlobal('PerformanceObserver', PerformanceObserverStub)
  Object.defineProperty(window, 'app', {
    configurable: true,
    value: fromAny({
      canvas: { graph: null, visible_nodes: [] },
      graph: { links: new Map(), nodes: [] },
      extensionManager: { setting: { get: () => undefined } }
    })
  })
  window.__COMFYUI_FRONTEND_VERSION__ = 'test'
  window.__COMFYUI_FRONTEND_COMMIT__ = 'test'
  window.__COMFYUI_BUILD_MODE__ = 'test'
  return observer
}

describe('PerformanceHelper', () => {
  it('preserves a startup error when collector cleanup also fails', async () => {
    const startupError = new Error('collector startup failed')
    const cleanupError = new Error('collector cleanup failed')
    let cleanupAttempted = false
    const send = vi.fn(async (method: string) =>
      method === 'Performance.getMetrics'
        ? {
            metrics: REQUIRED_METRICS.map((name) => ({ name, value: 0 }))
          }
        : {}
    )
    const cdp = fromAny<CDPSession, unknown>({
      send,
      detach: vi.fn()
    })
    const evaluate = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(startupError)
      .mockImplementationOnce(() => {
        cleanupAttempted = true
        throw cleanupError
      })
    const page = fromAny<Page, unknown>({
      context: () => ({
        newCDPSession: async () => cdp,
        browser: () => ({ version: () => 'test' })
      }),
      evaluate
    })
    const helper = new PerformanceHelper(page)
    await helper.init()

    await expect(helper.startMeasuring()).rejects.toBe(startupError)
    expect(cleanupAttempted).toBe(true)
  })

  it('issues no CDP metrics call while the rAF collector is armed', async () => {
    installPageGlobals()
    const raf = installControlledRaf()
    const collectorArmedDuringGetMetrics: boolean[] = []
    const send = vi.fn(async (method: string) => {
      if (method !== 'Performance.getMetrics') return {}
      collectorArmedDuringGetMetrics.push(RAF_STATE_KEY in window)
      return { metrics: REQUIRED_METRICS.map((name) => ({ name, value: 0 })) }
    })
    const page = createPage(send)
    const helper = new PerformanceHelper(page)
    await helper.init()

    const start = helper.startMeasuring()
    await raf.runNext(0)
    await start
    await raf.runNext(16.7)
    await raf.runNext(33.4)
    const stop = helper.stopMeasuring('raf-window')
    await raf.runNext(50.1)
    const result = await stop

    expect(collectorArmedDuringGetMetrics).toEqual([false, false])
    expect(result.measurement.rafIntervalsMs.length).toBeGreaterThan(0)
    expect(RAF_STATE_KEY in window).toBe(false)
  })

  it('rejects a collector that misses its start boundary', async () => {
    vi.useFakeTimers()
    try {
      installPageGlobals()
      const raf = installControlledRaf()
      const page = createPage(async (method) =>
        method === 'Performance.getMetrics'
          ? {
              metrics: REQUIRED_METRICS.map((name) => ({ name, value: 0 }))
            }
          : {}
      )
      const helper = new PerformanceHelper(page)
      await helper.init()

      const start = helper.startMeasuring()
      await raf.waitUntilRequested()
      await vi.advanceTimersByTimeAsync(1_000)
      await start
      const stop = helper.stopMeasuring('missed-start-boundary')
      await raf.runNext(16.7)

      await expect(stop).resolves.toMatchObject({
        kind: 'rejected',
        reason: expect.stringContaining('rAF start boundary timed out')
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns a rejected result when closing collection fails', async () => {
    installPageGlobals()
    const raf = installControlledRaf()
    let snapshotCount = 0
    const page = createPage(async (method) => {
      if (method !== 'Performance.getMetrics') return {}
      snapshotCount++
      if (snapshotCount === 2) throw new Error('CDP session closed')
      return { metrics: REQUIRED_METRICS.map((name) => ({ name, value: 0 })) }
    })
    const helper = new PerformanceHelper(page)
    await helper.init()

    const start = helper.startMeasuring()
    await raf.runNext(0)
    await start
    await raf.runNext(16.7)
    const stop = helper.stopMeasuring('closing-failure')
    await raf.runNext(33.4)

    await expect(stop).resolves.toMatchObject({
      kind: 'rejected',
      reason: expect.stringContaining(
        'closing CDP snapshot failed: CDP session closed'
      )
    })
  })

  it('rejects reset cumulative CDP counters', async () => {
    installPageGlobals()
    const raf = installControlledRaf()
    let snapshotCount = 0
    const page = createPage(async (method) => {
      if (method !== 'Performance.getMetrics') return {}
      snapshotCount++
      return {
        metrics: REQUIRED_METRICS.map((name) => ({
          name,
          value:
            name === 'RecalcStyleCount' && snapshotCount === 2
              ? 0
              : snapshotCount
        }))
      }
    })
    const helper = new PerformanceHelper(page)
    await helper.init()

    const start = helper.startMeasuring()
    await raf.runNext(0)
    await start
    await raf.runNext(16.7)
    const stop = helper.stopMeasuring('reset-counter')
    await raf.runNext(33.4)

    await expect(stop).resolves.toMatchObject({
      kind: 'rejected',
      reason: expect.stringContaining(
        'non-monotonic CDP metric: RecalcStyleCount'
      )
    })
  })

  it('disconnects the long-task observer on disposal', async () => {
    const observer = installPageGlobals()
    const raf = installControlledRaf()
    const page = createPage(async (method) =>
      method === 'Performance.getMetrics'
        ? { metrics: REQUIRED_METRICS.map((name) => ({ name, value: 0 })) }
        : {}
    )
    const helper = new PerformanceHelper(page)
    await helper.init()
    const start = helper.startMeasuring()
    await raf.runNext(0)
    await start

    const dispose = helper.dispose()
    await raf.runNext(16.7)
    await dispose

    expect(observer.disconnect).toHaveBeenCalledOnce()
  })
})
