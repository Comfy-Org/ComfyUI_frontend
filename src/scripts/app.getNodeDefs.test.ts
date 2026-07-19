import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { st } from '@/i18n'
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

// getNodeDefs triggers the price badge fetch chain; keep it off the network.
// Badge assertions live in app.getNodeDefs.priceBadges.test.ts and
// app.getNodeDefs.pendingPricing.test.ts, each in its own file because the
// badge fetch is a session singleton settled by the first getNodeDefs() call.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({})
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ComfyApp.getNodeDefs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should use object info display_name when available', async () => {
    const mockNodeDefs: Record<string, ComfyNodeDefV1> = {
      TestNode: {
        name: 'TestNode',
        display_name: 'Custom Display Name',
        category: 'test',
        description: 'Test description',
        input: {},
        output: [],
        output_node: false,
        python_module: 'test.module'
      }
    }

    vi.mocked(api.getNodeDefs).mockResolvedValue(mockNodeDefs)

    const result = await comfyApp.getNodeDefs()

    expect(result.TestNode.display_name).toBe('Custom Display Name')
  })

  test('should fall back to name when display_name is missing', async () => {
    const mockNodeDefs: Record<string, ComfyNodeDefV1> = {
      TestNode: {
        name: 'TestNode',
        display_name: '',
        category: 'test',
        description: 'Test description',
        input: {},
        output: [],
        output_node: false,
        python_module: 'test.module'
      }
    }

    vi.mocked(api.getNodeDefs).mockResolvedValue(mockNodeDefs)

    const result = await comfyApp.getNodeDefs()

    expect(result.TestNode.display_name).toBe('TestNode')
  })

  test('should prioritize translation over object info display_name', async () => {
    const mockNodeDefs: Record<string, ComfyNodeDefV1> = {
      TestNode: {
        name: 'TestNode',
        display_name: 'Object Info Display Name',
        category: 'test',
        description: 'Test description',
        input: {},
        output: [],
        output_node: false,
        python_module: 'test.module'
      }
    }

    vi.mocked(api.getNodeDefs).mockResolvedValue(mockNodeDefs)
    vi.mocked(st).mockReturnValue('Translated Display Name')

    const result = await comfyApp.getNodeDefs()

    expect(result.TestNode.display_name).toBe('Translated Display Name')
  })
})
