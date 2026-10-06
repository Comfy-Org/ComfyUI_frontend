import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { nextTick } from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
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

    await user.click(screen.getByRole('button', { name: 'Use cases' }))
    const dialog = await screen.findByRole('dialog', { name: 'Use cases' })
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
    await user.click(screen.getByRole('button', { name: 'Use cases' }))
    const dialog = await screen.findByRole('dialog', { name: 'Use cases' })
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

    await user.click(screen.getByRole('button', { name: 'Use cases' }))
    const dialog = await screen.findByRole('dialog', { name: 'Use cases' })
    expect(
      within(dialog).getByRole('button', { name: 'Edit images 1' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByText('1 selected')).toBeTruthy()
  })

  it('counts what the menu narrowed by, and lets go of it from the menu', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'Use cases' }))
    const dialog = await screen.findByRole('dialog', { name: 'Use cases' })
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

    await user.click(screen.getByRole('button', { name: 'Use cases' }))
    const dialog = await screen.findByRole('dialog', { name: 'Use cases' })
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
    await user.click(screen.getByRole('button', { name: 'Use cases' }))
    const dialog = await screen.findByRole('dialog', { name: 'Use cases' })
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

    await user.click(screen.getByRole('button', { name: 'Use cases' }))
    const dialog = await screen.findByRole('dialog', { name: 'Use cases' })
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

  describe('the address', () => {
    it('follows the filter and sort without adding history entries', async () => {
      const user = userEvent.setup()
      history.replaceState(null, '', '/hub/models/?utm_source=share')
      const entries = history.length
      render(WorkshopModelsGrid, { props: { models } })

      await user.click(screen.getByRole('button', { name: 'Use cases' }))
      const dialog = await screen.findByRole('dialog', { name: 'Use cases' })
      await user.click(
        within(dialog).getByRole('button', { name: 'Generate videos 1' })
      )
      await user.click(screen.getByRole('button', { name: 'Sort' }))
      await user.click(
        await screen.findByRole('menuitemradio', { name: 'Price: low to high' })
      )

      expect(location.search).toBe(
        '?utm_source=share&useCase=generate-videos&sort=priceAsc'
      )
      expect(history.length).toBe(entries)
    })

    it('lets Back undo opening and leaving a section', async () => {
      const user = userEvent.setup()
      history.replaceState(null, '', '/hub/models/')
      const entries = history.length
      render(WorkshopModelsGrid, { props: { models } })

      await user.click(screen.getByRole('button', { name: 'Edit images' }))
      expect(location.search).toBe('?useCase=edit-images')
      await user.click(screen.getByTestId('section-back'))
      expect(location.search).toBe('')
      await user.click(screen.getByTestId('browse-all-end'))
      expect(location.search).toBe('?view=all')
      expect(history.length).toBe(entries + 3)
    })

    it('follows the search once typing pauses', async () => {
      const user = userEvent.setup()
      history.replaceState(null, '', '/hub/models/')
      render(WorkshopModelsGrid, { props: { models } })

      await user.type(await search(), 'forest')

      await waitFor(() => expect(location.search).toBe('?q=forest'))
    })

    it('drops a pending search write once a navigation starts', async () => {
      const user = userEvent.setup()
      history.replaceState(null, '', '/hub/models/')
      render(WorkshopModelsGrid, { props: { models } })

      await user.type(await search(), 'forest')
      history.pushState({ index: 1 }, '', '/hub/models/')
      document.dispatchEvent(new Event('astro:before-preparation'))
      await vi.advanceTimersByTimeAsync(300)

      expect(location.search).toBe('')
    })

    it.for([
      ['?useCase=generate-videos&sort=name', /^Generate videos/, ['Kling AI']],
      ['?q=forest&view=all', /^All models/, ['Flux']]
    ] as const)(
      'reopens %s as it was left',
      async ([address, heading, names]) => {
        history.replaceState(null, '', `/hub/models/${address}`)
        render(WorkshopModelsGrid, { props: { models } })

        expect(
          await screen.findByRole('heading', { level: 2, name: heading })
        ).toBeTruthy()
        expect(cardNames()).toEqual(
          names.map((name) => expect.stringContaining(name))
        )
        expect(location.search).toBe(address)
      }
    )
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
})
