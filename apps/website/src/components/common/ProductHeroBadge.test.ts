// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ProductHeroBadge from './ProductHeroBadge.vue'

describe('ProductHeroBadge', () => {
  it('renders a compact logo lockup without a connector', () => {
    render(ProductHeroBadge, {
      props: { compact: true, text: 'API', showConnector: false }
    })

    expect(screen.getByAltText('Comfy')).toBeTruthy()
    expect(screen.getByText('API')).toBeTruthy()
  })

  it('renders a text-only product lockup', () => {
    render(ProductHeroBadge, {
      props: { compact: true, text: 'MODELS API', showLogo: false }
    })

    expect(screen.getByText('MODELS API')).toBeTruthy()
    expect(screen.queryByAltText('Comfy')).toBeNull()
  })
})
