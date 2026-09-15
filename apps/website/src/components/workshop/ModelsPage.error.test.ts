import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'

import './ModelPage.vue'
import './ModelsCatalogue.vue'
import { prepareModelPage } from '../../routes/models/model-page'
import { workshopModels } from '../../config/workshop-browse-content'
import ModelsPage from './ModelsPage.vue'

const modelSlug = 'bfl--flux-2-max--generate-images'
const modelPage = await prepareModelPage(modelSlug)

vi.mock(import('../../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  return {
    useWorkshopEnabled: () => ref(true),
    useWorkshopEnabledSettled: () => ref(true),
    useWorkshopAuthFlag: () => ref(false),
    captureWorkshopEvent: vi.fn(),
    identifyWorkshopUser: vi.fn()
  }
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
