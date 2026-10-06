import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { nextTick } from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
import { OPEN_WEIGHT_MODELS } from '@/lib/workshop/explorer/open-weight-models'
import { lastShelf } from '@/lib/workshop/shelf-memory'
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
  return screen.queryAllByRole('link').map((card) => card.textContent)
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

  it('narrows the grid to one use case', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'Edit images' }))
    expect(
      screen.getByRole('heading', { level: 2, name: 'Edit images 1' })
    ).toBeTruthy()
    expect(cardNames()).toEqual([expect.stringContaining('Flux')])

    await user.click(screen.getByRole('button', { name: /Back to/ }))
    await user.click(screen.getByRole('button', { name: 'Generate videos' }))
    expect(cardNames()).toEqual([expect.stringContaining('Kling AI')])
  })

  it('returns the viewport to the top when a section or browse-all opens', async () => {
    const scrollTo = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined)
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'Edit images' }))
    await nextTick()
    await vi.waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 0 }))

    scrollTo.mockClear()
    await user.click(screen.getByRole('button', { name: /Back to/ }))
    await vi.waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 0 }))
    scrollTo.mockClear()
    await user.click(screen.getByRole('button', { name: 'Browse all models' }))
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

    await user.click(screen.getByRole('button', { name: 'Browse all models' }))
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filter' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Edit images 1' })
    )
    await user.click(within(dialog).getByTestId('workshop-filter-clear'))

    expect(
      screen.getByRole('heading', { level: 2, name: 'All models 3' })
    ).toBeTruthy()
    expect(screen.queryByTestId('workshop-hero')).toBeNull()
    expect(cardNames()).toHaveLength(3)
  })

  // A shelf and the filter are the same choice: opening "Edit images" has to
  // leave the menu saying so, or the reader sees a narrowed grid with nothing
  // anywhere to say what narrowed it.
  it('opens a shelf as the filter it is', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'Edit images' }))
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

    await user.click(screen.getByRole('button', { name: 'Edit images' }))
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filter' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Generate videos 1' })
    )

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

      await user.click(screen.getByRole('button', { name: 'Edit images' }))
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

    await user.click(screen.getByRole('button', { name: 'Edit images' }))
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

  it('keeps Flux 3 out of the featured models', () => {
    const featured = [
      {
        slug: 'byteplus--seedance-2-fast-text-to-video--generate-videos',
        name: 'Seedance 2 Fast',
        rank: 32
      },
      {
        slug: 'bfl--flux-3-text-to-video--generate-videos',
        name: 'FLUX.3 Video',
        rank: 63
      },
      {
        slug: 'byteplus--seedream-5-pro--generate-images',
        name: 'Seedream 5 Pro',
        rank: 0
      }
    ].map(({ slug, name, rank }) => ({
      ...models[0],
      slug,
      name,
      href: `/models/${slug}/`,
      recommendedRank: rank,
      thumbnailUrl: `https://example.com/${rank}.webp`
    }))

    render(WorkshopModelsGrid, { props: { models: featured } })

    const pagination = screen.getByTestId('featured-pagination')
    expect(
      within(pagination)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'))
    ).toEqual(['Seedream 5 Pro', 'Seedance 2 Fast'])
  })

  it('does not manufacture a return shelf before a model is opened', () => {
    sessionStorage.setItem('comfy-models-shelf', 'generate-videos')
    render(WorkshopModelsGrid, { props: { models } })

    expect(lastShelf('/models/kling-ai/')).toBeUndefined()
  })

  it('clears search and filters together from the empty state', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    await user.type(await search(), 'nothing')
    expect(screen.getByText('No models match')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(cardNames()).toHaveLength(3)
  })

  describe('browsing rows', () => {
    it('leaves the rows for the whole catalogue and back', async () => {
      const user = userEvent.setup()
      render(WorkshopModelsGrid, { props: { models } })
      expect(screen.getByTestId('workshop-sections')).toBeTruthy()

      await user.click(screen.getByTestId('browse-all-end'))

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
      await user.click(
        screen.getByRole('button', { name: 'Browse all models' })
      )
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
      await user.click(screen.getByTestId('browse-all-end'))

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

    function openWeightCards() {
      return screen.queryAllByTestId('open-weight-model-card')
    }

    it('offers the three ways to use a model with their counts', async () => {
      render(WorkshopModelsGrid, { props: { models } })
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

    it('links each open-weight model to its supported-models page', async () => {
      render(WorkshopModelsGrid, { props: { models } })
      await chooseAccess('Download')

      const [first] = openWeightCards()
      expect(first).toHaveAttribute(
        'href',
        `/p/supported-models/${OPEN_WEIGHT_MODELS[0].slug}/`
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
        ).map((model) => `/p/supported-models/${model.slug}/`)
      )
    })

    it('narrows open-weight models by the search', async () => {
      render(WorkshopModelsGrid, { props: { models } })
      const user = userEvent.setup()
      await user.type(await search(), 'kontext')
      await chooseAccess('Download')

      expect(openWeightCards()).toHaveLength(1)
      expect(openWeightCards()[0]).toHaveTextContent('Flux.1 Kontext Dev')
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
})
