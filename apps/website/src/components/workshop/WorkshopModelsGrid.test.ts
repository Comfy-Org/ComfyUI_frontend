import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { computed, nextTick } from 'vue'

import type { WorkshopModel } from '../../config/models-catalogue'
import { lastShelf } from '../../lib/workshop/shelf-memory'
import { useWorkshopAppsEnabled } from '../../scripts/posthog'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'

vi.mock(import('../../scripts/posthog'))

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
      screen.getByRole('heading', { level: 1, name: 'Edit images 1' })
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

  it('replaces a browsed section with a use-case filter', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'Edit images' }))
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filter' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Generate videos 1' })
    )

    expect(cardNames()).toEqual([expect.stringContaining('Kling AI')])
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

  it.for([
    { studio: true, lead: ['Cinematic Studio'] },
    { studio: false, lead: [] }
  ])(
    'keeps Flux 3 out of the featured models (studio flag $studio)',
    ({ studio, lead }) => {
      vi.mocked(useWorkshopAppsEnabled).mockReturnValue(computed(() => studio))
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
      ).toEqual([...lead, 'Seedream 5 Pro', 'Seedance 2 Fast'])
    }
  )

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
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
        'All models'
      )

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
      const heading = screen.getByRole('heading', { level: 1 })

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
