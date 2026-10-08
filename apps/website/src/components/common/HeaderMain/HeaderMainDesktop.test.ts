import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import HeaderMainDesktop from './HeaderMainDesktop.vue'

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
})
