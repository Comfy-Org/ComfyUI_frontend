// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import BenefitsGrid01 from './BenefitsGrid01.vue'

type BenefitsGridProps = ComponentProps<typeof BenefitsGrid01>

const requiredProps = {
  heading: 'Why join the program',
  benefits: [
    { id: 'reach', description: 'Reach a global audience of builders.' },
    { id: 'earn', description: 'Earn recurring commission on referrals.' }
  ]
} satisfies BenefitsGridProps

function renderBenefitsGrid(props: Partial<BenefitsGridProps> = {}) {
  return render(BenefitsGrid01, {
    props: { ...requiredProps, ...props }
  })
}

describe('BenefitsGrid01', () => {
  it('renders the heading and each benefit description', () => {
    renderBenefitsGrid()

    expect(screen.getByText('Why join the program')).toBeTruthy()
    expect(
      screen.getByText('Reach a global audience of builders.')
    ).toBeTruthy()
    expect(
      screen.getByText('Earn recurring commission on referrals.')
    ).toBeTruthy()
  })

  it('renders numbered index labels by default', () => {
    renderBenefitsGrid()

    expect(screen.getByText('01')).toBeTruthy()
    expect(screen.getByText('02')).toBeTruthy()
  })

  it('renders no index labels when numbered is false', () => {
    renderBenefitsGrid({ numbered: false })

    expect(screen.queryByText('01')).toBeNull()
    expect(screen.queryByText('02')).toBeNull()
  })

  it('lays the cards out four across on large screens by default', () => {
    const { html } = renderBenefitsGrid()

    expect(html()).toContain('lg:grid-cols-4')
  })

  it('lays the cards out two across on large screens when columns is 2', () => {
    const { html } = renderBenefitsGrid({ columns: 2 })

    expect(html()).toContain('lg:grid-cols-2')
    expect(html()).not.toContain('lg:grid-cols-4')
  })

  it('omits the footnote and CTAs by default', () => {
    renderBenefitsGrid()

    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders only the primary CTA when no secondary CTA is provided', () => {
    renderBenefitsGrid({
      primaryCta: { label: 'VIEW DETAILS', href: '/details/' }
    })

    const primaryCta = screen.getByRole('link', { name: 'VIEW DETAILS' })
    expect(primaryCta.getAttribute('href')).toBe('/details/')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('renders both CTAs when a secondary CTA is provided', () => {
    renderBenefitsGrid({
      primaryCta: { label: 'VIEW DETAILS', href: '/details/' },
      secondaryCta: {
        label: 'REQUEST DEMO',
        href: '/demo/',
        target: '_blank'
      }
    })

    const primaryCta = screen.getByRole('link', { name: 'VIEW DETAILS' })
    expect(primaryCta.getAttribute('href')).toBe('/details/')

    const secondaryCta = screen.getByRole('link', { name: 'REQUEST DEMO' })
    expect(secondaryCta.getAttribute('href')).toBe('/demo/')
    expect(secondaryCta.getAttribute('target')).toBe('_blank')
    expect(secondaryCta.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
