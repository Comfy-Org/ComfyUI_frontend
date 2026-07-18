import { afterEach, describe, expect, test, vi } from 'vitest'

import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { startPriceBadgeFetch } from '@/services/priceBadgeService'

vi.mock('@/scripts/api', () => ({
  api: {
    getNodeDefs: vi.fn(),
    apiURL: vi.fn((path: string) => path),
    addEventListener: vi.fn(),
    getUserData: vi.fn(),
    storeUserData: vi.fn()
  }
}))

vi.mock('@/i18n', () => ({
  st: vi.fn((_key: string, fallback: string) => fallback),
  t: vi.fn((key: string) => key),
  te: vi.fn(() => false)
}))

vi.mock('@sentry/vue', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}))

vi.mock('@/config/comfyApi', () => ({
  getComfyApiBaseUrl: () => 'https://api.example.com'
}))

vi.mock('@/stores/systemStatsStore', () => ({
  useSystemStatsStore: () => ({
    isInitialized: true,
    error: null,
    systemStats: { system: { comfyui_version: '0.3.50' } }
  })
}))

// This case lives in its own file: the price badge fetch is a session
// singleton, so proving that a stalled fetch cannot delay getNodeDefs needs
// a module registry where no other test has already settled it. The
// resolved-fetch counterpart lives in app.getNodeDefs.test.ts.
describe('ComfyApp.getNodeDefs with pending pricing', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  test('pricing pending past its budget does not delay node defs', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise(() => {})) // stalls forever
    )
    const mockNodeDefs: Record<string, ComfyNodeDefV1> = {
      TestNode: {
        name: 'TestNode',
        display_name: 'Test Node',
        category: 'api node',
        description: '',
        input: {},
        output: [],
        output_node: false,
        python_module: 'test.module'
      }
    }
    vi.mocked(api.getNodeDefs).mockResolvedValue(mockNodeDefs)

    // Prefetch (as app.setup() does), then let the whole fetch budget
    // elapse while pricing stalls.
    startPriceBadgeFetch()
    await vi.advanceTimersByTimeAsync(3000)

    // Node defs must resolve without waiting on any new timer: with fake
    // timers a fresh race timer would never fire and this await would hang.
    const result = await comfyApp.getNodeDefs()

    expect(result.TestNode.price_badge).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })
})
