// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import HeroProduct01 from './HeroProduct01.vue'

type HeroProductProps = ComponentProps<typeof HeroProduct01>

const requiredProps = {
  title: 'MANAGED BUILDS',
  primaryCta: { label: 'CONTACT SALES', href: '/contact/' }
} satisfies HeroProductProps

function renderHero(
  props: Partial<HeroProductProps> = {},
  slots: Record<string, string> = {}
) {
  return render(HeroProduct01, {
    props: { ...requiredProps, ...props },
    slots
  })
}

describe('HeroProduct01', () => {
  it('renders the badge title as an h1 with tag, body, and CTAs', () => {
    renderHero({
      tag: 'BETA',
      body: 'Govern the models your team runs.',
      primaryCta: { label: 'CONTACT SALES', href: '/contact/' },
      secondaryCta: {
        label: 'SEE HOW IT WORKS',
        href: '#how-it-works',
        target: '_self'
      }
    })

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toContain('MANAGED BUILDS')
    expect(heading.textContent).toContain('BETA')
    expect(screen.getByText('Govern the models your team runs.')).toBeTruthy()

    const primaryCta = screen.getByRole('link', { name: 'CONTACT SALES' })
    expect(primaryCta.getAttribute('href')).toBe('/contact/')

    const secondaryCta = screen.getByRole('link', { name: 'SEE HOW IT WORKS' })
    expect(secondaryCta.getAttribute('href')).toBe('#how-it-works')
    expect(secondaryCta.getAttribute('target')).toBe('_self')
  })

  it('omits the tag pill, body, secondary CTA, and image by default', () => {
    renderHero({ imageAlt: 'Scene fallback' })

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).not.toContain('BETA')
    expect(screen.queryByRole('paragraph')).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.queryByAltText('Scene fallback')).toBeNull()
  })

  it('supports rendering as a secondary heading', () => {
    renderHero({ headingTag: 'h2' })

    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  })

  it('renders the fallback image from imageSrc with explicit dimensions', () => {
    renderHero({
      imageSrc: '/images/hero.png',
      imageAlt: 'Isometric build scene',
      imageWidth: 640,
      imageHeight: 480
    })

    const image = screen.getByAltText('Isometric build scene')
    expect(image.getAttribute('src')).toBe('/images/hero.png')
    expect(image.getAttribute('width')).toBe('640')
    expect(image.getAttribute('height')).toBe('480')
  })

  it('lets slotted media replace the fallback image', () => {
    renderHero(
      { imageSrc: '/images/hero.png', imageAlt: 'Scene fallback' },
      { media: '<div data-testid="scene"></div>' }
    )

    expect(screen.getByTestId('scene')).toBeTruthy()
    expect(screen.queryByAltText('Scene fallback')).toBeNull()
  })
})
