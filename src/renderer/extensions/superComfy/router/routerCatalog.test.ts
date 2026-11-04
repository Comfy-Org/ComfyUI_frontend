import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import type {
  CatalogListOutcome,
  RouterListEntry,
  SchemaOutcome
} from '@/renderer/extensions/superComfy/router/routerCatalog'
import {
  createCatalogIndex,
  resolveModelContract
} from '@/renderer/extensions/superComfy/router/routerCatalog'
import {
  ROUTER_FIXTURES,
  fixtureDoc
} from '@/renderer/extensions/superComfy/router/fixtures/routerFixtures'
import type { OpenApiDoc } from '@/renderer/extensions/superComfy/router/routerTypes'
import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('firebase/auth'), { spy: true })

const PUBLISHED: Record<string, OpenApiDoc> = {
  'bfl/flux-2-pro': fixtureDoc('bfl/flux-2-pro'),
  'openai/gpt-image-2': fixtureDoc('openai/gpt-image-2'),
  'fal/fal-gpt-image-2': {
    ...fixtureDoc('openai/gpt-image-2'),
    'x-comfy-input-schema-authored': false
  },
  'meshy/rigging': fixtureDoc('meshy/rigging'),
  'meshy/meshy-7.1': fixtureDoc('meshy/meshy-7.1'),
  'veo/veo-3.1-generate-001': fixtureDoc('veo/veo-3.1-generate-001'),
  'openrouter/chat-completions': fixtureDoc('openai/gpt-5-mini')
}

function entry(id: string, etag: string | null = 'etag-1'): RouterListEntry {
  const [provider, model] = id.split('/')
  return { id, provider, model, etag }
}

function listed(models: RouterListEntry[]) {
  return vi.fn(async (): Promise<CatalogListOutcome> => ({ ok: true, models }))
}

function deferredSchema() {
  let settle: (outcome: SchemaOutcome) => void = () => {}
  const promise = new Promise<SchemaOutcome>((resolve) => {
    settle = resolve
  })
  return { promise, resolve: (outcome: SchemaOutcome) => settle(outcome) }
}

function published() {
  return vi.fn(async (id: string): Promise<SchemaOutcome> =>
    Object.hasOwn(PUBLISHED, id)
      ? { ok: true, doc: PUBLISHED[id] }
      : { ok: false, message: 'Not Found' }
  )
}

describe('createCatalogIndex', () => {
  it('lists the supported models of a modality and counts unsupported shapes', async () => {
    const fetchSchema = published()
    const index = createCatalogIndex({
      listModels: listed(Object.keys(PUBLISHED).map((id) => entry(id))),
      fetchSchema,
      summaries: ref({}),
      now: () => 0
    })

    const image = index.catalog('image')
    const threeD = index.catalog('3d')
    await index.refresh()

    expect(image.value).toEqual({
      status: 'ready',
      models: [
        { id: 'bfl/flux-2-pro', label: 'flux-2-pro', provider: 'bfl' },
        { id: 'openai/gpt-image-2', label: 'gpt-image-2', provider: 'openai' }
      ],
      unsupported: 0
    })
    expect(threeD.value).toEqual({
      status: 'ready',
      models: [
        { id: 'meshy/meshy-7.1', label: 'meshy-7.1', provider: 'meshy' }
      ],
      unsupported: 1
    })
    expect(fetchSchema).not.toHaveBeenCalledWith('openrouter/chat-completions')
  })

  it.for([
    {
      name: 'reuses a stored summary while the etag is unchanged',
      stored: {
        'bfl/flux-2-pro': {
          id: 'bfl/flux-2-pro',
          etag: 'etag-1',
          primary: 'image',
          status: 'supported'
        }
      },
      fetches: 0
    },
    {
      name: 'refetches a schema whose etag changed',
      stored: {
        'bfl/flux-2-pro': {
          id: 'bfl/flux-2-pro',
          etag: 'etag-0',
          primary: 'image',
          status: 'supported'
        }
      },
      fetches: 1
    },
    {
      name: 'refetches over a malformed stored summary',
      stored: { 'bfl/flux-2-pro': { primary: 42 } },
      fetches: 1
    }
  ])('$name', async ({ stored, fetches }) => {
    const fetchSchema = published()
    const index = createCatalogIndex({
      listModels: listed([entry('bfl/flux-2-pro', 'etag-1')]),
      fetchSchema,
      summaries: ref<Record<string, unknown>>(stored),
      now: () => 0
    })

    const image = index.catalog('image')
    await index.refresh()

    expect(fetchSchema).toHaveBeenCalledTimes(fetches)
    expect(image.value).toMatchObject({
      status: 'ready',
      models: [{ id: 'bfl/flux-2-pro' }]
    })
  })

  it('shows progress while schemas are still being read', async () => {
    const pending = deferredSchema()
    const index = createCatalogIndex({
      listModels: listed([entry('bfl/flux-2-pro')]),
      fetchSchema: () => pending.promise,
      summaries: ref({}),
      now: () => 0
    })

    const image = index.catalog('image')
    await vi.waitFor(() =>
      expect(image.value).toEqual({
        status: 'loading',
        done: 0,
        total: 1,
        models: []
      })
    )
    pending.resolve({ ok: true, doc: PUBLISHED['bfl/flux-2-pro'] })
    await index.refresh()

    expect(image.value).toMatchObject({ status: 'ready', unsupported: 0 })
  })

  it('reports a refused listing with the server detail', async () => {
    const index = createCatalogIndex({
      listModels: async () => ({
        ok: false,
        refused: true,
        detail: 'Token audience not accepted'
      }),
      fetchSchema: published(),
      summaries: ref({}),
      now: () => 0
    })

    const image = index.catalog('image')
    await index.refresh()

    expect(image.value).toEqual({
      status: 'refused',
      detail: 'Token audience not accepted'
    })
  })
})

describe('resolveModelContract', () => {
  beforeEach(() => {
    stubFirebaseAuthHarness()
    vi.mocked(useAuthStore().getWorkspaceAuthHeader).mockResolvedValue({
      Authorization: 'Bearer workspace'
    })
    vi.mocked(useAuthStore().getFirebaseAuthHeader).mockResolvedValue(null)
  })

  it('falls back to the public schema when the live one is refused', async () => {
    vi.mocked(fetch).mockImplementation(async (input) =>
      String(input) ===
      'https://docs.comfy.org/router-schemas/kling/kling-v3.json'
        ? new Response(JSON.stringify(ROUTER_FIXTURES['kling/kling-v3']), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        : new Response(JSON.stringify({ detail: 'Not enabled' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          })
    )

    const resolved = await resolveModelContract('kling/kling-v3', 'video')

    expect(resolved).toMatchObject({
      ok: true,
      label: 'kling-v3',
      contract: {
        inputs: [{ name: 'prompt' }, { name: 'negative_prompt' }],
        outputs: [{ name: 'out', modality: 'video' }]
      }
    })
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
      `${getComfyApiBaseUrl()}/v2/models/kling/kling-v3/openapi.json`
    )
  })
})
