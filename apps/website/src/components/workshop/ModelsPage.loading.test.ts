import { render, screen } from '@testing-library/vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { readonly, ref, nextTick } from 'vue'
import type { Ref } from 'vue'

import { workshopModels } from '../../config/workshop-browse-content'
import './ModelPage.vue'
import './ModelsCatalogue.vue'
import { prepareModelPage } from '../../routes/models/model-page'
import {
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopAuthFlag
} from '../../scripts/posthog'
import ModelsPage from './ModelsPage.vue'

const modelSlug = 'bfl--flux-2-max--generate-images'
const modelPage = await prepareModelPage(modelSlug)

vi.mock(import('../../scripts/posthog'))

let enabled: Ref<boolean>
let settled: Ref<boolean>

beforeEach(() => {
  enabled = ref(false)
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(enabled))
  settled = ref(true)
  vi.mocked(useWorkshopEnabledSettled).mockReturnValue(readonly(settled))
  vi.mocked(useWorkshopAuthFlag).mockReturnValue(readonly(ref(false)))
})

it.for([
  { view: 'catalogue', slug: undefined, visible: 'workshop-search' },
  { view: 'detail', slug: modelSlug, visible: 'model-hero' }
] as const)(
  'replaces public content with a neutral loading frame while the $view data loads',
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
    await nextTick()
    expect(screen.getByRole('heading', { name: 'Public Models' })).toBeTruthy()

    enabled.value = true
    await nextTick()
    expect(await screen.findByTestId('models-loading')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Public Models' })).toBeNull()
    expect(screen.queryByTestId(visible)).toBeNull()

    pending.resolve(Response.json(slug ? modelPage : workshopModels))
    expect(await screen.findByTestId(visible)).toBeTruthy()
    expect(screen.queryByTestId('models-loading')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Public Models' })).toBeNull()
  }
)
