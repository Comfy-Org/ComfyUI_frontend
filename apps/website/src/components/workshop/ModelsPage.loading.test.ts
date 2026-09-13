// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import './ModelPage.vue'
import './ModelsCatalogue.vue'
import { prepareModelPage } from '../../routes/models/model-page'
import { workshopModels } from '../../config/workshop-browse-content'
import ModelsPage from './ModelsPage.vue'

const modelSlug = 'bfl--flux-2-max--generate-images'
const modelPage = await prepareModelPage(modelSlug)

const { enabled } = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return { enabled: ref(false) }
})

vi.mock(import('../../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  return {
    useWorkshopEnabled: () => enabled,
    useWorkshopAuthFlag: () => ref(false),
    useWorkshopAuthFlagSettled: () => ref(true),
    captureWorkshopEvent: vi.fn(),
    identifyWorkshopUser: vi.fn()
  }
})

beforeEach(() => {
  enabled.value = false
})

it.for([
  { view: 'catalogue', slug: undefined, visible: 'workshop-search' },
  { view: 'detail', slug: modelSlug, visible: 'model-hero' }
] as const)(
  'keeps public content visible while the $view data loads',
  async ({ slug, visible }) => {
    const pending = Promise.withResolvers<Response>()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockReturnValue(pending.promise)
    )
    render(ModelsPage, {
      props: { slug },
      slots: { fallback: '<h1>Public Models</h1>' }
    })
    expect(screen.getByRole('heading', { name: 'Public Models' })).toBeTruthy()

    enabled.value = true
    await nextTick()
    expect(screen.getByRole('heading', { name: 'Public Models' })).toBeTruthy()
    expect(screen.queryByTestId(visible)).toBeNull()

    pending.resolve(Response.json(slug ? modelPage : workshopModels))
    expect(await screen.findByTestId(visible)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Public Models' })).toBeNull()
  }
)
