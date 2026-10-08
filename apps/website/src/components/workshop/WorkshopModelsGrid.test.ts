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

async function pickUseCase(
  user: ReturnType<typeof userEvent.setup>,
  name: string
) {
  if (!screen.queryByRole('dialog', { name: 'Filter' }))
    await user.click(screen.getByRole('button', { name: 'Filter' }))
  const dialog = await screen.findByRole('dialog', { name: 'Filter' })
  await user.click(within(dialog).getByRole('button', { name }))
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

  it('opens the use case the address names, with no way back to leave', async () => {
    history.replaceState(null, '', '/models/?useCase=edit-images')
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Edit images 1' })
    ).toBeTruthy()
    expect(cardNames()).toEqual([expect.stringContaining('Flux')])
    expect(openWeightCards()).toEqual([])
    expect(screen.queryByRole('button', { name: /Back to/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filter' })
    await user.click(within(dialog).getByTestId('workshop-filter-clear'))
    expect(catalogueHeading()).toHaveTextContent('3')
    expect(cardNames()).toHaveLength(3)
  })

  it('brings the catalogue heading into view as a category opens, without leaving the page', async () => {
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
    expect(scrollIntoView).not.toHaveBeenCalled()

    await pickUseCase(user, 'Edit images 1')
    await vi.waitFor(() =>
      expect(scrollIntoView.mock.contexts).toContain(
        screen.getByRole('heading', { level: 2, name: 'Edit images 1' })
      )
    )
    expect(scrollTo).not.toHaveBeenCalledWith({ top: 0 })
    expect(screen.getByTestId('models-hub-hero')).toBeTruthy()
  })

  it('filters by use case from the filter menu', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filter' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Edit images 1' })
    )
    expect(cardNames()).toEqual([expect.stringContaining('Flux')])

    await user.click(
      screen.getAllByRole('button', { name: 'Clear filters' })[0]
    )
    expect(cardNames()).toHaveLength(3)
  })

  it('clears the filters back to the whole catalogue', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filter' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Edit images 1' })
    )
    await user.click(within(dialog).getByTestId('workshop-filter-clear'))

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'All models 3'
      })
    ).toBeTruthy()
    expect(screen.getByTestId('models-hub-hero')).toBeTruthy()
    expect(cardNames()).toHaveLength(3)
    expect(openWeightCards()).toEqual([])
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

  // A shelf and the filter are the same choice: opening "Edit images" has to
  // leave the menu saying so, or the reader sees a narrowed grid with nothing
  // anywhere to say what narrowed it.
  it('opens a shelf as the filter it is', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await pickUseCase(user, 'Edit images 1')
    await user.keyboard('{Escape}')
    expect(
      screen.getByRole('heading', { level: 2, name: /Edit images/ })
    ).toBeTruthy()
    expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('1')

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filter' })
    expect(
      within(dialog).getByRole('button', { name: 'Edit images 1' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByText('1 selected')).toBeTruthy()
  })

  it('counts what the menu narrowed by, and lets go of it from the menu', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filter' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Edit images 1' })
    )
    expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('1')

    await user.click(
      within(dialog).getByRole('button', { name: 'Edit images 1' })
    )
    expect(screen.queryByTestId('workshop-filter-count')).toBeNull()
    expect(cardNames()).toHaveLength(3)
  })

  // Letting go of one choice must not take the others with it, which a test
  // that only ever sets one would never catch.
  it('lets go of one use case and leaves the rest alone', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filter' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Edit images 1' })
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Generate videos 1' })
    )
    expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('2')

    await user.click(
      within(dialog).getByRole('button', { name: 'Edit images 1' })
    )
    expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('1')
    expect(cardNames()).toEqual([expect.stringContaining('Kling AI')])
  })

  it('adds a menu choice to the shelf already open', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await pickUseCase(user, 'Edit images 1')
    await pickUseCase(user, 'Generate videos 1')

    expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('2')
    expect(cardNames()).toHaveLength(2)
    expect(cardNames()).toEqual(
      expect.arrayContaining([expect.stringContaining('Kling AI')])
    )
  })

  // Coming back from a model, a browser can restore this page from its cache
  // with the shelf still open, so the reader lands on a narrowed catalogue the
  // address does not name. Reported by Eric: back should reach all models.
  it.for([undefined, ''])(
    'starts from the address again when the browser restores the page (initialSearch: %s)',
    async (initialSearch) => {
      const user = userEvent.setup()
      render(WorkshopModelsGrid, { props: { models, initialSearch } })

      await pickUseCase(user, 'Edit images 1')
      expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('1')

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

    await pickUseCase(user, 'Edit images 1')
    window.dispatchEvent(new Event('pageshow'))

    await waitFor(() =>
      expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('1')
    )
  })

  it('narrows the use-case menu with its search box', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filter' })
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Search…' }),
      'video'
    )
    expect(
      within(dialog).queryByRole('button', { name: 'Edit images 1' })
    ).toBeNull()
    await user.click(
      within(dialog).getByRole('button', { name: 'Generate videos 1' })
    )
    expect(cardNames()).toEqual([expect.stringContaining('Kling AI')])
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

    it('opens on the hero, the whole catalogue, then the ways in and a model family', () => {
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
        within(hero).getByRole('link', { name: 'Run a model' })
      ).toHaveAttribute('href', '#models-catalogue')
      expect(catalogueHeading()).toHaveAttribute('id', 'models-catalogue')
      expect(screen.queryByTestId('models-hub-counts')).toBeNull()
      expect(screen.getByTestId('models-hub-latest')).toHaveTextContent(
        'Seedance 2.5 Text-to-Video'
      )
      expect(
        screen.queryByRole('heading', { level: 2, name: 'Trending' })
      ).toBeNull()
      expect(cardNames()).toHaveLength(hub.length)
      expect(
        screen
          .getByTestId('workshop-models-grid')
          .compareDocumentPosition(screen.getByTestId('model-access')) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
      expect(
        within(screen.getByTestId('model-access-open')).getByText(
          'Browse open weights'
        )
      ).toBeTruthy()
      expect(screen.getByTestId('model-access-open').getAttribute('href')).toBe(
        '/hub/models/local/'
      )
      const family = screen.getByRole('region', {
        name: 'Explore model families'
      })
      expect(
        within(family).getByRole('link', { name: 'Wan 3.0' })
      ).toHaveAttribute('href', '/hub/models/?q=Wan+3.0')
      expect(
        within(family).getByRole('link', { name: 'Wan 2.2 (open)' })
      ).toHaveAttribute('href', '/hub/models/local/')
    })

    it('leaves Run a model out while nothing runs here', () => {
      vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', undefined)
      render(WorkshopModelsGrid, { props: { models: hub } })

      expect(screen.queryByRole('link', { name: 'Run a model' })).toBeNull()
      expect(
        within(screen.getByTestId('models-hub-hero')).getByRole('link', {
          name: 'Get an API key'
        })
      ).toBeTruthy()
    })

    it.for([
      { narrowing: 'a search', address: '/hub/models/?q=flux' },
      { narrowing: 'a category', address: '/hub/models/?useCase=edit-images' },
      { narrowing: 'a tab', address: '/hub/models/?tab=video' },
      { narrowing: 'a way to use it', address: '/hub/models/?use=api' }
    ])(
      'keeps the hero and its sections for $narrowing and scrolls to the results',
      async ({ address }) => {
        const scrollIntoView = vi
          .spyOn(HTMLElement.prototype, 'scrollIntoView')
          .mockImplementation(() => undefined)
        onTestFinished(() => scrollIntoView.mockRestore())
        history.replaceState(null, '', address)
        render(WorkshopModelsGrid, { props: { models: hub } })
        await nextTick()

        expect(screen.getByTestId('models-hub-hero')).toBeTruthy()
        expect(screen.getByTestId('model-access')).toBeTruthy()
        expect(screen.getByTestId('model-family')).toBeTruthy()
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

    async function chooseAccess(...labels: string[]) {
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Filter' }))
      const dialog = await screen.findByRole('dialog', { name: 'Filter' })
      await user.click(
        within(dialog).getByRole('tab', { name: 'How you use it' })
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
      render(WorkshopModelsGrid, {
        props: {
          models: [
            ...models,
            {
              ...models[0],
              slug: 'unwired',
              name: 'Unwired',
              href: '/models/unwired/',
              incompleteReason: 'missing-input-schema'
            }
          ]
        }
      })
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

    it.for([
      { choice: ['Run here'], hosted: 3 },
      { choice: ['API'], hosted: 3 },
      { choice: ['Run here', 'API'], hosted: 3 }
    ])(
      'lists $hosted hosted and no open-weight models for $choice',
      async ({ choice, hosted }) => {
        render(WorkshopModelsGrid, { props: { models } })
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
      expect(hostedCards()).toHaveLength(0)
    })

    it('opens on the choice the address names and keeps it there', async () => {
      history.replaceState(null, '', '/hub/models/?use=run')
      render(WorkshopModelsGrid, { props: { models } })
      await nextTick()

      expect(hostedCards()).toHaveLength(models.length)
      expect(screen.getByTestId('models-hub-hero')).toBeTruthy()
      expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('1')

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /^Filter/ }))
      const dialog = await screen.findByRole('dialog', { name: 'Filter' })
      await user.click(
        within(dialog).getByRole('tab', { name: /^How you use it/ })
      )
      await user.click(within(dialog).getByRole('button', { name: /^API / }))
      expect(location.search).toBe('?use=run%2Capi')
      await user.click(within(dialog).getByTestId('workshop-filter-clear'))
      expect(location.search).toBe('')
    })

    it('lets go of the choice with the rest of the filters', async () => {
      render(WorkshopModelsGrid, { props: { models } })
      const { user, dialog } = await chooseAccess('API')
      await user.click(within(dialog).getByTestId('workshop-filter-clear'))

      expect(hostedCards()).toHaveLength(models.length)
      expect(screen.queryByTestId('workshop-filter-count')).toBeNull()
      expect(catalogueHeading()).toHaveTextContent(`${models.length}`)
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
