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
    capabilities: []
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
    capabilities: []
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
    capabilities: []
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
