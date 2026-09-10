// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import RouterNarrativeSection from './RouterNarrativeSection.vue'

describe('RouterNarrativeSection', () => {
  it('renders the header and body, with supporting text and a CTA optional', () => {
    render(RouterNarrativeSection, {
      props: { header: 'Header text', body: 'Body text' }
    })

    expect(screen.getByRole('heading', { name: 'Header text' })).toBeTruthy()
    expect(screen.getByText('Body text')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders supporting text and a CTA when provided', () => {
    render(RouterNarrativeSection, {
      props: {
        header: 'Header text',
        body: 'Body text',
        supporting: 'Supporting text',
        ctaLabel: 'Explore the Developer Platform',
        ctaHref: '/platform'
      }
    })

    expect(screen.getByText('Supporting text')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Explore the Developer Platform' })
    ).toBeTruthy()
  })
})
