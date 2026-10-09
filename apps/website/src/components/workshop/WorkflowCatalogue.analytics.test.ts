import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SEARCH_SETTLE_MS } from '@/composables/useHubCatalogueTracking'
import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import { captureWorkshopEvent } from '@/scripts/posthog'
import WorkflowCatalogue from './WorkflowCatalogue.vue'

vi.mock(import('@/scripts/posthog'))

function workflow(
  name: string,
  category: string,
  recommendedRank: number,
  models: string[]
): WorkflowWorkshopModel {
  return {
    type: 'CLOUD',
    workflowId: name,
    slug: `workflows/${name}`,
    name,
    href: `/hub/workflows/${name}/`,
    category,
    categoryOrder: category === 'video' ? 0 : 1,
    recommendedRank,
    workflowCount: 1,
    capabilities: [],
    models
  }
}

const models = [
  workflow('restore', 'cleanup', 1, ['SeedVR2']),
  workflow('connect', 'video', 2, ['Wan 2.2', 'SeedVR2']),
  workflow('animate', 'video', 1, ['Wan 2.2'])
]

const events = (name: string) =>
  vi
    .mocked(captureWorkshopEvent)
    .mock.calls.map(([event]) => event)
    .filter((event) => event.name === name)

async function searchbox() {
  const field = screen.getByRole('searchbox')
  await waitFor(() => expect(field).not.toHaveProperty('disabled', true))
  return field
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  history.replaceState(null, '', '/hub/workflows/')
})

describe('WorkflowCatalogue analytics', () => {
  it('reports a search on Enter with how many workflows it found', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })

    await user.type(await searchbox(), 'Restore{Enter}')

    expect(events('hub_search_performed')).toEqual([
      {
        name: 'hub_search_performed',
        properties: {
          surface: 'workflows',
          query: 'restore',
          query_length: 7,
          results_count: 1
        }
      }
    ])
  })

  it('reports the filters a visitor picks but not those a shared link sets', async () => {
    history.replaceState(null, '', '/hub/workflows/?q=image&category=video')
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    await waitFor(() =>
      expect(screen.getByRole('searchbox')).toHaveValue('image')
    )
    vi.advanceTimersByTime(SEARCH_SETTLE_MS)
    expect(captureWorkshopEvent).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('workshop-facet-model'))
    await user.click(await screen.findByTestId('filter-model-SeedVR2'))
    await user.click(screen.getByRole('button', { name: 'Remove video' }))

    expect(events('hub_filter_changed')).toEqual([
      {
        name: 'hub_filter_changed',
        properties: {
          surface: 'workflows',
          filter: 'model',
          value: 'SeedVR2',
          previous_value: 'all'
        }
      },
      {
        name: 'hub_filter_changed',
        properties: {
          surface: 'workflows',
          filter: 'category',
          value: 'all',
          previous_value: 'video'
        }
      }
    ])
  })

  it('reports a workflow opened from the featured banner', async () => {
    const user = userEvent.setup()
    const highlighted = models.map((model) => ({
      ...model,
      categoryHighlight: model.workflowId === 'restore'
    }))
    render(WorkflowCatalogue, { props: { models: highlighted } })

    await user.click(screen.getByTestId('featured-slide-link'))

    expect(events('hub_item_clicked')).toEqual([
      {
        name: 'hub_item_clicked',
        properties: {
          surface: 'workflows',
          kind: 'workflow',
          slug: 'workflows/restore',
          source: 'featured_banner',
          position: 0
        }
      }
    ])
  })

  it('reports a workflow opened from a category row', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })

    await user.click(
      within(screen.getByTestId('workflow-category-video')).getAllByTestId(
        'workshop-model-card'
      )[1]
    )

    expect(events('hub_item_clicked')).toEqual([
      {
        name: 'hub_item_clicked',
        properties: {
          surface: 'workflows',
          kind: 'workflow',
          slug: 'workflows/connect',
          source: 'category_row',
          position: 1,
          row: 'video'
        }
      }
    ])
  })

  it('keeps the category row for a workflow whose category is empty', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, {
      props: { models: [...models, workflow('loose', '', 1, ['SeedVR2'])] }
    })

    await user.click(
      within(screen.getByTestId('workflow-category-')).getAllByTestId(
        'workshop-model-card'
      )[0]
    )

    expect(events('hub_item_clicked')).toEqual([
      {
        name: 'hub_item_clicked',
        properties: {
          surface: 'workflows',
          kind: 'workflow',
          slug: 'workflows/loose',
          source: 'category_row',
          position: 0,
          row: ''
        }
      }
    ])
    expect(events('hub_search_performed')).toEqual([])
  })

  it('reports a workflow opened from the search results with the search', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    await user.type(await searchbox(), 'o')
    await user.click(screen.getAllByTestId('workshop-model-card')[2])

    expect(events('hub_item_clicked')).toEqual([
      {
        name: 'hub_item_clicked',
        properties: {
          surface: 'workflows',
          kind: 'workflow',
          slug: 'workflows/restore',
          source: 'results_grid',
          position: 2,
          query: 'o'
        }
      }
    ])
  })

  it('reports a search still settling before the result opened under it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { unmount } = render(WorkflowCatalogue, { props: { models } })

    await user.type(await searchbox(), 'Restore')
    await user.click(screen.getByTestId('workshop-model-card'))
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
          surface: 'workflows',
          query: 'restore',
          query_length: 7,
          results_count: 1
        }
      },
      {
        name: 'hub_item_clicked',
        properties: {
          surface: 'workflows',
          kind: 'workflow',
          slug: 'workflows/restore',
          source: 'results_grid',
          position: 0,
          query: 'restore'
        }
      }
    ])
  })
})
