import userEvent from '@testing-library/user-event'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SEARCH_SETTLE_MS } from '@/composables/useHubCatalogueTracking'
import type { WorkshopModel } from '@/config/models-catalogue'
import { captureWorkshopEvent } from '@/scripts/posthog'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'

vi.mock(import('@/scripts/posthog'))

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
    thumbnailUrl: 'https://media.comfy.org/kling.webp'
  },
  {
    slug: 'flux',
    name: 'Flux',
    workflowCount: 2,
    href: '/models/flux/',
    routerId: 'bfl/flux',
    capabilities: [],
    provider: 'Black Forest Labs',
    modality: 'image',
    task: 'image-to-image'
  }
]

const events = (name: string) =>
  vi
    .mocked(captureWorkshopEvent)
    .mock.calls.map(([event]) => event)
    .filter((event) => event.name === name)

async function searchbox() {
  const field = screen.getByRole('searchbox', {
    name: 'Search models, providers, and categories'
  })
  await waitFor(() => expect(field).not.toHaveProperty('disabled', true))
  return field
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  history.replaceState(null, '', '/')
  sessionStorage.clear()
})

describe('WorkshopModelsGrid analytics', () => {
  it('reports a search once it settles, with how many models it found', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(WorkshopModelsGrid, { props: { models } })

    await user.type(await searchbox(), 'Forest')
    expect(events('hub_search_performed')).toEqual([])

    vi.advanceTimersByTime(SEARCH_SETTLE_MS)
    expect(events('hub_search_performed')).toEqual([
      {
        name: 'hub_search_performed',
        properties: {
          surface: 'models',
          query: 'forest',
          query_length: 6,
          results_count: 1
        }
      }
    ])
  })

  it('reports a search at once on Enter', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.type(await searchbox(), 'kling{Enter}')

    expect(events('hub_search_performed')).toHaveLength(1)
  })

  it('waits for an input method to finish composing before Enter searches', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(WorkshopModelsGrid, { props: { models } })
    const field = await searchbox()
    await user.type(field, 'kling')

    // userEvent cannot mark a key press as part of an IME composition.
    // oxlint-disable-next-line testing-library/prefer-user-event
    await fireEvent.keyDown(field, { key: 'Enter', isComposing: true })
    expect(events('hub_search_performed')).toEqual([])

    await user.keyboard('{Enter}')
    expect(events('hub_search_performed')).toHaveLength(1)
  })

  it('reports the use case and sort a visitor picks', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'Use cases' }))
    const dialog = await screen.findByRole('dialog', { name: 'Use cases' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Edit images 1' })
    )
    await user.click(screen.getByRole('button', { name: 'Sort' }))
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'Name A to Z' })
    )

    expect(events('hub_filter_changed')).toEqual([
      {
        name: 'hub_filter_changed',
        properties: {
          surface: 'models',
          filter: 'use_case',
          value: 'edit-images',
          previous_value: 'all'
        }
      },
      {
        name: 'hub_filter_changed',
        properties: {
          surface: 'models',
          filter: 'sort',
          value: 'name',
          previous_value: 'popular'
        }
      }
    ])
  })

  it('stays silent about the search and use case a shared link sets', async () => {
    history.replaceState(null, '', '/models/?q=flux&useCase=edit-images')
    render(WorkshopModelsGrid, { props: { models } })
    await waitFor(async () => expect(await searchbox()).toHaveValue('flux'))

    vi.advanceTimersByTime(SEARCH_SETTLE_MS)
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
  })

  it('reports a model opened from the featured banner', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByTestId('featured-slide-link'))

    expect(events('hub_item_clicked')).toEqual([
      {
        name: 'hub_item_clicked',
        properties: {
          surface: 'models',
          kind: 'model',
          slug: 'kling-ai',
          source: 'featured_banner',
          position: 0
        }
      }
    ])
  })

  it('reports a model opened from the results grid', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'Browse all models' }))
    await user.click(
      within(screen.getByTestId('workshop-models-grid')).getAllByRole('link')[1]
    )

    expect(events('hub_item_clicked')).toEqual([
      {
        name: 'hub_item_clicked',
        properties: {
          surface: 'models',
          kind: 'model',
          slug: 'flux',
          source: 'results_grid',
          position: 1
        }
      }
    ])
  })

  it('reports the search a result was opened under', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.type(await searchbox(), ' Flux {Enter}')
    await user.click(
      within(screen.getByTestId('workshop-models-grid')).getByRole('link')
    )

    expect(events('hub_item_clicked')).toEqual([
      {
        name: 'hub_item_clicked',
        properties: {
          surface: 'models',
          kind: 'model',
          slug: 'flux',
          source: 'results_grid',
          position: 0,
          query: 'flux'
        }
      }
    ])
  })

  it('reports a search still settling before the result opened under it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { unmount } = render(WorkshopModelsGrid, { props: { models } })

    await user.type(await searchbox(), 'Flux')
    await user.click(
      within(screen.getByTestId('workshop-models-grid')).getByRole('link')
    )
    unmount()
    vi.advanceTimersByTime(SEARCH_SETTLE_MS)

    expect(
      vi
        .mocked(captureWorkshopEvent)
        .mock.calls.map(([event]) => event)
        .filter((event) => event.name !== 'hub_filter_changed')
    ).toEqual([
      {
        name: 'hub_search_performed',
        properties: {
          surface: 'models',
          query: 'flux',
          query_length: 4,
          results_count: 1
        }
      },
      {
        name: 'hub_item_clicked',
        properties: {
          surface: 'models',
          kind: 'model',
          slug: 'flux',
          source: 'results_grid',
          position: 0,
          query: 'flux'
        }
      }
    ])
  })
})
