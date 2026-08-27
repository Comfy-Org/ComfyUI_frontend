// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'

import ModelCatalogExplorer from './ModelCatalogExplorer.vue'

const props = {
  catalog: [
    {
      kind: 'component' as const,
      slug: 'wan-video',
      title: 'Wan Video',
      href: '/p/supported-models/wan-video',
      directory: 'diffusion_models' as const,
      workflowCount: 4,
      access: 'open' as const,
      categories: ['video'] as const,
      mediaTone: 'plum' as const,
      searchText: 'wan video diffusion_models video'
    },
    {
      kind: 'component' as const,
      slug: 'partner-image',
      title: 'Partner Image',
      href: '/p/supported-models/partner-image',
      directory: 'partner_nodes' as const,
      workflowCount: 2,
      access: 'partner' as const,
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
  openLabel: 'Open Source',
  viewLabel: 'Catalog view',
  releasesLabel: 'Models',
  componentsLabel: 'Components',
  componentCountOne: '{count} component.',
  componentCountMany: '{count} components.',
  resultCountLabel: '{count} matching models',
  emptyLabel: 'No supported models match this search yet.'
}

describe('ModelCatalogExplorer', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/p/supported-models')
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

  it('shows the complete catalog by default on the dedicated page', () => {
    render(ModelCatalogExplorer, {
      props: { ...props, showCatalogByDefault: true }
    })

    expect(screen.getByRole('link', { name: 'Wan Video' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Partner Image' })).toBeTruthy()
  })

  it('limits displayed matches without changing the result count', () => {
    const catalog = Array.from({ length: 5 }, (_, index) => ({
      ...props.catalog[0],
      slug: `model-${index}`,
      title: `Model ${index}`,
      href: `/p/supported-models/model-${index}`
    }))

    render(ModelCatalogExplorer, {
      props: {
        ...props,
        catalog,
        resultLimit: 4,
        showCatalogByDefault: true
      }
    })

    expect(screen.getAllByRole('link')).toHaveLength(4)
    expect(screen.getByRole('status').textContent).toBe('5 matching models')
    expect(screen.queryByRole('link', { name: 'Model 4' })).toBeNull()
  })

  it('defaults to releases and allows switching to technical components', async () => {
    render(ModelCatalogExplorer, {
      props: {
        ...props,
        showCatalogByDefault: true,
        releaseCatalog: [
          {
            kind: 'release',
            slug: 'wan-2-2',
            title: 'Wan 2.2',
            href: '/p/supported-models/wan-2-2',
            directory: 'diffusion_models',
            workflowCount: 3,
            componentCount: 4,
            publisher: 'Alibaba',
            access: 'open',
            categories: ['video'],
            mediaTone: 'plum',
            searchText: 'wan 2.2 alibaba video'
          }
        ]
      }
    })

    expect(screen.getByRole('link', { name: 'Wan 2.2' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Wan Video' })).toBeNull()
    expect(screen.getByText(/4 components/)).toBeTruthy()
    expect(screen.getByText('Alibaba')).toBeTruthy()

    await userEvent.click(screen.getByRole('radio', { name: 'Components' }))

    expect(screen.getByRole('link', { name: 'Wan Video' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Wan 2.2' })).toBeNull()
    expect(window.location.search).toBe('?view=components')
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
