import { render, screen, waitFor } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { rememberList } from '@/lib/workshop/shelf-memory'
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
    expect(link.getAttribute('href')).toBe('/hub/models/')
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

  it.for([
    {
      list: {
        href: '/hub/models/?useCase=generate-videos',
        label: 'Generate videos'
      },
      text: 'Back to Generate videos'
    },
    {
      list: { href: '/hub/models/?tab=video', label: 'Video models' },
      text: 'Back to Video models'
    },
    { list: { href: '/hub/', label: 'Hub' }, text: 'Back to Hub' },
    { list: { href: '/hub/models/?q=flux' }, text: 'Back to all models' }
  ])('returns to $list.href as "$text"', async ({ list, text }) => {
    history.replaceState(null, '', '/hub/models/demo/')
    rememberList(list, '/hub/models/demo/')
    render(CatalogueBackLink)

    await waitFor(() => {
      const link = screen.getByTestId('model-back')
      expect(link.textContent.trim()).toBe(text)
      expect(link.getAttribute('href')).toBe(list.href)
    })
  })

  it('leaves a list remembered for another model alone', async () => {
    history.replaceState(null, '', '/hub/models/demo/')
    rememberList({ href: '/hub/', label: 'Hub' }, '/hub/models/other/')
    render(CatalogueBackLink)
    await nextTick()

    const link = screen.getByTestId('model-back')
    expect(link.textContent.trim()).toBe('Back to all models')
    expect(link.getAttribute('href')).toBe('/hub/models/')
  })
})
