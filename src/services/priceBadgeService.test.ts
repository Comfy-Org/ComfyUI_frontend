import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

const mockApiBase = vi.hoisted(() => ({ url: 'https://api.example.com' }))

const mockSystemStatsStore = vi.hoisted(() => ({
  isInitialized: true,
  error: null as Error | null,
  systemStats: {
    system: { comfyui_version: '0.3.50' }
  } as {
    system: { comfyui_version?: string; argv?: string[] }
  } | null
}))

vi.mock('@sentry/vue', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}))

vi.mock('@/config/comfyApi', () => ({
  getComfyApiBaseUrl: () => mockApiBase.url
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
    mockApiBase.url = 'https://api.example.com'
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

  it('applies a valid badge to a matching def', async () => {
    vi.stubGlobal('fetch', mockFetchResponse({ PartnerNode: validBadge }))
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    await applyPriceBadges(defs)
    expect(defs['PartnerNode'].price_badge).toMatchObject({
      expr: validBadge.expr
    })
    expect(defs['OtherNode'].price_badge).toBeUndefined()
  })

  it('requests with comfyui_version and platform query params', async () => {
    const fetchMock = mockFetchResponse({})
    vi.stubGlobal('fetch', fetchMock)
    const { applyPriceBadges } = await importService()
    await applyPriceBadges(makeDefs())
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/nodes/pricing/badges?comfyui_version=0.3.50&platform=local'
    )
  })

  it('normalizes a trailing slash on the API base URL', async () => {
    mockApiBase.url = 'https://api.example.com/'
    const fetchMock = mockFetchResponse({})
    vi.stubGlobal('fetch', fetchMock)
    const { applyPriceBadges } = await importService()
    await applyPriceBadges(makeDefs())
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/nodes/pricing/badges?comfyui_version=0.3.50&platform=local'
    )
  })

  it('never fetches when --disable-api-nodes is among the server args', async () => {
    mockSystemStatsStore.systemStats = {
      system: {
        comfyui_version: '0.3.50',
        argv: ['main.py', '--disable-api-nodes', '--listen']
      }
    }
    const fetchMock = mockFetchResponse({ PartnerNode: validBadge })
    vi.stubGlobal('fetch', fetchMock)
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    await applyPriceBadges(defs)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(defs['PartnerNode'].price_badge).toBeUndefined()
  })

  it('falls back to nightly when the version is unavailable', async () => {
    mockSystemStatsStore.systemStats = null
    const fetchMock = mockFetchResponse({})
    vi.stubGlobal('fetch', fetchMock)
    const { applyPriceBadges } = await importService()
    await applyPriceBadges(makeDefs())
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('comfyui_version=nightly')
    )
  })

  it('preserves an existing baked-in badge on nodes absent from the map', async () => {
    vi.stubGlobal('fetch', mockFetchResponse({ PartnerNode: validBadge }))
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    const bakedIn = {
      engine: 'jsonata',
      depends_on: { widgets: [], inputs: [], input_groups: [] },
      expr: '{"type":"usd","usd":9.99}'
    }
    defs['OtherNode'].price_badge =
      bakedIn as unknown as (typeof defs)['OtherNode']['price_badge']
    await applyPriceBadges(defs)
    // Absent from the map: untouched, same object identity.
    expect(defs['OtherNode'].price_badge).toBe(bakedIn)
    // Present in the map: replaced.
    expect(defs['PartnerNode'].price_badge).toMatchObject({
      expr: validBadge.expr
    })
  })

  it('skips only the malformed badge, applying valid siblings', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse({
        PartnerNode: validBadge,
        OtherNode: { expr: 'missing engine and depends_on' }
      })
    )
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    await applyPriceBadges(defs)
    expect(defs['PartnerNode'].price_badge).toBeDefined()
    expect(defs['OtherNode'].price_badge).toBeUndefined()
  })

  it.for([
    ['engine', () => ({ ...validBadge, engine: undefined })],
    ['depends_on', () => ({ ...validBadge, depends_on: undefined })],
    ['expr', () => ({ ...validBadge, expr: undefined })],
    [
      'depends_on.widgets',
      () => ({
        ...validBadge,
        depends_on: { inputs: [], input_groups: [] }
      })
    ],
    [
      'depends_on.inputs',
      () => ({
        ...validBadge,
        depends_on: { widgets: validBadge.depends_on.widgets, input_groups: [] }
      })
    ],
    [
      'depends_on.input_groups',
      () => ({
        ...validBadge,
        depends_on: { widgets: validBadge.depends_on.widgets, inputs: [] }
      })
    ]
  ] as const)(
    'rejects a badge missing required field %s, applying valid siblings',
    async ([, makeBadge]) => {
      vi.stubGlobal(
        'fetch',
        mockFetchResponse({
          PartnerNode: makeBadge(),
          OtherNode: {
            ...validBadge,
            depends_on: { widgets: [], inputs: [], input_groups: [] }
          }
        })
      )
      const { applyPriceBadges } = await importService()
      const defs = makeDefs()
      await applyPriceBadges(defs)
      expect(defs['PartnerNode'].price_badge).toBeUndefined()
      expect(defs['OtherNode'].price_badge).toBeDefined()
    }
  )

  it.for([
    ['null', null],
    ['array', [validBadge]],
    ['string', 'nope']
  ] as const)('fails open when the response body is %s', async ([, body]) => {
    vi.stubGlobal('fetch', mockFetchResponse(body))
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    await expect(applyPriceBadges(defs)).resolves.toBeUndefined()
    expect(defs['PartnerNode'].price_badge).toBeUndefined()
  })

  it('skips a badge whose def input spec is malformed, without throwing', async () => {
    const badge = {
      ...validBadge,
      depends_on: {
        widgets: [{ name: 'broken', type: 'INT' }],
        inputs: [],
        input_groups: []
      }
    }
    vi.stubGlobal('fetch', mockFetchResponse({ PartnerNode: badge }))
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    // /object_info is unvalidated; a non-string, non-array tuple head must not
    // crash the apply (fail open for this node only).
    ;(
      defs['PartnerNode'] as unknown as {
        input: { required: Record<string, unknown> }
      }
    ).input.required['broken'] = [42, {}]
    await expect(applyPriceBadges(defs)).resolves.toBeUndefined()
    expect(defs['PartnerNode'].price_badge).toBeUndefined()
  })

  it('skips a badge with an unknown engine', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse({ PartnerNode: { ...validBadge, engine: 'python' } })
    )
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    await applyPriceBadges(defs)
    expect(defs['PartnerNode'].price_badge).toBeUndefined()
  })

  it('honors a widgetType override on the def input spec', async () => {
    const badge = {
      ...validBadge,
      depends_on: {
        widgets: [{ name: 'strength', type: 'STRING' }],
        inputs: [],
        input_groups: []
      }
    }
    vi.stubGlobal('fetch', mockFetchResponse({ PartnerNode: badge }))
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    // Socket type INT, but the runtime widget (and core's serialized badge
    // dependency type) is the widgetType override.
    ;(
      defs['PartnerNode'] as unknown as {
        input: { required: Record<string, unknown> }
      }
    ).input.required['strength'] = ['INT', { widgetType: 'STRING' }]
    await applyPriceBadges(defs)
    expect(defs['PartnerNode'].price_badge).toBeDefined()
  })

  it('ignores badges for nodes missing from the defs', async () => {
    vi.stubGlobal('fetch', mockFetchResponse({ UnknownNode: validBadge }))
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    await applyPriceBadges(defs)
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
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    await applyPriceBadges(defs)
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
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    await applyPriceBadges(defs)
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
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    await applyPriceBadges(defs)
    expect(defs['PartnerNode'].price_badge).toBeDefined()
  })

  it('fails open on HTTP error', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(null, false, 500))
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    await expect(applyPriceBadges(defs)).resolves.toBeUndefined()
    expect(defs['PartnerNode'].price_badge).toBeUndefined()
  })

  it('fails open on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    await expect(applyPriceBadges(defs)).resolves.toBeUndefined()
    expect(defs['PartnerNode'].price_badge).toBeUndefined()
  })

  it('fails open when the response does not match the schema', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse({ PartnerNode: { engine: 'python', expr: 42 } })
    )
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    await applyPriceBadges(defs)
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
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    const applying = applyPriceBadges(defs)
    await vi.advanceTimersByTimeAsync(3000)
    await applying
    expect(defs['PartnerNode'].price_badge).toBeUndefined()

    // Late arrival must not apply on a later apply call either.
    resolveFetch({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ PartnerNode: validBadge })
    })
    const defs2 = makeDefs()
    await applyPriceBadges(defs2)
    expect(defs2['PartnerNode'].price_badge).toBeUndefined()
  })

  it('never applies badges on a concurrent apply call once the session lost the race', async () => {
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
    const { applyPriceBadges } = await importService()
    const defs1 = makeDefs()
    const defs2 = makeDefs()
    const apply1 = applyPriceBadges(defs1)
    await vi.advanceTimersByTimeAsync(1000)
    const apply2 = applyPriceBadges(defs2)
    // apply1's timer fires at 2500ms and marks the session lost;
    // apply2's timer would fire at 3500ms.
    await vi.advanceTimersByTimeAsync(1600)
    await apply1
    // The fetch resolves after the session is lost but before apply2's
    // timeout: apply2 must still not apply.
    resolveFetch({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ PartnerNode: validBadge })
    })
    await apply2
    expect(defs1['PartnerNode'].price_badge).toBeUndefined()
    expect(defs2['PartnerNode'].price_badge).toBeUndefined()
  })

  it('reuses the same fetch across apply calls', async () => {
    const fetchMock = mockFetchResponse({ PartnerNode: validBadge })
    vi.stubGlobal('fetch', fetchMock)
    const { applyPriceBadges, startPriceBadgeFetch } = await importService()
    startPriceBadgeFetch()
    await applyPriceBadges(makeDefs())
    await applyPriceBadges(makeDefs())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
