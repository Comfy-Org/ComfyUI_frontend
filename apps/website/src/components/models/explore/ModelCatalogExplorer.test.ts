// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'

import ModelCatalogExplorer from './ModelCatalogExplorer.vue'
import type { ExploreModelCardFixture } from './modelExploreFixtures'

const props = {
  catalog: [
    {
      slug: 'wan-video',
      title: 'Wan Video',
      href: '/p/supported-models/wan-video',
      directory: 'diffusion_models' as const,
      workflowCount: 4,
      categories: ['video'] as const,
      mediaTone: 'plum' as const,
      searchText: 'wan video diffusion_models video'
    },
    {
      slug: 'partner-image',
      title: 'Partner Image',
      href: '/p/supported-models/partner-image',
      directory: 'partner_nodes' as const,
      workflowCount: 2,
      categories: ['image'] as const,
      mediaTone: 'ember' as const,
      searchText: 'partner image partner_nodes image'
    }
  ],
  categoryOptions: [
    { value: 'all' as const, label: 'ALL' },
    { value: 'image' as const, label: 'Image' },
    { value: 'video' as const, label: 'Video' },
    { value: 'open' as const, label: 'Open Source' },
    { value: 'partner' as const, label: 'Partner Nodes' }
  ],
  categoryLabel: 'Model categories',
  searchLabel: 'Search supported models',
  searchPlaceholder: 'Search models...',
  workflowCountOne: 'Used by {count} supported workflow.',
  workflowCountMany: 'Used by {count} supported workflows.',
  partnerLabel: 'Partner API',
  resultCountLabel: '{count} matching models',
  emptyLabel: 'No supported models match this search yet.',
  showMoreLabel: 'Click to show more'
}

