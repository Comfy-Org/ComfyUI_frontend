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

beforeEach(() => history.replaceState(null, '', '/hub/workflows/'))

describe('workflow catalogue ordering and shared links', () => {
  it('keeps the server-ranked page when query and model IDs are not card text', async () => {
    render(WorkflowCatalogue, {
      props: {
        models: [models[0], models[2]],
        initialSearch:
          '?q=semantic&model=canonical-model-uid&sort=name&p=3&cursor=current',
        serverPage: {
          mode: 'cursor',
          page: 3,
          pageSize: 24,
          count: 2,
          hasPrevious: true,
          hasNext: true
        },
        serverFacets: {
          categories: [],
          models: [{ value: 'canonical-model-uid', label: 'SeedVR2' }]
        }
      }
    })
    await waitFor(() =>
      expect(screen.getByTestId('workshop-filter-chips')).toHaveTextContent(
        'SeedVR2'
      )
    )
    expect(visibleOutcomes()).toEqual([
      '/models/workflows/restore/',
      '/models/workflows/animate/'
    ])
  })

  it.for([
    { locale: 'en' as const, label: 'Uncategorized' },
    { locale: 'zh-CN' as const, label: '未分类' }
  ])(
    'labels and filters workflows without a category in $locale',
    async ({ locale, label }) => {
      const user = userEvent.setup()
      render(WorkflowCatalogue, {
        props: {
          locale,
          models: [
            { ...models[0], category: undefined, name: 'No category' },
            { ...models[1], category: '', name: 'Blank category' },
            models[2]
          ]
        }
      })
      await user.click(screen.getByTestId('workshop-filter'))
      await user.click(await screen.findByTestId('workshop-facet-useCase'))
      expect(screen.getByTestId('filter-useCase-')).toHaveTextContent(label)
      await user.click(screen.getByTestId('filter-useCase-'))
      expect(screen.getByTestId('workshop-filter-chips')).toHaveTextContent(
        label
      )
      expect(visibleOutcomes()).toEqual([
        '/models/workflows/restore/',
        '/models/workflows/connect/'
      ])
    }
  )

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
    expect(visibleOutcomes()).toEqual([
      '/models/workflows/animate/',
      '/models/workflows/connect/',
      '/models/workflows/restore/'
    ])
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
    history.replaceState(null, '', '/models/?type=workflows&q=image')
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    await waitFor(() =>
      expect(screen.getByRole('searchbox')).toHaveValue('image')
    )

    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('workshop-facet-model'))
    await user.click(await screen.findByTestId('filter-model-SeedVR2'))
    expect(visibleOutcomes()).toEqual(['/models/workflows/connect/'])

    await user.click(screen.getByTestId('workshop-filter-chips-clear'))
    expect(screen.getByRole('searchbox')).toHaveValue('image')
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

  it('restores a known capability from a shared URL and drops one no workflow has', async () => {
    history.replaceState(
      null,
      '',
      '/hub/workflows/?capability=Upscale&capability=Unknown'
    )
    render(WorkflowCatalogue, {
      props: {
        models: [
          { ...models[0], capabilities: ['Upscale'] },
          ...models.slice(1)
        ]
      }
    })
    await waitFor(() =>
      expect(screen.getByTestId('workshop-filter-chips')).toHaveTextContent(
        'Upscale'
      )
    )
    expect(screen.getByTestId('workshop-filter-chips')).not.toHaveTextContent(
      'Unknown'
    )
    expect(visibleOutcomes()).toEqual(['/models/workflows/restore/'])
  })
})

describe('workflow catalogue capability address on the server-filtered list', () => {
  const serverPage = {
    mode: 'cursor' as const,
    page: 1,
    pageSize: 24,
    count: 2,
    hasPrevious: false,
    hasNext: false
  }
  const serverFacets = { categories: [], models: [] }

  it('opens the capability and search from the address as results, and keeps both in sync', async () => {
    const user = userEvent.setup()
    const { emitted } = render(WorkflowCatalogue, {
      props: {
        models: [models[1], models[2]],
        initialSearch: '?q=flux&capability=Image+Edit',
        serverPage,
        serverFacets
      }
    })
    await waitFor(() =>
      expect(screen.getByTestId('workshop-filter-chips')).toHaveTextContent(
        'Image Edit'
      )
    )
    expect(screen.getByRole('searchbox')).toHaveValue('flux')
    expect(screen.getByTestId('workflow-search-results')).toBeInTheDocument()

    await user.click(screen.getByTestId('workshop-sort'))
    await user.click(screen.getByTestId('sort-name'))
    await waitFor(() =>
      expect(emitted('search').at(-1)).toEqual([
        'q=flux&capability=Image+Edit&sort=name'
      ])
    )

    await user.click(screen.getByRole('button', { name: 'Remove Image Edit' }))
    await waitFor(() =>
      expect(emitted('search').at(-1)).toEqual(['q=flux&sort=name'])
    )
  })

  it('shows the empty result for a capability the server does not know, and clears it', async () => {
    const user = userEvent.setup()
    const { emitted } = render(WorkflowCatalogue, {
      props: {
        models: [],
        initialSearch: '?capability=Not+A+Capability',
        serverPage: { ...serverPage, count: 0 },
        serverFacets
      }
    })
    expect(
      await screen.findByText('No workflows match your search and filters.')
    ).toBeInTheDocument()
    expect(screen.getByTestId('workshop-filter-chips')).toHaveTextContent(
      'Not A Capability'
    )

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(emitted('search').at(-1)).toEqual(['']))
  })
})
