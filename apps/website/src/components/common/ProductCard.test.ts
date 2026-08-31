// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ProductCard from './ProductCard.vue'

const card = {
  title: 'Comfy Cloud',
  description: 'Run ComfyUI without a GPU.',
  cta: 'Start free',
  href: '/cloud',
  bg: 'bg-secondary-mauve'
}

function ctaVariantOf() {
  return document.querySelector('[data-variant]')?.getAttribute('data-variant')
}

describe('ProductCard', () => {
  it('links the whole card and labels it with the product title', () => {
    render(ProductCard, { props: card })

    const link = screen.getByRole('link', { name: /Comfy Cloud/ })
    expect(link.getAttribute('href')).toBe('/cloud')
    expect(link.classList).toContain('bg-secondary-mauve')
  })

  it('uses the default CTA variant when none is given', () => {
    render(ProductCard, { props: card })

    expect(ctaVariantOf()).toBe('default')
  })

  it('honors an overridden CTA variant', () => {
    render(ProductCard, { props: { ...card, ctaVariant: 'outline' } })

    expect(ctaVariantOf()).toBe('outline')
  })

  // The CTA sits inside the card-wide anchor, so it must not be a link itself.
  it('renders the CTA as a span so the card keeps a single link', () => {
    render(ProductCard, { props: card })

    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByText('Start free').tagName).toBe('SPAN')
  })
})