describe('ModelCatalogExplorer', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/p/supported-models')
  })

  it('keeps the catalog hidden while filtering collections unless explicitly opened', async () => {
    render(ModelCatalogExplorer, {
      props: {
        ...props,
        showCatalogOnFilter: false,
        catalogLabel: 'MODEL CATALOG'
      }
    })
    await userEvent.click(screen.getByRole('radio', { name: 'Image' }))
    expect(screen.queryByRole('region', { name: 'MODEL CATALOG' })).toBeNull()
    await userEvent.type(screen.getByRole('searchbox'), 'partner')
    expect(screen.queryByRole('region', { name: 'MODEL CATALOG' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Partner Image' })).toBeNull()
  })

  it('reveals route-backed results for a search query', async () => {
    render(ModelCatalogExplorer, { props })

    expect(screen.queryByRole('link', { name: 'Wan Video' })).toBeNull()

    await userEvent.type(
      screen.getByRole('searchbox', { name: props.searchLabel }),
      'wan'
    )

    expect(screen.getByRole('status').textContent).toBe('1 matching models')
    expect(
      screen.getByRole('link', { name: 'Wan Video' }).getAttribute('href')
    ).toBe('/p/supported-models/wan-video')
    expect(screen.getByText('Used by 4 supported workflows.')).toBeTruthy()
  })

  it('expands results in batches of eight and resets for a new search or filter', async () => {
    const catalog = props.catalog.flatMap((model) =>
      Array.from({ length: 9 }, (_, index) => ({
        ...model,
        slug: `${model.slug}-${index}`,
        title: `${model.title} ${index}`,
        searchText: `model ${model.searchText}`
      }))
    )
    render(ModelCatalogExplorer, {
      props: { ...props, catalog, showCatalogByDefault: true }
    })
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(8)
    await userEvent.click(
      screen.getByRole('button', { name: props.showMoreLabel })
    )
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(16)
    await userEvent.click(
      screen.getByRole('button', { name: props.showMoreLabel })
    )
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(18)
    expect(
      screen.queryByRole('button', { name: props.showMoreLabel })
    ).toBeNull()

    await userEvent.type(screen.getByRole('searchbox'), 'model')
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(8)
    await userEvent.click(
      screen.getByRole('button', { name: props.showMoreLabel })
    )
    await userEvent.click(screen.getByRole('radio', { name: 'Image' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(8)
    expect(screen.getByRole('status').textContent).toBe('9 matching models')
    await userEvent.click(
      screen.getByRole('button', { name: props.showMoreLabel })
    )
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(9)
    expect(
      screen.queryByRole('button', { name: props.showMoreLabel })
    ).toBeNull()
  })

  it('filters the generated catalog from the governed category tabs', async () => {
    render(ModelCatalogExplorer, { props })

    await userEvent.click(screen.getByRole('radio', { name: 'Image' }))

    expect(screen.getByRole('link', { name: 'Partner Image' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Wan Video' })).toBeNull()
    expect(screen.getByText('Partner API')).toBeTruthy()
  })

  it.for([
    {
      filter: 'Open Source',
      includedModel: 'Wan Video',
      excludedModel: 'Partner Image'
    },
    {
      filter: 'Partner Nodes',
      includedModel: 'Partner Image',
      excludedModel: 'Wan Video'
    }
  ])(
    'filters the catalog with the $filter access tab',
    async ({ filter, includedModel, excludedModel }) => {
      render(ModelCatalogExplorer, {
        props: { ...props, showCatalogByDefault: true }
      })

      await userEvent.click(screen.getByRole('radio', { name: filter }))

      expect(screen.getByRole('link', { name: includedModel })).toBeTruthy()
      expect(screen.queryByRole('link', { name: excludedModel })).toBeNull()
    }
  )

  it('clears the access filter when a media category is selected', async () => {
    render(ModelCatalogExplorer, {
      props: { ...props, showCatalogByDefault: true }
    })

    await userEvent.click(screen.getByRole('radio', { name: 'Partner Nodes' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Video' }))

    expect(screen.getByRole('link', { name: 'Wan Video' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Partner Image' })).toBeNull()
  })

  it('reveals the complete catalog from the collection action URL', async () => {
    window.history.replaceState(
      {},
      '',
      '/p/supported-models?catalog=all#model-catalog-results'
    )

    render(ModelCatalogExplorer, { props })

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Wan Video' })).toBeTruthy()
      expect(screen.getByRole('link', { name: 'Partner Image' })).toBeTruthy()
    })
  })

  it.for([
    {
      filter: 'Image',
      expected: ['Partner image version', 'Open image version']
    },
    { filter: 'Video', expected: ['Partner video version'] },
    { filter: 'Open Source', expected: ['Open image version'] },
    {
      filter: 'Partner Nodes',
      expected: ['Partner image version', 'Partner video version']
    }
  ])(
    'filters Trending and Latest with $filter',
    async ({ filter, expected }) => {
      const models: ExploreModelCardFixture[] = [
        {
          name: 'Partner image version',
          modality: 'image',
          href: '/partner-image-version',
          target: '_self',
          description: 'Generate pictures',
          tag: 'Partner API',
          media: { type: 'placeholder', tone: 'plum' }
        },
        {
          name: 'Partner video version',
          modality: 'video',
          href: '/partner-video-version',
          target: '_self',
          description: 'Generate motion',
          tag: 'Partner API',
          media: { type: 'placeholder', tone: 'plum' }
        },
        {
          name: 'Open image version',
          modality: 'image',
          href: '/open-image-version',
          target: '_self',
          description: 'Generate pictures',
          tag: 'Open weights',
          statuses: ['open-weights'],
          media: { type: 'placeholder', tone: 'plum' }
        }
      ]
      render(ModelCatalogExplorer, {
        props: {
          ...props,
          defaultModels: models,
          showCatalogOnFilter: false,
          catalogLabel: 'MODEL CATALOG',
          collectionHeadingId: 'trending-heading',
          collectionLabel: 'TRENDING',
          latestCollection: {
            models,
            headingId: 'latest-heading',
            label: 'LATEST',
            description: 'New models'
          }
        }
      })
      await userEvent.click(screen.getByRole('radio', { name: filter }))
      expect(screen.queryByRole('region', { name: 'MODEL CATALOG' })).toBeNull()
      const trending = within(screen.getByRole('region', { name: 'TRENDING' }))
      const latest = within(screen.getByRole('region', { name: 'LATEST' }))
      expect(
        trending
          .getAllByRole('heading', { level: 3 })
          .map((heading) => heading.textContent)
      ).toEqual(expected)
      expect(
        latest
          .getAllByRole('heading', { level: 3 })
          .map((heading) => heading.textContent)
      ).toEqual(expected)
      await userEvent.type(screen.getByRole('searchbox'), 'no-such-model')
      expect(trending.queryAllByRole('heading', { level: 3 })).toHaveLength(0)
      expect(latest.queryAllByRole('heading', { level: 3 })).toHaveLength(0)
      expect(trending.getByText(props.emptyLabel)).toBeTruthy()
      expect(latest.getByText(props.emptyLabel)).toBeTruthy()
      await userEvent.clear(screen.getByRole('searchbox'))
      await userEvent.click(screen.getByRole('radio', { name: 'ALL' }))
      expect(trending.getAllByRole('heading', { level: 3 })).toHaveLength(3)
      expect(latest.getAllByRole('heading', { level: 3 })).toHaveLength(3)
    }
  )

  it('preserves the selected category and search in both collection links and browser history', async () => {
    render(ModelCatalogExplorer, {
      props: {
        ...props,
        showCatalogOnFilter: false,
        defaultModels: [],
        collectionHeadingId: 'trending',
        collectionLabel: 'TRENDING',
        collectionActionLabel: 'VIEW ALL MODELS',
        collectionActionHref:
          '/p/supported-models/?catalog=all#model-catalog-results',
        latestCollection: {
          models: [],
          headingId: 'latest',
          label: 'LATEST',
          description: 'Latest releases'
        }
      }
    })
    await userEvent.click(screen.getByRole('radio', { name: 'Video' }))
    await userEvent.type(screen.getByRole('searchbox'), 'wan')
    expect(window.location.search).toBe('?category=video&q=wan')
    expect(
      within(screen.getByRole('region', { name: 'TRENDING' })).getByRole(
        'link',
        { name: 'VIEW ALL MODELS' }
      )
    ).toHaveAttribute(
      'href',
      '/p/supported-models/?collection=trending&category=video&q=wan#trending-models'
    )
    expect(
      within(screen.getByRole('region', { name: 'LATEST' })).getByRole('link', {
        name: 'VIEW ALL MODELS'
      })
    ).toHaveAttribute(
      'href',
      '/p/supported-models/?collection=latest&category=video&q=wan#latest'
    )
    window.history.replaceState(
      {},
      '',
      '?catalog=all&access=partner&q=partner#model-catalog-results'
    )
    window.dispatchEvent(new PopStateEvent('popstate'))
    await waitFor(() =>
      expect(screen.getByRole('searchbox')).toHaveValue('partner')
    )
    expect(screen.getByRole('region', { name: 'TRENDING' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'LATEST' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Partner Image' })).toBeNull()
    expect(window.location.search).toBe('?access=partner&q=partner')
    expect(window.location.hash).toBe('')
  })

  it('shows the complete Latest collection in chronological order without a catalog', async () => {
    window.history.replaceState({}, '', '?collection=latest')
    const models: ExploreModelCardFixture[] = Array.from(
      { length: 6 },
      (_, index) => ({
        name: `Release ${index + 1}`,
        href: `/release-${index + 1}`,
        target: '_self',
        modality: 'image',
        description: 'An image model',
        tag: 'Partner API',
        releasedAt: `2026-0${index + 1}-01`,
        media: { type: 'placeholder', tone: 'plum' }
      })
    )
    render(ModelCatalogExplorer, {
      props: {
        ...props,
        defaultModels: models,
        collectionHeadingId: 'trending',
        collectionLabel: 'TRENDING',
        latestCollection: {
          models,
          headingId: 'latest',
          label: 'LATEST',
          description: 'Latest releases'
        }
      }
    })
    const latest = await screen.findByRole('region', { name: 'LATEST' })
    expect(
      within(latest)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual([
      'Release 6',
      'Release 5',
      'Release 4',
      'Release 3',
      'Release 2',
      'Release 1'
    ])
    expect(screen.getByRole('region', { name: 'TRENDING' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Partner Image' })).toBeNull()
  })

  it('shows the complete catalog by default on the dedicated page', () => {
    render(ModelCatalogExplorer, {
      props: { ...props, showCatalogByDefault: true }
    })

    expect(screen.getByRole('link', { name: 'Wan Video' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Partner Image' })).toBeTruthy()
  })

  it.for([
    {
      access: 'open',
      includedModel: 'Wan Video',
      excludedModel: 'Partner Image'
    },
    {
      access: 'partner',
      includedModel: 'Partner Image',
      excludedModel: 'Wan Video'
    }
  ])(
    'filters the dedicated catalog to $access models from the URL',
    async ({ access, includedModel, excludedModel }) => {
      window.history.replaceState(
        {},
        '',
        `/p/supported-models/all?access=${access}`
      )

      render(ModelCatalogExplorer, {
        props: { ...props, showCatalogByDefault: true }
      })

      await waitFor(() => {
        expect(
          screen
            .getByRole('radio', {
              name: access === 'open' ? 'Open Source' : 'Partner Nodes'
            })
            .getAttribute('data-state')
        ).toBe('checked')
        expect(screen.getByRole('status').textContent).toBe('1 matching models')
        expect(screen.getByRole('link', { name: includedModel })).toBeTruthy()
        expect(screen.queryByRole('link', { name: excludedModel })).toBeNull()
      })
    }
  )
})

it('loads the next batch in the full directory and resets pagination on search', async () => {
  const user = userEvent.setup()
  const catalog = Array.from({ length: 25 }, (_, index) => ({
    ...props.catalog[0],
    slug: `model-${index}`,
    title: `Model ${index}`,
    href: `/p/supported-models/model-${index}`,
    searchText: `model ${index}`
  }))
  render(ModelCatalogExplorer, {
    props: {
      ...props,
      catalog,
      showCatalogByDefault: true,
      pageSize: 24,
      showMoreLabel: 'Load more'
    }
  })
  expect(screen.getAllByRole('link')).toHaveLength(24)
  await user.click(screen.getByRole('button', { name: 'Load more' }))
  expect(screen.getAllByRole('link')).toHaveLength(25)
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  await user.type(screen.getByRole('searchbox'), 'model 24')
  expect(screen.getAllByRole('link')).toHaveLength(1)
  await user.clear(screen.getByRole('searchbox'))
  expect(screen.getAllByRole('link')).toHaveLength(24)
})

it('links View all to the full directory with the current filter', async () => {
  const user = userEvent.setup()
  render(ModelCatalogExplorer, {
    props: {
      ...props,
      defaultModels: [],
      showCatalogOnFilter: false,
      collectionActionLabel: 'View all models',
      collectionActionHref: '/p/supported-models/all/'
    }
  })
  await user.click(screen.getByRole('radio', { name: 'Image' }))
  expect(
    screen.getByRole('link', { name: 'View all models' }).getAttribute('href')
  ).toBe('/p/supported-models/all/?category=image')
})

it('uses Latest card metadata without descriptions in the directory', () => {
  render(ModelCatalogExplorer, {
    props: {
      ...props,
      showCatalogByDefault: true,
      catalogCardVariant: 'hub',
      catalogCardModels: [
        {
          name: 'Wan Video',
          href: '/p/supported-models/wan-video/',
          description: 'Generate videos from text.',
          target: '_self',
          modality: 'video',
          tag: 'Partner API',
          provider: 'Wan',
          taskLabel: 'Text to Video',
          capabilities: ['edit'],
          media: { type: 'placeholder', tone: 'plum' }
        }
      ]
    }
  })
  const card = screen.getByRole('link', { name: 'Wan Video' })
  expect(within(card).getByText('Text to Video')).toBeTruthy()
  expect(within(card).getByTestId('model-card-provider').textContent).toContain(
    'Wan'
  )
  expect(within(card).queryByText('Generate videos from text.')).toBeNull()
  expect(screen.queryByText(/Used by/)).toBeNull()
})
