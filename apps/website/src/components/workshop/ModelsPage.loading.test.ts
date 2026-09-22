import { render, screen } from '@testing-library/vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { nextTick, readonly, ref } from 'vue'

import { workshopModels } from '../../config/workshop-browse-content'
import './ModelDetail.vue'
import './ModelsCatalogue.vue'
import { prepareModelPage } from '../../routes/models/model-page'
import { useWorkshopAuthFlag, useWorkshopEnabled } from '../../scripts/posthog'
import ModelsPage from './ModelsPage.vue'

const modelSlug = 'bfl--flux-2-max--generate-images'
const modelPage = await prepareModelPage(modelSlug)

vi.mock(import('../../scripts/posthog'))

beforeEach(() => {
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(false)))
  vi.mocked(useWorkshopAuthFlag).mockReturnValue(readonly(ref(false)))
})

it.for([
  { view: 'catalogue', slug: undefined, visible: 'workshop-search' },
  { view: 'detail', slug: modelSlug, visible: 'model-detail' }
] as const)(
  'keeps the static slot in place, with no spinner, until the $view data arrives',
  async ({ slug, visible }) => {
    const pending = Promise.withResolvers<Response>()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockReturnValue(pending.promise)
    )
    render(ModelsPage, {
      props: { slug },
      slots: { loading: '<h1>Every model</h1>' }
    })
    await nextTick()
    expect(screen.getByRole('heading', { name: 'Every model' })).toBeTruthy()
    expect(screen.queryByTestId('models-loading')).toBeNull()
    expect(screen.queryByTestId(visible)).toBeNull()

    pending.resolve(Response.json(slug ? modelPage : workshopModels))
    expect(await screen.findByTestId(visible)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Every model' })).toBeNull()
  }
)
