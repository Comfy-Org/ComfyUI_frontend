import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import { nextTick } from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
import { lastList } from '@/lib/workshop/shelf-memory'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'

const models: WorkshopModel[] = [
  {
    slug: 'kling-ai',
    name: 'Kling AI',
    workflowCount: 3,
    href: '/models/kling-ai/',
    routerId: 'kling/kling-ai',
    capabilities: [],
    provider: 'Kling',
    modality: 'video',
    task: 'text-to-video',
    creditsPerRun: 24
  },
  {
    slug: 'flux',
    name: 'Flux',
    workflowCount: 2,
    href: '/models/flux/',
    routerId: 'bfl/flux',
    capabilities: ['Upscale'],
    provider: 'Black Forest Labs',
    modality: 'image',
    task: 'image-to-image',
    creditsPerRun: 8
  },
  {
    slug: 'mystery',
    name: 'Mystery',
    workflowCount: 1,
    href: '/models/mystery/',
    routerId: 'comfy/mystery',
    capabilities: []
  }
]

function cardNames() {
  return screen
    .queryAllByTestId('workshop-model-card')
    .map((card) => card.textContent)
}

function openWeightCards() {
  return screen.queryAllByTestId('open-weight-model-card')
}

async function chooseTab(
  user: ReturnType<typeof userEvent.setup>,
  name: string
) {
  await user.click(screen.getByRole('tab', { name }))
}

async function useCase(user: ReturnType<typeof userEvent.setup>, name: string) {
  if (!screen.queryByRole('dialog'))
    await user.click(screen.getByTestId('workshop-filter'))
  const dialog = await screen.findByRole('dialog')
  return within(dialog).getByRole('button', { name })
}

async function offeredUseCases(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('workshop-filter'))
  const dialog = await screen.findByRole('dialog')
  const list = within(dialog).queryByRole('list', { name: 'Use cases' })
  const names = list
    ? within(list)
        .getAllByRole('button')
        .map((button) => button.dataset.testid)
    : []
  await user.keyboard('{Escape}')
  return names
}

function catalogueHeading() {
  return screen.getByRole('heading', { level: 2, name: /^All models \d+$/ })
}

async function showEveryPage(user: ReturnType<typeof userEvent.setup>) {
  let more = screen.queryByRole('button', { name: 'Show more' })
  while (more) {
    await user.click(more)
    more = screen.queryByRole('button', { name: 'Show more' })
  }
}

async function search() {
  const field = screen.getByRole('searchbox', {
    name: 'Search models, providers, and categories'
  })
  await waitFor(() => expect(field).not.toHaveProperty('disabled', true))
  return field
}

