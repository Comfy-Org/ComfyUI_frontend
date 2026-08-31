// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import OfferGrid01 from './OfferGrid01.vue'

type OfferGridProps = ComponentProps<typeof OfferGrid01>

const requiredProps = {
  heading: 'Choose the right enterprise path',
  featuredOffer: {
    id: 'managed-builds',
    label: 'LEAD OFFER',
    title: 'ComfyUI Managed Builds',
    description: 'Create one approved environment for the team.',
    cta: { label: 'VIEW MANAGED BUILDS', href: '/enterprise/managed-builds/' }
  },
  offers: [
    {
      id: 'team-plans',
      label: 'FOR TEAMS',
      title: 'Team plans',
      description: 'Share credits and billing across the team.',
      cta: { label: 'REQUEST DEMO', href: '/contact/' }
    }
  ]
} satisfies OfferGridProps

function renderOffers(props: Partial<OfferGridProps> = {}) {
  return render(OfferGrid01, {
    props: { ...requiredProps, ...props }
  })
}

describe('OfferGrid01', () => {
  it('renders optional context, the featured offer, and each supporting offer', () => {
    renderOffers({
      eyebrow: 'ONE ENTERPRISE RELATIONSHIP',
      description: 'Bring the product, terms, and support together.',
      featuredOffer: {
        ...requiredProps.featuredOffer,
        cta: {
          label: 'VIEW MANAGED BUILDS',
          href: '/enterprise/managed-builds/',
          target: '_blank',
          rel: 'nofollow'
        }
      },
      offers: [
        requiredProps.offers[0],
        {
          id: 'licensing',
          label: 'COMMERCIAL RIGHTS',
          title: 'Model licensing',
          description: 'Request commercial terms for supported models.',
          cta: {
            label: 'VIEW LICENSING',
            href: 'https://example.com/licensing',
            target: '_blank'
          }
        }
      ]
    })

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Choose the right enterprise path'
      })
    ).toBeTruthy()
    expect(screen.getByText('ONE ENTERPRISE RELATIONSHIP')).toBeTruthy()
    expect(
      screen.getByText('Bring the product, terms, and support together.')
    ).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.getByText('LEAD OFFER')).toBeTruthy()
    expect(screen.getByText('ComfyUI Managed Builds')).toBeTruthy()
    expect(
      screen.getByText('Create one approved environment for the team.')
    ).toBeTruthy()
    expect(screen.getByText('FOR TEAMS')).toBeTruthy()
    expect(screen.getByText('Team plans')).toBeTruthy()
    expect(
      screen.getByText('Share credits and billing across the team.')
    ).toBeTruthy()
    expect(screen.getByText('COMMERCIAL RIGHTS')).toBeTruthy()
    expect(screen.getByText('Model licensing')).toBeTruthy()
    expect(
      screen.getByText('Request commercial terms for supported models.')
    ).toBeTruthy()

    const featuredCta = screen.getByRole('link', {
      name: 'VIEW MANAGED BUILDS'
    })
    expect(featuredCta.getAttribute('href')).toBe('/enterprise/managed-builds/')
    expect(featuredCta.getAttribute('target')).toBe('_blank')
    expect(featuredCta.getAttribute('rel')).toBe('nofollow')

    const internalCta = screen.getByRole('link', { name: 'REQUEST DEMO' })
    expect(internalCta.getAttribute('href')).toBe('/contact/')
    expect(internalCta.getAttribute('rel')).toBeNull()

    const externalCta = screen.getByRole('link', { name: 'VIEW LICENSING' })
    expect(externalCta.getAttribute('href')).toBe(
      'https://example.com/licensing'
    )
    expect(externalCta.getAttribute('target')).toBe('_blank')
    expect(externalCta.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('omits the optional eyebrow and description', () => {
    renderOffers()

    expect(screen.queryByText('ONE ENTERPRISE RELATIONSHIP')).toBeNull()
    expect(
      screen.queryByText('Bring the product, terms, and support together.')
    ).toBeNull()
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  it('omits offer labels when they are not provided', () => {
    renderOffers({
      featuredOffer: { ...requiredProps.featuredOffer, label: undefined },
      offers: [{ ...requiredProps.offers[0], label: undefined }]
    })

    expect(screen.queryByText('LEAD OFFER')).toBeNull()
    expect(screen.queryByText('FOR TEAMS')).toBeNull()
    expect(screen.getByText('ComfyUI Managed Builds')).toBeTruthy()
    expect(screen.getByText('Team plans')).toBeTruthy()
  })
})
