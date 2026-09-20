import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import HeaderMainDesktop from './HeaderMainDesktop.vue'

describe('HeaderMainDesktop', () => {
  it('renders Products and Enterprise without a top-level Models item', () => {
    render(HeaderMainDesktop)
    expect(screen.queryByRole('button', { name: /^Models\b/i })).toBeNull()
    expect(screen.getByRole('button', { name: /products/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /enterprise/i })).toBeTruthy()
  })
})
