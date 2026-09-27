import userEvent from '@testing-library/user-event'
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
  enabled = ref(true)
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(enabled))
  settled = ref(true)
  vi.mocked(useWorkshopEnabledSettled).mockReturnValue(readonly(settled))
  vi.mocked(useWorkshopAuthFlag).mockReturnValue(readonly(ref(false)))
})

const failed = () => Response.json({ error: 'down' }, { status: 500 })

it.for([
  { view: 'catalogue', slug: undefined, visible: 'workshop-search' },
  { view: 'detail', slug: modelSlug, visible: 'model-hero' }
] as const)(
  'retries a failed $view load once, then offers a retry instead of the public page',
  async ({ slug, visible }) => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(failed())
      .mockResolvedValueOnce(failed())
      .mockImplementation(async () =>
        Response.json(slug ? modelPage : workshopModels)
      )
    vi.stubGlobal('fetch', fetchMock)
    render(ModelsPage, {
      props: { slug },
      slots: { fallback: '<h1>Public Models</h1>' }
    })

    expect(await screen.findByTestId('models-load-error')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('heading', { name: 'Public Models' })).toBeNull()
    expect(screen.queryByTestId(visible)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId(visible)).toBeTruthy()
    expect(screen.queryByTestId('models-load-error')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Public Models' })).toBeNull()
  }
)
