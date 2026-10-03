import { render, screen } from '@testing-library/vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'
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
  'holds a neutral loading frame while the $view data loads, even before the flag answers',
  async ({ slug, visible }) => {
    const pending = Promise.withResolvers<Response>()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockReturnValue(pending.promise)
    )
    settled.value = false
    render(ModelsPage, { props: { slug } })
    expect(await screen.findByTestId('models-loading')).toBeTruthy()
    expect(screen.queryByTestId(visible)).toBeNull()

    pending.resolve(Response.json(slug ? modelPage : workshopModels))
    expect(await screen.findByTestId(visible)).toBeTruthy()
    expect(screen.queryByTestId('models-loading')).toBeNull()
  }
)