describe('WorkshopModelsGrid', () => {
  afterEach(() => {
    history.replaceState(null, '', '/')
    sessionStorage.clear()
  })

  it('searches by name and provider', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    expect(cardNames()).toHaveLength(3)

    await user.type(await search(), 'forest')
    expect(cardNames()).toEqual([expect.stringContaining('Flux')])
  })

  it.for([
    ['provider=Kling', 'Kling AI'],
    ['capability=Upscale', 'Flux'],
    ['modality=video', 'Kling AI']
  ])('honors the legacy %s deep link', async ([search, expected]) => {
    history.replaceState(null, '', `/models/?${search}`)
    render(WorkshopModelsGrid, { props: { models } })

    await waitFor(() =>
      expect(cardNames()).toEqual([expect.stringContaining(expected)])
    )
  })

  it('does not show a duplicate search results panel', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.type(await search(), 'flux')
    expect(screen.queryByTestId('workshop-search-panel')).toBeNull()
  })

  it('opens the use case the address names on its tab, with no way back to leave', async () => {
    history.replaceState(null, '', '/models/?useCase=edit-images')
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Edit images 1' })
    ).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Image' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(await useCase(user, 'Edit 1')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(cardNames()).toEqual([expect.stringContaining('Flux')])
    expect(openWeightCards()).toEqual([])
    expect(screen.queryByRole('button', { name: /Back to/ })).toBeNull()

    await chooseTab(user, 'All')
    expect(catalogueHeading()).toHaveTextContent('3')
    expect(cardNames()).toHaveLength(3)
  })

  it.for([
    { useCase: 'generate-videos', tab: 'Video' },
    { useCase: 'audio', tab: 'Audio' }
  ])(
    'opens the tab a deep-linked $useCase belongs to',
    async ({ useCase, tab }) => {
      const audio: WorkshopModel = {
        ...models[0],
        slug: 'speech',
        name: 'Speech',
        href: '/models/speech/',
        modality: 'audio',
        task: 'text-to-audio'
      }
      history.replaceState(null, '', `/models/?useCase=${useCase}`)
      render(WorkshopModelsGrid, { props: { models: [...models, audio] } })

      await waitFor(() =>
        expect(screen.getByRole('tab', { name: tab })).toHaveAttribute(
          'aria-selected',
          'true'
        )
      )
      expect(cardNames()).toHaveLength(1)
    }
  )

  it('brings the catalogue heading into view as a use case opens, without leaving the page', async () => {
    const scrollTo = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined)
    const scrollIntoView = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined)
    onTestFinished(() => {
      scrollTo.mockRestore()
      scrollIntoView.mockRestore()
    })
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    await nextTick()
    await chooseTab(user, 'Image')
    expect(scrollIntoView).not.toHaveBeenCalled()

    await user.click(await useCase(user, 'Edit 1'))
    await vi.waitFor(() =>
      expect(scrollIntoView.mock.contexts).toContain(
        screen.getByRole('heading', { level: 2, name: 'Edit images 1' })
      )
    )
    expect(scrollTo).not.toHaveBeenCalledWith({ top: 0 })
    expect(screen.getByTestId('models-hub-hero')).toBeTruthy()
  })

  it('lists in the filter menu only the tasks of the chosen type that have results', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    expect(await offeredUseCases(user)).toEqual([
      'filter-useCase-edit-images',
      'filter-useCase-generate-videos'
    ])

    await chooseTab(user, 'Video')
    expect(await offeredUseCases(user)).toEqual([
      'filter-useCase-generate-videos'
    ])

    await chooseTab(user, 'Edit')
    expect(await offeredUseCases(user)).toEqual(['filter-useCase-edit-images'])
  })

  it('moves the sidebar to the type of a use case chosen on All', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(await useCase(user, 'Generate videos 1'))

    expect(screen.getByRole('tab', { name: /^Video/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'Generate videos 1' })
    ).toBeTruthy()
  })

  it('narrows a tab by its use cases, several at once, and lets go of one', async () => {
    const restyle: WorkshopModel = {
      ...models[0],
      slug: 'restyle',
      name: 'Restyle',
      href: '/models/restyle/',
      task: 'video-to-video'
    }
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models: [...models, restyle] } })
    await chooseTab(user, 'Video')

    await user.click(await useCase(user, 'Edit video 1'))
    expect(cardNames()).toEqual([expect.stringContaining('Restyle')])
    expect(
      screen.getByRole('heading', { level: 2, name: 'Edit videos 1' })
    ).toBeTruthy()
    expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('1')

    await user.click(await useCase(user, 'Generate 1'))
    expect(cardNames()).toHaveLength(2)

    await user.click(await useCase(user, 'Edit video 1'))
    expect(cardNames()).toEqual([expect.stringContaining('Kling AI')])

    await user.click(screen.getByTestId('workshop-filter-clear'))
    expect(screen.queryByTestId('workshop-filter-count')).toBeNull()
    expect(cardNames()).toHaveLength(2)
  })

  it('keeps a use case the next tab also offers and lets go of one it does not', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    await chooseTab(user, 'Image')
    await user.click(await useCase(user, 'Edit 1'))
    await user.keyboard('{Escape}')

    await chooseTab(user, 'Edit')
    expect(await useCase(user, 'Images 1')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await user.keyboard('{Escape}')

    await chooseTab(user, 'Video')
    expect(screen.queryByTestId('workshop-filter-count')).toBeNull()
    expect(cardNames()).toEqual([expect.stringContaining('Kling AI')])
  })

  it('finds no open-weight models when the visitor searches for one', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.type(await search(), 'kontext')
    expect(openWeightCards()).toEqual([])
    expect(cardNames()).toEqual([])
    expect(screen.getByText('No models match')).toBeTruthy()
  })

  it.for([
    { locale: 'en' as const, name: 'Browse open weights' },
    { locale: 'zh-CN' as const, name: '浏览开放权重' }
  ])('links to the open weights page in $locale', ({ locale, name }) => {
    render(WorkshopModelsGrid, { props: { models, locale } })

    const link = screen.getByTestId('models-all-link')
    expect(link).toHaveAccessibleName(name)
    expect(link).toHaveAttribute('href', '/hub/models/local/')
  })

  // Coming back from a model, a browser can restore this page from its cache
  // with the shelf still open, so the reader lands on a narrowed catalogue the
  // address does not name. Reported by Eric: back should reach all models.
  it.for([undefined, ''])(
    'starts from the address again when the browser restores the page (initialSearch: %s)',
    async (initialSearch) => {
      const user = userEvent.setup()
      render(WorkshopModelsGrid, { props: { models, initialSearch } })

      await chooseTab(user, 'Image')
      await user.click(await useCase(user, 'Edit 1'))

      // A different shelf in the address, so a handler that only emptied the
      // selection would fail here rather than pass by coincidence.
      history.replaceState(null, '', '/models/?useCase=generate-videos')
      onTestFinished(() => history.replaceState(null, '', '/'))
      const restored = new Event('pageshow')
      Object.defineProperty(restored, 'persisted', { value: true })
      window.dispatchEvent(restored)

      expect(
        await screen.findByRole('heading', {
          level: 2,
          name: /Generate videos/
        })
      ).toBeTruthy()
      expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('1')
      expect(cardNames()).toEqual([expect.stringContaining('Kling AI')])
    }
  )

  // A first load is a pageshow too, and it must not throw away a shelf the
  // visitor opened before the page had finished settling.
  it('keeps the open shelf when the page was not restored', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await chooseTab(user, 'Image')
    await user.click(await useCase(user, 'Edit 1'))
    window.dispatchEvent(new Event('pageshow'))

    await waitFor(() =>
      expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('1')
    )
  })

  it('sorts by recommendation by default and by name on request', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    await user.type(await search(), ' ')
    expect(cardNames()[0]).toContain('Kling AI')

    await user.click(screen.getByRole('button', { name: 'Sort' }))
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'Name A to Z' })
    )
    expect(cardNames()[0]).toContain('Flux')
  })

  it('offers no price order, even for models that carry a price', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'Sort' }))

    expect(
      (await screen.findAllByRole('menuitemradio')).map((item) =>
        item.textContent.trim()
      )
    ).toEqual(['Most popular', 'Name A to Z'])
  })

  it('opens on the whole catalogue with no Trending row, and sorts it by name', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    expect(catalogueHeading()).toHaveTextContent('3')
    expect(cardNames()).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Sort' }))
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'Name A to Z' })
    )

    expect(
      screen.queryByRole('heading', { level: 2, name: 'Trending' })
    ).toBeNull()
    expect(
      cardNames().map((name) => name.match(/Flux|Kling AI|Mystery/)?.[0])
    ).toEqual(['Flux', 'Kling AI', 'Mystery'])
  })

  it('does not manufacture a return shelf before a model is opened', () => {
    sessionStorage.setItem('comfy-models-shelf', 'generate-videos')
    render(WorkshopModelsGrid, { props: { models } })

    expect(lastList('/models/kling-ai/')).toBeUndefined()
  })

  it('remembers the category tab a model was opened from', async () => {
    history.replaceState(null, '', '/hub/models/?tab=video')
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    await nextTick()

    await user.click(screen.getByRole('link', { name: /Kling AI/ }))

    expect(lastList('/models/kling-ai/')).toEqual({
      href: '/hub/models/?tab=video',
      label: 'Video models'
    })
  })

  it('clears search and filters together from the empty state', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    await user.type(await search(), 'nothing')
    expect(screen.getByText('No models match')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(cardNames()).toHaveLength(3)
  })

  describe('models hub', () => {
    const wan: WorkshopModel = {
      slug: 'wan--text-to-video-3.0--generate-videos',
      name: 'Wan 3.0 Text-to-Video',
      workflowCount: 1,
      href: '/models/wan-3/',
      routerId: 'wan/wan3.0-t2v',
      capabilities: [],
      provider: 'Wan',
      modality: 'video',
      task: 'text-to-video',
      thumbnail: { url: 'https://example.com/wan.webp', kind: 'image' }
    }
    const launch: WorkshopModel = {
      slug: 'byteplus--seedance-2-5-text-to-video--generate-videos',
      name: 'Seedance 2.5 Text-to-Video',
      workflowCount: 1,
      href: '/models/seedance-2-5/',
      routerId: 'byteplus/seedance-2-5',
      capabilities: [],
      provider: 'ByteDance',
      modality: 'video',
      task: 'text-to-video'
    }
    const hub = [...models, wan, launch]

    it('opens on the hero and then the whole catalogue', () => {
      vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
      render(WorkshopModelsGrid, { props: { models: hub } })

      const hero = screen.getByTestId('models-hub-hero')
      expect(within(hero).getByTestId('hub-back')).toHaveAttribute(
        'href',
        '/hub/'
      )
      expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent(
        /^Models$/
      )
      expect(
        within(hero).queryByRole('link', { name: /Run a model|Get an API key/ })
      ).toBeNull()
      expect(catalogueHeading()).toHaveAttribute('id', 'models-catalogue')
      expect(screen.queryByTestId('models-hub-counts')).toBeNull()
      expect(screen.getByTestId('models-hub-latest')).toHaveTextContent(
        'Seedance 2.5 Text-to-Video'
      )
      expect(
        screen.queryByRole('heading', { level: 2, name: 'Trending' })
      ).toBeNull()
      expect(cardNames()).toHaveLength(hub.length)
    })

    it.for([
      { narrowing: 'a search', address: '/hub/models/?q=flux' },
      { narrowing: 'a category', address: '/hub/models/?useCase=edit-images' },
      { narrowing: 'a tab', address: '/hub/models/?tab=video' },
      { narrowing: 'a way to use it', address: '/hub/models/?use=api' }
    ])(
      'keeps the hero for $narrowing and scrolls to the results',
      async ({ address }) => {
        const scrollIntoView = vi
          .spyOn(HTMLElement.prototype, 'scrollIntoView')
          .mockImplementation(() => undefined)
        onTestFinished(() => scrollIntoView.mockRestore())
        history.replaceState(null, '', address)
        render(WorkshopModelsGrid, { props: { models: hub } })
        await nextTick()

        expect(screen.getByTestId('models-hub-hero')).toBeTruthy()
        await vi.waitFor(() =>
          expect(scrollIntoView.mock.contexts).toContain(
            screen.getByRole('heading', { level: 2, name: /\d+$/ })
          )
        )
      }
    )
  })

  describe('pages', () => {
    const many: WorkshopModel[] = Array.from({ length: 30 }, (_, index) => ({
      slug: `model-${index}`,
      name: `Model ${String(index).padStart(2, '0')}`,
      workflowCount: 1,
      href: `/models/model-${index}/`,
      routerId: `acme/model-${index}`,
      capabilities: [],
      provider: 'Acme'
    }))

    it('shows twelve models, then twelve more on each request, until all are shown', async () => {
      const user = userEvent.setup()
      render(WorkshopModelsGrid, { props: { models: many } })
      expect(catalogueHeading()).toHaveTextContent('30')
      expect(cardNames()).toHaveLength(12)

      await user.click(screen.getByRole('button', { name: 'Show more' }))
      expect(cardNames()).toHaveLength(24)

      await user.click(screen.getByRole('button', { name: 'Show more' }))
      expect(cardNames()).toHaveLength(30)
      expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
    })

    it('starts again from the first page when the search or sort changes', async () => {
      const user = userEvent.setup()
      render(WorkshopModelsGrid, { props: { models: many } })
      await user.click(screen.getByRole('button', { name: 'Show more' }))
      expect(cardNames()).toHaveLength(24)

      await user.type(await search(), 'model')
      expect(cardNames()).toHaveLength(12)

      await user.click(screen.getByRole('button', { name: 'Show more' }))
      await user.click(screen.getByRole('button', { name: 'Sort' }))
      await user.click(
        await screen.findByRole('menuitemradio', { name: 'Name A to Z' })
      )
      expect(cardNames()).toHaveLength(12)
    })

    it('shows no more button when one page holds every model', () => {
      render(WorkshopModelsGrid, { props: { models } })
      expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
    })

    it('leaves the heading above the toolbar holding the controls', () => {
      render(WorkshopModelsGrid, { props: { models } })

      const toolbar = screen.getByTestId('workshop-toolbar')
      const heading = catalogueHeading()

      expect(toolbar).not.toContainElement(heading)
      expect(
        heading.compareDocumentPosition(toolbar) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
      expect(within(toolbar).getByRole('searchbox')).toBeVisible()
      expect(within(toolbar).getByTestId('workshop-filters')).toBeVisible()
      expect(within(toolbar).getByTestId('workshop-sort')).toBeVisible()
    })
  })

  describe('how you use it', () => {
    beforeEach(() => {
      vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
    })

    const withUnwired: WorkshopModel[] = [
      ...models,
      {
        ...models[0],
        slug: 'unwired',
        name: 'Unwired',
        href: '/models/unwired/',
        incompleteReason: 'missing-input-schema'
      }
    ]

    async function chooseAccess(...labels: string[]) {
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Filters' }))
      const dialog = await screen.findByRole('dialog', { name: 'Filters' })
      await user.click(
        within(dialog).getByRole('tab', { name: /^How you use it/ })
      )
      for (const label of labels)
        await user.click(
          within(dialog).getByRole('button', { name: new RegExp(`^${label} `) })
        )
      return { user, dialog }
    }

    function hostedCards() {
      return screen.queryAllByTestId('workshop-model-card')
    }

    it('offers the two ways to use a model with their counts, and no Download', async () => {
      render(WorkshopModelsGrid, { props: { models: withUnwired } })
      const { dialog } = await chooseAccess()

      for (const name of [`Run here ${models.length}`, `API ${models.length}`])
        expect(within(dialog).getByRole('button', { name })).toHaveAttribute(
          'aria-pressed',
          'false'
        )
      expect(
        within(dialog).queryByRole('button', { name: /^Download/ })
      ).toBeNull()
    })

    it('offers the Filters menu on All, with every use case that has results', () => {
      render(WorkshopModelsGrid, { props: { models } })

      expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy()
    })

    it.for([
      { choice: ['Run here'], hosted: 3 },
      { choice: ['API'], hosted: 3 },
      { choice: ['Run here', 'API'], hosted: 3 }
    ])(
      'lists $hosted hosted and no open-weight models for $choice',
      async ({ choice, hosted }) => {
        render(WorkshopModelsGrid, { props: { models: withUnwired } })
        const { user } = await chooseAccess(...choice)
        await user.keyboard('{Escape}')
        await showEveryPage(user)

        expect(hostedCards()).toHaveLength(hosted)
        expect(openWeightCards()).toHaveLength(0)
        expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent(
          String(choice.length)
        )
      }
    )

    it('lists no hosted model under Run here while running here is off', async () => {
      vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', undefined)
      render(WorkshopModelsGrid, { props: { models } })
      const { dialog } = await chooseAccess('Run here')

      expect(
        within(dialog).getByRole('button', { name: 'Run here 0' })
      ).toBeTruthy()
      expect(within(dialog).queryByRole('button', { name: /^API / })).toBeNull()
      expect(hostedCards()).toHaveLength(0)
    })

    it('opens on the choice the address names and keeps it there', async () => {
      history.replaceState(null, '', '/hub/models/?use=run')
      render(WorkshopModelsGrid, { props: { models: withUnwired } })
      await nextTick()

      expect(hostedCards()).toHaveLength(models.length)
      expect(screen.getByTestId('models-hub-hero')).toBeTruthy()
      expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('1')

      const { user, dialog } = await chooseAccess('API')
      expect(location.search).toBe('?use=run%2Capi')
      await user.click(within(dialog).getByTestId('workshop-filter-clear'))
      expect(location.search).toBe('')
    })

    it('lets go of the choice with the rest of the filters', async () => {
      render(WorkshopModelsGrid, { props: { models: withUnwired } })
      const { user, dialog } = await chooseAccess('API')
      await user.click(within(dialog).getByTestId('workshop-filter-clear'))

      expect(hostedCards()).toHaveLength(withUnwired.length)
      expect(screen.queryByTestId('workshop-filter-count')).toBeNull()
      expect(catalogueHeading()).toHaveTextContent(`${withUnwired.length}`)
    })
  })

  describe('compare', () => {
    const fourth: WorkshopModel = {
      slug: 'seedream',
      name: 'Seedream',
      workflowCount: 0,
      href: '/models/seedream/',
      routerId: 'bytedance/seedream',
      capabilities: [],
      provider: 'ByteDance',
      priceUsdFrom: 0.03
    }

    function renderCatalogue() {
      render(WorkshopModelsGrid, { props: { models: [...models, fourth] } })
      return userEvent.setup()
    }

    function toggle(name: string) {
      return screen.getByRole('checkbox', { name: `Compare ${name}` })
    }

    function revealedChips() {
      return screen
        .getAllByTestId('compare-toggle')
        .filter((chip) => chip.dataset.revealed === 'true')
    }

    function compareButton() {
      return within(screen.getByTestId('compare-tray')).getByTestId(
        'compare-open'
      )
    }

    it('collects up to three models in the tray', async () => {
      const user = renderCatalogue()
      expect(screen.queryByTestId('compare-tray')).toBeNull()

      expect(revealedChips()).toEqual([])

      await user.click(toggle('Kling AI'))
      expect(compareButton()).toBeDisabled()
      expect(compareButton()).toHaveTextContent('Compare 1 model')
      expect(screen.getByTestId('compare-hint')).toHaveTextContent(
        'Pick 1 more to compare'
      )
      expect(revealedChips()).toHaveLength(4)

      await user.click(toggle('Flux'))
      expect(compareButton()).toBeEnabled()
      expect(compareButton()).toHaveTextContent('Compare 2 models')
      expect(screen.getByTestId('compare-hint')).toHaveTextContent(
        'You can add 1 more'
      )

      await user.click(toggle('Mystery'))
      expect(screen.queryByTestId('compare-hint')).toBeNull()
      expect(toggle('Seedream')).toBeDisabled()
      expect(toggle('Flux')).toBeChecked()

      await user.click(
        screen.getByRole('button', { name: 'Remove Flux from compare' })
      )
      expect(toggle('Flux')).not.toBeChecked()
      expect(toggle('Seedream')).toBeEnabled()

      await user.click(screen.getByTestId('compare-clear'))
      expect(screen.queryByTestId('compare-tray')).toBeNull()
      expect(revealedChips()).toEqual([])
      expect(toggle('Kling AI')).not.toBeChecked()
    })

    it('sets the chosen models side by side and marks the address', async () => {
      const user = renderCatalogue()
      await user.click(toggle('Kling AI'))
      await user.click(toggle('Seedream'))
      await user.click(compareButton())

      const dialog = await screen.findByRole('dialog', {
        name: '2 models side by side'
      })
      expect(location.hash).toBe('#compare')
      expect(within(dialog).getAllByRole('columnheader')).toHaveLength(2)
      for (const name of ['Kling AI', 'Seedream'])
        expect(within(dialog).getByRole('columnheader', { name })).toBeTruthy()
      expect(
        within(dialog).getByRole('row', { name: /^Provider/ })
      ).toHaveTextContent('ProviderKlingByteDance')
      expect(within(dialog).queryByRole('row', { name: /price/i })).toBeNull()
      expect(
        within(dialog)
          .getAllByTestId('compare-model-link')
          .map((link) => link.getAttribute('href'))
      ).toEqual(['/models/kling-ai/', '/models/seedream/'])
      expect(
        within(dialog)
          .getAllByRole('link', { name: /^Try / })
          .map((link) => [
            link.getAttribute('aria-label'),
            link.textContent.trim()
          ])
      ).toEqual([
        ['Try Kling AI', 'Try'],
        ['Try Seedream', 'Try']
      ])
      expect(within(dialog).getAllByTestId('compare-thumbnail')).toHaveLength(2)
      expect(within(dialog).queryByText('Model page')).toBeNull()

      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(location.hash).toBe('')
    })

    it('opens from #compare only once two models are chosen', async () => {
      const user = renderCatalogue()
      await user.click(toggle('Kling AI'))
      location.hash = '#compare'
      await nextTick()
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      expect(screen.queryByRole('dialog')).toBeNull()

      await user.click(toggle('Flux'))
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      expect(
        await screen.findByRole('dialog', { name: '2 models side by side' })
      ).toBeTruthy()
    })
  })
})
