import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'

import './ModelPage.vue'
import './ModelsCatalogue.vue'
import ModelsPage from './ModelsPage.vue'
import { prepareModelPage } from '../../routes/models/model-page'
import { workshopModels } from '../../config/workshop-browse-content'

const { enabled, settled } = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return { enabled: ref(false), settled: ref(true) }
})

vi.mock(import('../../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  return {
    useWorkshopEnabled: () => enabled,
    useWorkshopEnabledSettled: () => settled,
    useWorkshopAuthFlag: () => ref(false),
    captureWorkshopEvent: vi.fn(),
    identifyWorkshopUser: vi.fn()
  }
})

const modelSlug = 'bfl--flux-2-max--generate-images'
const modelPage = await prepareModelPage(modelSlug)

beforeEach(() => {
  enabled.value = false
  settled.value = true
})

describe('Models page entry', () => {
  it.for([undefined, modelSlug])(
    'server-renders only public content for %s',
    async (slug) => {
      const html = await renderToString(
        createSSRApp({
          render: () =>
            h(
              ModelsPage,
              { slug },
              {
                fallback: () => h('h1', 'Public Models')
              }
            )
        })
      )
      expect(html).toContain('Public Models')
      expect(html).not.toContain('workshop-search')
      expect(html).not.toContain('model-hero')
      expect(html).not.toContain('model-detail')
    }
  )

  it.for([
    { slug: undefined, visible: 'workshop-search' },
    { slug: modelSlug, visible: 'model-hero' }
  ])('mounts $visible only after enablement', async ({ slug, visible }) => {
    const fetchData = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(slug ? modelPage : workshopModels))
    vi.stubGlobal('fetch', fetchData)
    render(ModelsPage, {
      props: { slug },
      slots: { fallback: '<h1>Public Models</h1>' }
    })
    expect(screen.queryByTestId(visible)).toBeNull()
    expect(fetchData).not.toHaveBeenCalled()
    enabled.value = true
    expect(await screen.findByTestId(visible)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Public Models' })).toBeNull()
    if (slug) {
      expect(screen.getByTestId('model-detail')).toBeTruthy()
      expect(screen.getByTestId('related-models').textContent).toContain(
        'Browse all'
      )
      expect(
        within(screen.getByTestId('model-hero')).getByRole('link', {
          name: 'Generate images'
        })
      ).toHaveAttribute('href', '/models?useCase=generate-images')
    }
    enabled.value = false
    await nextTick()
    expect(screen.getByRole('heading', { name: 'Public Models' })).toBeTruthy()
  })
})
