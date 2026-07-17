import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

const mockSystemStatsStore = vi.hoisted(() => ({
  isInitialized: true,
  error: null as Error | null,
  systemStats: {
    system: { comfyui_version: '0.3.50' }
  } as { system: { comfyui_version?: string } } | null
}))

vi.mock('@sentry/vue', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}))

vi.mock('@/config/comfyApi', () => ({
  getComfyApiBaseUrl: () => 'https://api.example.com'
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/stores/systemStatsStore', () => ({
  useSystemStatsStore: () => mockSystemStatsStore
}))

const validBadge = {
  engine: 'jsonata',
  depends_on: {
    widgets: [{ name: 'resolution', type: 'COMBO' }],
    inputs: [],
    input_groups: []
  },
  expr: '{"type":"usd","usd":0.1}'
}

function makeDefs(): Record<string, ComfyNodeDef> {
  return {
    PartnerNode: {
      name: 'PartnerNode',
      display_name: 'Partner Node',
      description: '',
      category: 'api node',
      output_node: false,
      python_module: 'nodes',
      input: {
        required: {
          resolution: [['1080p', '720p'], {}],
          seed: ['INT', {}]
        }
      }
    } as unknown as ComfyNodeDef,
    OtherNode: {
      name: 'OtherNode',
      display_name: 'Other Node',
      description: '',
      category: 'other',
      output_node: false,
      python_module: 'nodes',
      input: { required: {} }
    } as unknown as ComfyNodeDef
  }
}

function mockFetchResponse(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body)
  })
}

async function importService() {
  return await import('@/services/priceBadgeService')
}

describe('priceBadgeService', () => {
  beforeEach(() => {
    vi.resetModules()
    mockSystemStatsStore.isInitialized = true
    mockSystemStatsStore.error = null
    mockSystemStatsStore.systemStats = {
      system: { comfyui_version: '0.3.50' }
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('overlays a valid badge onto a matching def', async () => {
    vi.stubGlobal('fetch', mockFetchResponse({ PartnerNode: validBadge }))
    const { overlayPriceBadges } = await importService()
    const defs = makeDefs()
    await overlayPriceBadges(defs)
    expect(defs['PartnerNode'].price_badge).toMatchObject({
      expr: validBadge.expr
    })
    expect(defs['OtherNode'].price_badge).toBeUndefined()
  })

  it('requests with comfyui_version and platform query params', async () => {
    const fetchMock = mockFetchResponse({})
    vi.stubGlobal('fetch', fetchMock)
    const { overlayPriceBadges } = await importService()
    await overlayPriceBadges(makeDefs())
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/nodes/pricing/badges?comfyui_version=0.3.50&platform=local'
    )
  })

  it('falls back to nightly when the version is unavailable', async () => {
    mockSystemStatsStore.systemStats = null
    const fetchMock = mockFetchResponse({})
    vi.stubGlobal('fetch', fetchMock)
    const { overlayPriceBadges } = await importService()
    await overlayPriceBadges(makeDefs())
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('comfyui_version=nightly')
    )
  })

  it('ignores badges for nodes missing from the defs', async () => {
    vi.stubGlobal('fetch', mockFetchResponse({ UnknownNode: validBadge }))
    const { overlayPriceBadges } = await importService()
    const defs = makeDefs()
    await overlayPriceBadges(defs)
    expect(defs['PartnerNode'].price_badge).toBeUndefined()
  })

  it('skips a badge whose widget dependency has no matching def input', async () => {
    const badBadge = {
      ...validBadge,
      depends_on: {
        widgets: [{ name: 'missing_widget', type: 'COMBO' }],
        inputs: [],
        input_groups: []
      }
    }
    vi.stubGlobal('fetch', mockFetchResponse({ PartnerNode: badBadge }))
    const { overlayPriceBadges } = await importService()
    const defs = makeDefs()
    await overlayPriceBadges(defs)
    expect(defs['PartnerNode'].price_badge).toBeUndefined()
  })

  it('skips a badge whose widget type mismatches the def input type', async () => {
    const badBadge = {
      ...validBadge,
      depends_on: {
        widgets: [{ name: 'seed', type: 'STRING' }],
        inputs: [],
        input_groups: []
      }
    }
    vi.stubGlobal('fetch', mockFetchResponse({ PartnerNode: badBadge }))
    const { overlayPriceBadges } = await importService()
    const defs = makeDefs()
    await overlayPriceBadges(defs)
    expect(defs['PartnerNode'].price_badge).toBeUndefined()
  })

  it('validates dotted dependencies against the first segment', async () => {
    const badge = {
      ...validBadge,
      depends_on: {
        widgets: [],
        inputs: ['resolution.width'],
        input_groups: []
      }
    }
    vi.stubGlobal('fetch', mockFetchResponse({ PartnerNode: badge }))
    const { overlayPriceBadges } = await importService()
    const defs = makeDefs()
    await overlayPriceBadges(defs)
    expect(defs['PartnerNode'].price_badge).toBeDefined()
  })

  it('fails open on HTTP error', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(null, false, 500))
    const { overlayPriceBadges } = await importService()
    const defs = makeDefs()
    await expect(overlayPriceBadges(defs)).resolves.toBeUndefined()
    expect(defs['PartnerNode'].price_badge).toBeUndefined()
  })

  it('fails open on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { overlayPriceBadges } = await importService()
    const defs = makeDefs()
    await expect(overlayPriceBadges(defs)).resolves.toBeUndefined()
    expect(defs['PartnerNode'].price_badge).toBeUndefined()
  })

  it('fails open when the response does not match the schema', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse({ PartnerNode: { engine: 'python', expr: 42 } })
    )
    const { overlayPriceBadges } = await importService()
    const defs = makeDefs()
    await overlayPriceBadges(defs)
    expect(defs['PartnerNode'].price_badge).toBeUndefined()
  })

  it('drops the result for the whole session when the fetch loses the race', async () => {
    vi.useFakeTimers()
    let resolveFetch!: (value: unknown) => void
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve
        })
      )
    )
    const { overlayPriceBadges } = await importService()
    const defs = makeDefs()
    const overlay = overlayPriceBadges(defs)
    await vi.advanceTimersByTimeAsync(3000)
    await overlay
    expect(defs['PartnerNode'].price_badge).toBeUndefined()

    // Late arrival must not apply on a later overlay call either.
    resolveFetch({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ PartnerNode: validBadge })
    })
    const defs2 = makeDefs()
    await overlayPriceBadges(defs2)
    expect(defs2['PartnerNode'].price_badge).toBeUndefined()
  })

  it('reuses the same fetch across overlay calls', async () => {
    const fetchMock = mockFetchResponse({ PartnerNode: validBadge })
    vi.stubGlobal('fetch', fetchMock)
    const { overlayPriceBadges, startPriceBadgeFetch } = await importService()
    startPriceBadgeFetch()
    await overlayPriceBadges(makeDefs())
    await overlayPriceBadges(makeDefs())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
