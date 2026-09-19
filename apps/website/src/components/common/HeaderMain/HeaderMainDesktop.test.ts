import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import HeaderMainDesktop from './HeaderMainDesktop.vue'

describe('HeaderMainDesktop', () => {
  it('renders Products and Enterprise without a top-level Hub item', () => {
    render(HeaderMainDesktop)
    expect(screen.queryByRole('link', { name: /^Hub\b/i })).toBeNull()
    expect(screen.getByRole('button', { name: /products/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /enterprise/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /community/i })).toBeNull()
  })

  it('marks Products active on the Hub page it links to', async () => {
    history.replaceState(null, '', '/hub/models/')
    render(HeaderMainDesktop)
    await nextTick()
    const products = screen.getByRole('button', { name: /products/i })
    expect(products.getAttribute('data-active')).not.toBeNull()
  })
})
