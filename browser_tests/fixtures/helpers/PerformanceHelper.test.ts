import { fromPartial } from '@total-typescript/shoehorn'
import type { BrowserContext, CDPSession, Page } from '@playwright/test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PerformanceHelper } from '@e2e/fixtures/helpers/PerformanceHelper'

describe('PerformanceHelper', () => {
  afterEach(() => {
    delete window.__perfFrameState
    delete window.__perfLongtaskState
  })

  it('stops an active frame measurement before detaching CDP on dispose', async () => {
    const send = vi.fn(async () => ({ metrics: [] }))
    const detach = vi.fn(async () => {})
    const cdp = fromPartial<CDPSession>({ send, detach })
    const context = fromPartial<BrowserContext>({
      newCDPSession: vi.fn(async () => cdp)
    })
    const page = fromPartial<Page>({
      context: () => context,
      evaluate: vi.fn(async (callback: () => unknown) => callback()),
      isClosed: () => false
    })
    const cancelAnimationFrame = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => {})
    let frameRequestCount = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameRequestCount += 1
      if (frameRequestCount === 1 || frameRequestCount === 3) {
        const timestamp = frameRequestCount === 1 ? 100 : 116.7
        queueMicrotask(() => callback(timestamp))
      }
      return 17
    })
    window.__perfLongtaskState = {
      observer: fromPartial<PerformanceObserver>({ takeRecords: () => [] }),
      tbtMs: 0
    }

    const helper = new PerformanceHelper(page)
    await helper.init()
    await helper.startMeasuring()
    await helper.dispose()

    expect(cancelAnimationFrame).toHaveBeenCalledWith(17)
    expect(window.__perfFrameState).toBeUndefined()
    expect(send).toHaveBeenLastCalledWith('Performance.disable')
    expect(detach).toHaveBeenCalledOnce()
  })

  it('can retry after the initial animation frame times out', async () => {
    vi.useFakeTimers()
    const send = vi.fn(async () => ({ metrics: [] }))
    const cdp = fromPartial<CDPSession>({
      send,
      detach: vi.fn(async () => {})
    })
    const context = fromPartial<BrowserContext>({
      newCDPSession: vi.fn(async () => cdp)
    })
    const page = fromPartial<Page>({
      context: () => context,
      evaluate: vi.fn(async (callback: () => unknown) => callback()),
      isClosed: () => false
    })
    window.__perfLongtaskState = {
      observer: fromPartial<PerformanceObserver>({ takeRecords: () => [] }),
      tbtMs: 0
    }
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    let frameRequestCount = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameRequestCount += 1
      if (frameRequestCount === 2 || frameRequestCount === 4) {
        const timestamp = frameRequestCount === 2 ? 100 : 116.7
        queueMicrotask(() => callback(timestamp))
      }
      return frameRequestCount
    })

    const helper = new PerformanceHelper(page)
    await helper.init()
    const timedOutStart = helper.startMeasuring()
    void timedOutStart.catch(() => {})
    await vi.advanceTimersByTimeAsync(1_000)
    await expect(timedOutStart).rejects.toThrow(
      'Timed out waiting for the initial animation frame'
    )

    await helper.startMeasuring()
    await helper.stopMeasuring('retry')
    await helper.dispose()
  })
})
