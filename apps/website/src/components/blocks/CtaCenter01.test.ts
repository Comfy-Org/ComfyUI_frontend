// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import CtaCenter01 from './CtaCenter01.vue'

const ctas = {
  heading: 'Ship it',
  primaryCta: { label: 'Primary', href: '/primary' },
  secondaryCta: { label: 'Secondary', href: '/secondary' }
}

function buttonSizes() {
  return ['Primary', 'Secondary'].map((name) =>
    screen.getByRole('link', { name }).getAttribute('data-size')
  )
}

describe('CtaCenter01', () => {
  it('renders full-size buttons by default', () => {
    render(CtaCenter01, { props: ctas })

    expect(buttonSizes()).toEqual(['lg', 'lg'])
  })

  it('shrinks the heading and buttons when compact', () => {
    render(CtaCenter01, { props: { ...ctas, compact: true } })

    expect(
      screen.getByRole('heading', { name: 'Ship it' }).classList
    ).toContain('text-2xl/snug')
    expect(buttonSizes()).toEqual(['default', 'default'])
  })

  it('supports rich heading content without changing its accessible name', () => {
    render(CtaCenter01, {
      props: ctas,
      slots: { heading: '<span>Rich heading</span>' }
    })

    expect(screen.getByRole('heading', { name: 'Ship it' }).textContent).toBe(
      'Rich heading'
    )
  })
})
