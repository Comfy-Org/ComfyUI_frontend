import { fromPartial } from '@total-typescript/shoehorn'
import type { BrowserContext, CDPSession, Page } from '@playwright/test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PerformanceHelper } from '@e2e/fixtures/helpers/PerformanceHelper'

describe('PerformanceHelper', () => {
  afterEach(() => {
    delete window.__perfFrameState
    delete (window as unknown as Record<string, unknown>).__perfLongtaskState
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
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(17)
    ;(window as unknown as Record<string, unknown>).__perfLongtaskState = {
      observer: { takeRecords: () => [] },
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
})
