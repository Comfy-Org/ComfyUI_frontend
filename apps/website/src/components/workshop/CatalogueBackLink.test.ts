// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import { rememberShelf } from '../../lib/workshop/shelf-memory'
import CatalogueBackLink from './CatalogueBackLink.vue'

afterEach(() => {
  sessionStorage.clear()
})

describe('CatalogueBackLink', () => {
  it('offers the whole catalogue when no shelf was left behind', () => {
    render(CatalogueBackLink)

    const link = screen.getByTestId('model-back')
    expect(link.textContent.trim()).toBe('Back to all models')
    expect(link.getAttribute('href')).toBe('/models')
  })

  it('offers the shelf the visitor came from', async () => {
    rememberShelf('generate-videos')
    render(CatalogueBackLink)

    await waitFor(() => {
      const link = screen.getByTestId('model-back')
      expect(link.textContent.trim()).toBe('Back to Generate videos')
      expect(link.getAttribute('href')).toBe('/models?useCase=generate-videos')
    })
  })
})
