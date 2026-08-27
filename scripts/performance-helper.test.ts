import type { CDPSession, Page } from '@playwright/test'
import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { PerformanceHelper } from '../browser_tests/fixtures/helpers/PerformanceHelper'

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
})
