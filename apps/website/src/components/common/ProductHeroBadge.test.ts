// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ProductHeroBadge from './ProductHeroBadge.vue'

// The node-shape SVGs are inlined as data URIs by the bundler, so tests count
// the connectors rather than matching their srcs.
function connectorCount() {
  return document.querySelectorAll('img[aria-hidden="true"]').length
}

describe('ProductHeroBadge', () => {
  it('renders the label text', () => {
    render(ProductHeroBadge, { props: { text: 'PLATFORM' } })

    expect(screen.getByText('PLATFORM')).toBeTruthy()
  })

  it('shows the logo plate and its connector by default', () => {
    render(ProductHeroBadge)

    expect(screen.getByRole('img', { name: 'Comfy' })).toBeTruthy()
    // left connector + union between logo and text + right connector
    expect(connectorCount()).toBe(3)
  })

  it('drops the logo plate and its connector when showLogo is false', () => {
    render(ProductHeroBadge, { props: { showLogo: false, text: 'AGENT' } })

    expect(screen.queryByRole('img', { name: 'Comfy' })).toBeNull()
    // The union connector goes with the logo plate it used to separate.
    expect(connectorCount()).toBe(2)
    expect(screen.getByText('AGENT').parentElement?.classList).toContain('px-4')
  })

  it('accepts a custom logo and alt text', () => {
    render(ProductHeroBadge, {
      props: { logoSrc: '/icons/minimax.svg', logoAlt: 'MiniMax' }
    })

    expect(screen.getByRole('img', { name: 'MiniMax' })).toBeTruthy()
  })
})
