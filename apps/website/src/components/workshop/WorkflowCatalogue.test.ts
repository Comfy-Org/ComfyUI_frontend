import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'

import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
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
    modality: 'image',
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
    modality: 'video',
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
    modality: 'video',
    categoryHighlight: true,
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

const ALL = [
  '/models/workflows/animate/',
  '/models/workflows/connect/',
  '/models/workflows/restore/'
]

beforeEach(() => history.replaceState(null, '', '/hub/workflows/'))

describe('workflow catalogue ordering and shared links', () => {
  it('opens on every workflow in one grid in recommended order, then by name', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })

    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
    expect(visibleOutcomes()).toEqual(ALL)
    expect(screen.queryByRole('button', { name: /Browse all/ })).toBeNull()
    expect(screen.queryByTestId('featured-banner')).toBeNull()

    await user.click(screen.getByTestId('workshop-sort'))
    await user.click(screen.getByTestId('sort-name'))
    expect(visibleOutcomes()).toEqual([
      '/models/workflows/connect/',
      '/models/workflows/restore/',
      '/models/workflows/animate/'
    ])
  })

  it('shows twelve workflows at a time and starts again when a search narrows them', async () => {
    const many: WorkflowWorkshopModel[] = Array.from(
      { length: 20 },
      (_, index) => ({
        ...models[0],
        workflowId: `restore-${index}`,
        slug: `workflows/restore-${index}`,
        name: `Restore portrait ${index}`,
        href: `/models/workflows/restore-${index}/`,
        recommendedRank: index
      })
    )
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models: many } })
    expect(visibleOutcomes()).toHaveLength(12)

    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(visibleOutcomes()).toHaveLength(20)
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()

    await user.type(screen.getByRole('searchbox'), 'portrait')
    expect(visibleOutcomes()).toHaveLength(12)
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
    expect(visibleOutcomes()).toEqual(ALL)
  })

  it('names the category it was narrowed by, and lets go of it from that name', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('workshop-facet-useCase'))
    await user.click(await screen.findByTestId('filter-useCase-video'))
    expect(screen.getByTestId('workshop-filter-chips')).toHaveTextContent(
      'video'
    )

    await user.click(screen.getByRole('button', { name: 'Remove video' }))
    expect(screen.queryByTestId('workshop-filter-chips')).toBeNull()
    expect(visibleOutcomes()).toEqual(ALL)
  })

  // A cross that cleared everything would pass a test that only ever set one
  // filter, so this one sets two and keeps the other.
  it('takes off the chip that was pressed and leaves the rest alone', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('workshop-facet-useCase'))
    await user.click(await screen.findByTestId('filter-useCase-video'))
    await user.click(await screen.findByTestId('workshop-facet-model'))
    await user.click(await screen.findByTestId('filter-model-SeedVR2'))

    await user.click(screen.getByRole('button', { name: 'Remove video' }))
    expect(screen.getByTestId('workshop-filter-chips')).toHaveTextContent(
      'Runs on SeedVR2'
    )
    expect(visibleOutcomes()).toEqual([
      '/models/workflows/connect/',
      '/models/workflows/restore/'
    ])
  })

  it('lets go of every filter from the chips and keeps what was searched for', async () => {
    history.replaceState(null, '', '/models/?type=workflows&q=video')
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    await waitFor(() =>
      expect(screen.getByRole('searchbox')).toHaveValue('video')
    )

    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('workshop-facet-model'))
    await user.click(await screen.findByTestId('filter-model-SeedVR2'))
    expect(visibleOutcomes()).toEqual(['/models/workflows/connect/'])

    await user.click(screen.getByTestId('workshop-filter-chips-clear'))
    expect(screen.getByRole('searchbox')).toHaveValue('video')
    expect(visibleOutcomes()).toEqual([
      '/models/workflows/animate/',
      '/models/workflows/connect/'
    ])
  })

  it('names the model it was narrowed by, and lets go of it from that name', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('workshop-facet-model'))
    await user.click(await screen.findByTestId('filter-model-SeedVR2'))
    expect(screen.getByTestId('workshop-filter-chips')).toHaveTextContent(
      'Runs on SeedVR2'
    )

    await user.click(
      screen.getByRole('button', { name: 'Remove Runs on SeedVR2' })
    )
    expect(screen.queryByTestId('workshop-filter-chips')).toBeNull()
    expect(visibleOutcomes()).toEqual(ALL)
  })

  it('restores a known model from a shared URL and drops one it does not list', async () => {
    history.replaceState(
      null,
      '',
      '/hub/workflows/?model=Wan+2.2&model=Nano+Banana'
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
      '/hub/workflows/?q=image&category=video&category=unknown'
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
