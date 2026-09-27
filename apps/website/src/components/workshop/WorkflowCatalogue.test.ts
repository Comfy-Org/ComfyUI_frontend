import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'

import type { WorkflowWorkshopModel } from '../../config/models-catalogue'
import WorkflowCatalogue from './WorkflowCatalogue.vue'

const models: WorkflowWorkshopModel[] = [
  {
    type: 'CLOUD',
    workflowId: 'restore',
    slug: 'workflows/restore',
    name: 'Restore a portrait',
    href: '/models/workflows/restore/',
    category: 'cleanup',
    categoryOrder: 4,
    recommendedRank: 1,
    workflowCount: 1,
    capabilities: [],
    models: ['SeedVR2']
  },
  {
    type: 'CLOUD',
    workflowId: 'connect',
    slug: 'workflows/connect',
    name: 'Connect two images',
    href: '/models/workflows/connect/',
    category: 'video',
    categoryOrder: 0,
    recommendedRank: 2,
    workflowCount: 1,
    capabilities: [],
    models: ['Wan 2.2', 'SeedVR2']
  },
  {
    type: 'CLOUD',
    workflowId: 'animate',
    slug: 'workflows/animate',
    name: 'Turn an image into a video',
    href: '/models/workflows/animate/',
    category: 'video',
    categoryOrder: 0,
    recommendedRank: 1,
    workflowCount: 1,
    capabilities: [],
    models: ['Wan 2.2']
  }
]

function visibleOutcomes() {
  return screen
    .getAllByTestId('workshop-model-card')
    .map((card) => card.getAttribute('href'))
}

beforeEach(() => history.replaceState(null, '', '/models/?type=workflows'))

describe('workflow catalogue ordering and shared links', () => {
  it('uses editorial category and outcome order, then sorts all results by name', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    await user.click(
      screen.getByRole('button', { name: 'Browse all workflows' })
    )
    expect(visibleOutcomes()).toEqual([
      '/models/workflows/animate/',
      '/models/workflows/connect/',
      '/models/workflows/restore/'
    ])
    await user.click(screen.getByTestId('workshop-sort'))
    await user.click(screen.getByTestId('sort-name'))
    expect(visibleOutcomes()).toEqual([
      '/models/workflows/connect/',
      '/models/workflows/restore/',
      '/models/workflows/animate/'
    ])
  })

  it('narrows the outcomes to the model they run on, and lets go of it', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('workshop-facet-model'))
    await user.click(await screen.findByTestId('filter-model-SeedVR2'))
    expect(visibleOutcomes()).toEqual([
      '/models/workflows/connect/',
      '/models/workflows/restore/'
    ])

    await user.click(screen.getByTestId('filter-model-Wan 2.2'))
    expect(visibleOutcomes()).toEqual([
      '/models/workflows/animate/',
      '/models/workflows/connect/',
      '/models/workflows/restore/'
    ])

    await user.click(screen.getByTestId('workshop-filter-clear'))
    expect(visibleOutcomes()).toEqual([
      '/models/workflows/animate/',
      '/models/workflows/connect/',
      '/models/workflows/restore/'
    ])
  })

  it('restores a known model from a shared URL and drops one it does not list', async () => {
    history.replaceState(
      null,
      '',
      '/models/?type=workflows&model=Wan+2.2&model=Nano+Banana'
    )
    render(WorkflowCatalogue, { props: { models } })
    await waitFor(() =>
      expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('1')
    )
    expect(visibleOutcomes()).toEqual([
      '/models/workflows/animate/',
      '/models/workflows/connect/'
    ])
  })

  it('restores search and known category filters from a shared URL', async () => {
    history.replaceState(
      null,
      '',
      '/models/?type=workflows&q=image&category=video&category=unknown'
    )
    render(WorkflowCatalogue, { props: { models } })
    await waitFor(() =>
      expect(screen.getByRole('searchbox')).toHaveValue('image')
    )
    expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('1')
    expect(visibleOutcomes()).toEqual([
      '/models/workflows/animate/',
      '/models/workflows/connect/'
    ])
  })
})
