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

function installSelfDrivingRaf(): () => void {
  const originalRequest = globalThis.requestAnimationFrame
  const originalCancel = globalThis.cancelAnimationFrame
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  let nextHandle = 1
  let timestampMs = 0

  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    const handle = nextHandle++
    timers.set(
      handle,
      setTimeout(() => {
        timers.delete(handle)
        timestampMs += 16.7
        callback(timestampMs)
      }, 0)
    )
    return handle
  }
  globalThis.cancelAnimationFrame = (handle: number) => {
    const timer = timers.get(handle)
    if (timer === undefined) return
    clearTimeout(timer)
    timers.delete(handle)
  }

  return () => {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    globalThis.requestAnimationFrame = originalRequest
    globalThis.cancelAnimationFrame = originalCancel
  }
}

async function waitForFrames(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
}

/**
 * Runs the real rAF collector page functions so the collector lifecycle under
 * test is the shipped one, and stubs the unrelated in-page probes.
 */
function createPage(send: (method: string) => Promise<unknown>): Page {
  const cdp = fromAny<CDPSession, unknown>({ send, detach: vi.fn() })
  const evaluate = async (fn: (arg?: unknown) => unknown, arg?: unknown) => {
    if (arg === RAF_STATE_KEY) return fn(arg)
    const source = String(fn)
    if (source.includes('new PerformanceObserver')) return undefined
    if (source.includes('takeRecords')) return 0
    if (source.includes('window.app')) {
      return {
        nodes: [],
        links: [],
        visibleNodes: 0,
        renderer: 'legacy',
        canvasInfoEnabled: null,
        viewportWidth: 1280,
        viewportHeight: 720,
        devicePixelRatio: 1,
        frontendVersion: 'test',
        frontendCommit: 'test',
        buildMode: 'test'
      }
    }
    return 'unknown'
  }
  return fromAny<Page, unknown>({
    context: () => ({
      newCDPSession: async () => cdp,
      browser: () => ({ version: () => 'test' })
    }),
    evaluate
  })
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
    const restoreRaf = installSelfDrivingRaf()
    try {
      const collectorArmedDuringGetMetrics: boolean[] = []
      const send = vi.fn(async (method: string) => {
        if (method !== 'Performance.getMetrics') return {}
        collectorArmedDuringGetMetrics.push(
          RAF_STATE_KEY in (window as unknown as Record<string, unknown>)
        )
        return { metrics: REQUIRED_METRICS.map((name) => ({ name, value: 0 })) }
      })
      const page = createPage(send)
      const helper = new PerformanceHelper(page)
      await helper.init()

      await helper.startMeasuring()
      await waitForFrames(3)
      const result = await helper.stopMeasuring('raf-window')

      expect(collectorArmedDuringGetMetrics).toEqual([false, false])
      expect(result.measurement.rafIntervalsMs.length).toBeGreaterThan(0)
      expect(
        RAF_STATE_KEY in (window as unknown as Record<string, unknown>)
      ).toBe(false)
    } finally {
      restoreRaf()
    }
  })
})
