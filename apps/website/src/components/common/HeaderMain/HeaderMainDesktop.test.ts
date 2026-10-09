import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { captureNavFeaturedCardViewed } from '@/scripts/posthog'
import HeaderMainDesktop from './HeaderMainDesktop.vue'

vi.mock(import('@/scripts/posthog'))

const viewedProperties = {
  placement: 'gemini-omni',
  dropdown: 'products',
  href: '/gemini-omni/',
  variant: 'control',
  locale: 'en'
}

describe('HeaderMainDesktop', () => {
  it('renders Hub, Products and Enterprise at the top level', () => {
    render(HeaderMainDesktop)
    expect(
      screen.getByRole('link', { name: /^Hub\b/i }).getAttribute('href')
    ).toBe('/hub/models/')
    expect(screen.getByRole('button', { name: /products/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /enterprise/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /community/i })).toBeNull()
  })

  it('marks Hub, not Products, active on the Hub page', async () => {
    history.replaceState(null, '', '/hub/models/')
    render(HeaderMainDesktop)
    await nextTick()
    const hub = screen.getByRole('link', { name: /^Hub\b/i })
    const products = screen.getByRole('button', { name: /products/i })
    expect(hub.getAttribute('data-active')).not.toBeNull()
    expect(products.getAttribute('data-active')).toBeNull()
  })

  describe('featured card view event', () => {
    it('does not report a view while the dropdown is closed', () => {
      render(HeaderMainDesktop)
      expect(captureNavFeaturedCardViewed).not.toHaveBeenCalled()
    })

    it('reports one view when the Products dropdown opens by click', async () => {
      const user = userEvent.setup()
      render(HeaderMainDesktop)
      await user.click(screen.getByRole('button', { name: /products/i }))
      await screen.findByRole('link', { name: /gemini omni/i })
      expect(captureNavFeaturedCardViewed).toHaveBeenCalledExactlyOnceWith(
        viewedProperties
      )
    })

    it('reports one view when the Products dropdown opens by hover', async () => {
      const user = userEvent.setup()
      render(HeaderMainDesktop)
      await user.hover(screen.getByRole('button', { name: /products/i }))
      await screen.findByRole('link', { name: /gemini omni/i })
      expect(captureNavFeaturedCardViewed).toHaveBeenCalledExactlyOnceWith(
        viewedProperties
      )
    })

    it('reports no view when another dropdown opens', async () => {
      const user = userEvent.setup()
      render(HeaderMainDesktop)
      await user.click(screen.getByRole('button', { name: /enterprise/i }))
      expect(captureNavFeaturedCardViewed).not.toHaveBeenCalled()
    })
  })
})
