// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import HeroSplit01 from './HeroSplit01.vue'

const hero = {
  badgeText: 'Platform',
  title: 'Build on Comfy',
  primaryCta: { label: 'Get Started', href: '/start' }
}

describe('HeroSplit01', () => {
  it('marks the hero as beta only when asked', () => {
    render(HeroSplit01, { props: hero })
    expect(screen.queryByText('BETA')).toBeNull()
  })

  it('shows the beta badge when enabled', () => {
    render(HeroSplit01, { props: { ...hero, beta: true, compact: true } })

    expect(screen.getByText('BETA')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Build on Comfy' })).toBeTruthy()
  })
})
