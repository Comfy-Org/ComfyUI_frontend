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

// Valid badge with no dependencies: passes def validation on any node.
const emptyDependsBadge = {
  ...validBadge,
  depends_on: { widgets: [], inputs: [], input_groups: [] }
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

  it('applies matching badges, leaves other nodes untouched, ignores unknown ones', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse({ PartnerNode: validBadge, UnknownNode: validBadge })
    )
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    const existingBadge = {
      engine: 'jsonata',
      depends_on: { widgets: [], inputs: [], input_groups: [] },
      expr: '{"type":"usd","usd":9.99}'
    }
    defs['OtherNode'].price_badge =
      existingBadge as unknown as (typeof defs)['OtherNode']['price_badge']
    await applyPriceBadges(defs)
    // Present in the map: applied.
    expect(defs['PartnerNode'].price_badge).toMatchObject({
      expr: validBadge.expr
    })
    // Absent from the map: untouched, same object identity.
    expect(defs['OtherNode'].price_badge).toBe(existingBadge)
    // In the map but not in the defs: ignored without throwing.
  })

  it('requests the versioned endpoint, normalizing a trailing base slash', async () => {
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

  // The wire schema is declarative Zod; one representative per rejection
  // reason is enough at the service boundary.
  it.for([
    {
      case: 'a missing required field',
      badge: { expr: 'missing engine and depends_on' }
    },
    {
      case: 'an unknown engine',
      badge: { ...validBadge, engine: 'python' }
    },
    {
      // The wire schema is deliberately stricter than the canonical
      // zPriceBadge, which allows an empty expr.
      case: 'an empty expression',
      badge: { ...validBadge, expr: '' }
    }
  ])('skips a badge with $case, applying valid siblings', async ({ badge }) => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse({ PartnerNode: badge, OtherNode: emptyDependsBadge })
    )
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    await applyPriceBadges(defs)
    expect(defs['PartnerNode'].price_badge).toBeUndefined()
    expect(defs['OtherNode'].price_badge).toBeDefined()
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

  it.for([
    {
      case: 'has no matching def input',
      widget: { name: 'missing_widget', type: 'COMBO' }
    },
    {
      case: 'type mismatches the def input type',
      widget: { name: 'seed', type: 'STRING' }
    },
    {
      // /object_info is unvalidated; a non-string, non-array tuple head
      // must not crash the apply (fail open for this node only).
      case: 'def input spec is malformed',
      widget: { name: 'broken', type: 'INT' },
      brokenInput: true
    }
  ])(
    'skips a badge whose widget dependency $case',
    async ({ widget, brokenInput }) => {
      const badge = {
        ...validBadge,
        depends_on: { widgets: [widget], inputs: [], input_groups: [] }
      }
      vi.stubGlobal('fetch', mockFetchResponse({ PartnerNode: badge }))
      const { applyPriceBadges } = await importService()
      const defs = makeDefs()
      if (brokenInput) {
        ;(
          defs['PartnerNode'] as unknown as {
            input: { required: Record<string, unknown> }
          }
        ).input.required['broken'] = [42, {}]
      }
      await expect(applyPriceBadges(defs)).resolves.toBeUndefined()
      expect(defs['PartnerNode'].price_badge).toBeUndefined()
    }
  )

  describe('input and input_group dependency validation', () => {
    // Def with a plain combo (resolution), a plain INT (seed), a dynamic
    // combo (model), and a top-level autogrow group (videos).
    function makeDynamicDefs(): Record<string, ComfyNodeDef> {
      const defs = makeDefs()
      const required = (
        defs['PartnerNode'] as unknown as {
          input: { required: Record<string, unknown> }
        }
      ).input.required
      required['model'] = ['COMFY_DYNAMICCOMBO_V3', { options: [] }]
      required['videos'] = ['COMFY_AUTOGROW_V3', { template: {} }]
      return defs
    }

    it.for([
      {
        case: 'accepts an input matching a def key exactly',
        depends: { inputs: ['seed'] },
        applied: true
      },
      {
        case: 'rejects a dotted input whose parent is not a dynamic input',
        depends: { inputs: ['resolution.width'] },
        applied: false
      },
      {
        case: 'accepts a dotted input under a dynamic combo',
        depends: { inputs: ['model.style_reference'] },
        applied: true
      },
      {
        case: 'accepts a group matching a top-level autogrow def key',
        depends: { input_groups: ['videos'] },
        applied: true
      },
      {
        case: 'accepts a dotted group under a dynamic combo',
        depends: { input_groups: ['model.images'] },
        applied: true
      },
      {
        case: 'rejects a group with no matching def input',
        depends: { input_groups: ['missing_group'] },
        applied: false
      },
      {
        case: 'rejects a dotted group whose parent is not a dynamic input',
        depends: { input_groups: ['seed.videos'] },
        applied: false
      },
      {
        case: 'rejects a dotted widget whose parent is not a dynamic input',
        depends: { widgets: [{ name: 'resolution.width', type: 'INT' }] },
        applied: false
      },
      {
        case: 'accepts a dotted widget under a dynamic combo',
        depends: { widgets: [{ name: 'model.duration', type: 'COMBO' }] },
        applied: true
      }
    ])('$case', async ({ depends, applied }) => {
      const badge = {
        ...validBadge,
        depends_on: {
          widgets: [],
          inputs: [],
          input_groups: [],
          ...depends
        }
      }
      vi.stubGlobal('fetch', mockFetchResponse({ PartnerNode: badge }))
      const { applyPriceBadges } = await importService()
      const defs = makeDynamicDefs()
      await applyPriceBadges(defs)
      if (applied) {
        expect(defs['PartnerNode'].price_badge).toBeDefined()
      } else {
        expect(defs['PartnerNode'].price_badge).toBeUndefined()
      }
    })
  })

  it.for([
    {
      case: 'HTTP error',
      makeFetch: () => mockFetchResponse(null, false, 500)
    },
    {
      case: 'network error',
      makeFetch: () => vi.fn().mockRejectedValue(new Error('offline'))
    },
    {
      case: 'invalid top-level body',
      makeFetch: () => mockFetchResponse(['not', 'a', 'map'])
    }
  ])('fails open on $case', async ({ makeFetch }) => {
    vi.stubGlobal('fetch', makeFetch())
    const { applyPriceBadges } = await importService()
    const defs = makeDefs()
    await expect(applyPriceBadges(defs)).resolves.toBeUndefined()
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
    // The deadline is anchored at the prefetch, so both apply calls' timers
    // fire at 2500ms and mark the session lost.
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

  it('measures the race deadline from the prefetch, not from apply', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise(() => {})) // never settles
    )
    const { applyPriceBadges, startPriceBadgeFetch } = await importService()
    startPriceBadgeFetch()
    await vi.advanceTimersByTimeAsync(3000)
    const defs = makeDefs()
    // The budget is already spent: apply must return without waiting on a
    // fresh timer.
    await applyPriceBadges(defs)
    expect(defs['PartnerNode'].price_badge).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('applies a result that settled before apply, even past the deadline', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', mockFetchResponse({ PartnerNode: validBadge }))
    const { applyPriceBadges, startPriceBadgeFetch } = await importService()
    startPriceBadgeFetch()
    await vi.advanceTimersByTimeAsync(10_000)
    const defs = makeDefs()
    await applyPriceBadges(defs)
    expect(defs['PartnerNode'].price_badge).toMatchObject({
      expr: validBadge.expr
    })
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
