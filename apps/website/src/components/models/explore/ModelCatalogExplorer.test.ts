// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'

import ModelCatalogExplorer from './ModelCatalogExplorer.vue'

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
    { value: 'video' as const, label: 'Video' }
  ],
  categoryLabel: 'Model categories',
  searchLabel: 'Search supported models',
  searchPlaceholder: 'Search models...',
  workflowCountOne: 'Used by {count} supported workflow.',
  workflowCountMany: 'Used by {count} supported workflows.',
  partnerLabel: 'Partner API',
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
        expect(screen.getByRole('status').textContent).toBe('1 matching models')
        expect(screen.getByRole('link', { name: includedModel })).toBeTruthy()
        expect(screen.queryByRole('link', { name: excludedModel })).toBeNull()
      })
    }
  )
})
