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
import { OPEN_WEIGHT_MODELS } from '@/lib/workshop/explorer/open-weight-models'
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

  it('opens the use case the address names and goes back to Trending', async () => {
    history.replaceState(null, '', '/models/?useCase=edit-images')
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Edit images 1' })
    ).toBeTruthy()
    expect(cardNames()).toEqual([expect.stringContaining('Flux')])
    expect(openWeightCards()).toEqual([])

    await user.click(screen.getByRole('button', { name: /Back to/ }))
    expect(
      screen.getByRole('heading', { level: 2, name: 'Trending' })
    ).toBeTruthy()
    expect(cardNames()).toHaveLength(3)
  })

  it('returns the viewport to the top when a section or browse-all opens', async () => {
    const scrollTo = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined)
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await pickUseCase(user, 'Edit images 1')
    await nextTick()
    await vi.waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 0 }))

    scrollTo.mockClear()
    await user.click(screen.getByRole('button', { name: /Back to/ }))
    await vi.waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 0 }))
    scrollTo.mockClear()
    await user.click(screen.getByRole('button', { name: 'View all models' }))
    await vi.waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 0 }))
    scrollTo.mockRestore()
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

  it('clears the filters without leaving Browse all models', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'View all models' }))
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
    expect(screen.queryByTestId('workshop-hero')).toBeNull()
    expect(cardNames()).toHaveLength(3)
    expect(openWeightCards()).toEqual([])
  })

  it('finds open-weight models under All once the visitor searches', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    await user.click(screen.getByRole('button', { name: 'View all models' }))
    expect(openWeightCards()).toEqual([])

    await user.type(await search(), 'kontext')
    expect(openWeightCards().map((card) => card.textContent)).toEqual([
      expect.stringContaining('Flux1 Dev Kontext')
    ])
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

  it('leaves the Trending row for the full list sorted by name', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    expect(
      screen.getByRole('heading', { level: 2, name: 'Trending' })
    ).toBeTruthy()

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

    it('opens on the hero, Trending, the ways in and a model family', () => {
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
      ).toHaveAttribute('href', '/hub/models/?use=run')
      expect(screen.getByTestId('models-hub-counts')).toHaveTextContent(
        `${hub.length + OPEN_WEIGHT_MODELS.length} models · ${OPEN_WEIGHT_MODELS.length} open weights · ${hub.length} partner models`
      )
      expect(screen.getByTestId('models-hub-latest')).toHaveTextContent(
        'Seedance 2.5 Text-to-Video'
      )
      expect(
        screen.getByRole('heading', { level: 2, name: 'Trending' })
      ).toBeTruthy()
      expect(
        within(screen.getByTestId('model-access-open')).getByText(
          'Browse open weights'
        )
      ).toBeTruthy()
      expect(screen.getByTestId('model-access-open').getAttribute('href')).toBe(
        '/hub/models/?tab=open'
      )
      const family = screen.getByRole('region', {
        name: 'Explore model families'
      })
      expect(
        within(family).getByRole('link', { name: 'Wan 3.0' })
      ).toHaveAttribute('href', '/hub/models/?q=Wan+3.0')
      expect(
        within(family).getByRole('link', { name: 'Wan 2.2 (open)' })
      ).toHaveAttribute('href', '/hub/models/?q=Wan2.2')
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
      'gives the hero and its sections away to $narrowing',
      async ({ address }) => {
        history.replaceState(null, '', address)
        const { emitted } = render(WorkshopModelsGrid, {
          props: { models: hub }
        })
        await nextTick()

        expect(screen.queryByTestId('models-hub-hero')).toBeNull()
        expect(screen.queryByTestId('model-access')).toBeNull()
        expect(screen.queryByTestId('model-family')).toBeNull()
        expect(emitted().hero.at(-1)).toEqual([false])
      }
    )
  })

  describe('browsing rows', () => {
    it('leaves the rows for the whole catalogue and back', async () => {
      const user = userEvent.setup()
      render(WorkshopModelsGrid, { props: { models } })
      expect(screen.getByTestId('workshop-sections')).toBeTruthy()

      await user.click(screen.getByTestId('section-trending-see-all'))

      expect(screen.queryByTestId('workshop-sections')).toBeNull()
      expect(cardNames()).toHaveLength(models.length)
      expect(
        screen.getByRole('heading', { level: 2, name: /^All models/ })
      ).toBeTruthy()
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull()

      await user.click(screen.getByTestId('section-back'))
      expect(screen.getByTestId('workshop-sections')).toBeTruthy()
    })

    it('clears active filters when returning to the category rows', async () => {
      const user = userEvent.setup()
      render(WorkshopModelsGrid, { props: { models } })
      await user.click(screen.getByRole('button', { name: 'View all models' }))
      const field = await search()
      await user.type(field, 'forest')
      expect(cardNames()).toEqual([expect.stringContaining('Flux')])

      await user.click(screen.getByRole('button', { name: /Back to/ }))

      expect(field).toHaveProperty('value', '')
      expect(screen.getByTestId('workshop-sections')).toBeTruthy()
    })

    it('leaves the heading above the toolbar holding the controls', async () => {
      const user = userEvent.setup()
      render(WorkshopModelsGrid, { props: { models } })
      await user.click(screen.getByTestId('section-trending-see-all'))

      const toolbar = screen.getByTestId('workshop-toolbar')
      const heading = screen.getByRole('heading', {
        level: 2,
        name: /^All models/
      })

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

    it('offers the three ways to use a model with their counts', async () => {
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

      for (const name of [
        `Run here ${models.length}`,
        `API ${models.length}`,
        `Download ${OPEN_WEIGHT_MODELS.length}`
      ])
        expect(within(dialog).getByRole('button', { name })).toHaveAttribute(
          'aria-pressed',
          'false'
        )
    })

    it.for([
      { choice: ['Run here'], hosted: 3, openWeight: 0 },
      { choice: ['API'], hosted: 3, openWeight: 0 },
      {
        choice: ['Download'],
        hosted: 0,
        openWeight: OPEN_WEIGHT_MODELS.length
      },
      {
        choice: ['Run here', 'Download'],
        hosted: 3,
        openWeight: OPEN_WEIGHT_MODELS.length
      }
    ])(
      'lists $hosted hosted and $openWeight open-weight models for $choice',
      async ({ choice, hosted, openWeight }) => {
        render(WorkshopModelsGrid, { props: { models } })
        await chooseAccess(...choice)

        expect(hostedCards()).toHaveLength(hosted)
        expect(openWeightCards()).toHaveLength(openWeight)
        expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent(
          String(choice.length)
        )
      }
    )

    it('links each open-weight model to its model file page', async () => {
      render(WorkshopModelsGrid, { props: { models } })
      await chooseAccess('Download')

      const [first] = openWeightCards()
      expect(first).toHaveAttribute(
        'href',
        `/hub/models/local/${OPEN_WEIGHT_MODELS[0].slug}/`
      )
      expect(
        within(first).getByTestId('model-access-badges')
      ).toHaveTextContent(/^\s*Download\s*$/)
    })

    it('narrows open-weight models by use case', async () => {
      render(WorkshopModelsGrid, { props: { models } })
      const { user, dialog } = await chooseAccess('Download')
      await user.click(within(dialog).getByRole('tab', { name: /Use cases/ }))
      await user.click(
        within(dialog).getByRole('button', { name: 'Edit images 1' })
      )

      expect(
        openWeightCards().map((card) => card.getAttribute('href'))
      ).toEqual(
        OPEN_WEIGHT_MODELS.filter(
          (model) => model.useCase === 'edit-images'
        ).map((model) => `/hub/models/local/${model.slug}/`)
      )
    })

    it('narrows open-weight models by the search', async () => {
      render(WorkshopModelsGrid, { props: { models } })
      const user = userEvent.setup()
      await user.type(await search(), 'kontext')
      await chooseAccess('Download')

      expect(openWeightCards()).toHaveLength(1)
      expect(openWeightCards()[0]).toHaveTextContent('Flux1 Dev Kontext')
    })

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
      expect(screen.queryByTestId('models-hub-hero')).toBeNull()
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
      const { user, dialog } = await chooseAccess('Download')
      await user.click(within(dialog).getByTestId('workshop-filter-clear'))

      expect(openWeightCards()).toHaveLength(0)
      expect(screen.queryByTestId('workshop-filter-count')).toBeNull()
      expect(screen.getByTestId('workshop-sections')).toBeTruthy()
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

    async function browseAll() {
      const user = userEvent.setup()
      render(WorkshopModelsGrid, { props: { models: [...models, fourth] } })
      await user.click(screen.getByTestId('section-trending-see-all'))
      return user
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
      const user = await browseAll()
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
      const user = await browseAll()
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
          .map((link) => link.textContent.trim())
      ).toEqual(['Try Kling AI', 'Try Seedream'])
      expect(within(dialog).getAllByTestId('compare-thumbnail')).toHaveLength(2)
      expect(within(dialog).queryByText('Model page')).toBeNull()

      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(location.hash).toBe('')
    })

    it('opens from #compare only once two models are chosen', async () => {
      const user = await browseAll()
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
