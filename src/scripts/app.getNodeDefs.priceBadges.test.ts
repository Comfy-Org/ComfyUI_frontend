import { afterEach, describe, expect, test, vi } from 'vitest'

import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'

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
// singleton settled by the first getNodeDefs() call, so asserting on a
// resolved badge map needs a module registry where no other test has
// already settled it. The pending-fetch counterpart lives in
// app.getNodeDefs.pendingPricing.test.ts.
describe('ComfyApp.getNodeDefs price badges', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returned defs carry the remotely fetched price badge', async () => {
    const priceBadge = {
      engine: 'jsonata',
      depends_on: {
        widgets: [{ name: 'resolution', type: 'COMBO' }],
        inputs: [],
        input_groups: []
      },
      expr: '{"type":"usd","usd":0.1}'
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ PricedNode: priceBadge })
      })
    )
    const mockNodeDefs: Record<string, ComfyNodeDefV1> = {
      PricedNode: {
        name: 'PricedNode',
        display_name: 'Priced Node',
        category: 'api node',
        description: '',
        input: { required: { resolution: [['1080p', '720p'], {}] } },
        output: [],
        output_node: false,
        python_module: 'test.module'
      } as unknown as ComfyNodeDefV1
    }
    vi.mocked(api.getNodeDefs).mockResolvedValue(mockNodeDefs)

    const result = await comfyApp.getNodeDefs()

    expect(result.PricedNode.price_badge).toMatchObject({
      expr: priceBadge.expr
    })
  })
})
