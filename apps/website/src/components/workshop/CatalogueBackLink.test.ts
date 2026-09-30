import { render, screen, waitFor } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import { rememberShelf } from '../../lib/workshop/shelf-memory'
import CatalogueBackLink from './CatalogueBackLink.vue'

afterEach(() => {
  history.replaceState(null, '', '/')
  sessionStorage.clear()
})

describe('CatalogueBackLink', () => {
  it('offers the whole catalogue when no shelf was left behind', () => {
    history.replaceState(null, '', '/models/demo/')
    render(CatalogueBackLink)

    const link = screen.getByTestId('model-back')
    expect(link.textContent.trim()).toBe('Back to all models')
    expect(link.getAttribute('href')).toBe('/models')
  })

  // A second catalogue answers for its own pages, under its own name.
  it('returns to the listing it was given', () => {
    history.replaceState(null, '', '/hub/model/demo/')
    render(CatalogueBackLink, {
      props: { catalogue: '/hub', fallback: 'Back to the Hub' }
    })

    const link = screen.getByTestId('model-back')
    expect(link.textContent.trim()).toBe('Back to the Hub')
    expect(link.getAttribute('href')).toBe('/hub')
  })

  it('carries the shelf back to that listing too', async () => {
    history.replaceState(null, '', '/hub/model/demo/')
    rememberShelf('generate-videos', '/hub/model/demo/')
    render(CatalogueBackLink, { props: { catalogue: '/hub' } })

    await waitFor(() =>
      expect(screen.getByTestId('model-back').getAttribute('href')).toBe(
        '/hub?useCase=generate-videos'
      )
    )
  })

  it('adds the shelf to a listing that already carries a query', async () => {
    history.replaceState(null, '', '/hub/model/demo/')
    rememberShelf('generate-videos', '/hub/model/demo/')
    render(CatalogueBackLink, { props: { catalogue: '/hub?view=grid' } })

    await waitFor(() =>
      expect(screen.getByTestId('model-back').getAttribute('href')).toBe(
        '/hub?view=grid&useCase=generate-videos'
      )
    )
  })

  it('offers the shelf the visitor came from', async () => {
    history.replaceState(null, '', '/models/demo/')
    rememberShelf('generate-videos', '/models/demo/')
    render(CatalogueBackLink)

    await waitFor(() => {
      const link = screen.getByTestId('model-back')
      expect(link.textContent.trim()).toBe('Back to Generate videos')
      expect(link.getAttribute('href')).toBe('/models?useCase=generate-videos')
    })
  })
})
