// @vitest-environment happy-dom
/* eslint-disable testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import HeroSplit01 from './HeroSplit01.vue'

const hero = {
  badgeText: 'PLATFORM',
  title: 'Ship generative pipelines',
  primaryCta: { label: 'Get started', href: 'https://platform.comfy.org' },
  secondaryCta: { label: 'Read the docs', href: 'https://docs.comfy.org' }
}

function heading() {
  return screen.getByRole('heading', { level: 1 })
}

// HeroSplit01 pads its CTAs out only at full size; compact leaves the
// BrandButton size classes alone.
function ctasArePadded() {
  return ['Get started', 'Read the docs'].map((name) =>
    screen.getByRole('link', { name }).classList.contains('px-8')
  )
}

describe('HeroSplit01', () => {
  it('renders both CTAs as links at their destinations', () => {
    render(HeroSplit01, { props: hero })

    expect(
      screen.getByRole('link', { name: 'Get started' }).getAttribute('href')
    ).toBe('https://platform.comfy.org')
    expect(
      screen.getByRole('link', { name: 'Read the docs' }).getAttribute('href')
    ).toBe('https://docs.comfy.org')
  })

  it('omits the secondary CTA when none is given', () => {
    render(HeroSplit01, { props: { ...hero, secondaryCta: undefined } })

    expect(screen.queryByRole('link', { name: 'Read the docs' })).toBeNull()
  })

  it('renders full-size type and CTAs by default', () => {
    render(HeroSplit01, { props: hero })

    expect(heading().classList).toContain('text-2xl')
    expect(ctasArePadded()).toEqual([true, true])
  })

  it('shrinks the heading and CTAs when compact', () => {
    render(HeroSplit01, { props: { ...hero, compact: true } })

    expect(heading().classList).toContain('text-xl')
    expect(ctasArePadded()).toEqual([false, false])
  })

  it('hides the beta badge unless asked for', () => {
    render(HeroSplit01, { props: hero })

    expect(screen.queryByText('BETA')).toBeNull()
  })

  it('shows the beta badge from the translation catalog', () => {
    render(HeroSplit01, { props: { ...hero, beta: true } })

    expect(screen.getByText('BETA')).toBeTruthy()
  })

  it('keeps the beta badge readable for zh-CN, which shares the English term', () => {
    render(HeroSplit01, {
      props: { ...hero, beta: true, locale: 'zh-CN' as const }
    })

    expect(screen.getByText('BETA')).toBeTruthy()
  })

  it('splits the highlighted lead-in from the rest of the title', () => {
    render(HeroSplit01, { props: { ...hero, titleHighlight: 'Comfy' } })

    const highlight = heading().querySelector('span')
    expect(highlight?.textContent).toBe('Comfy')
    expect(heading().textContent).toContain('Ship generative pipelines')
  })

  it('renders the feature checklist when features are supplied', () => {
    render(HeroSplit01, { props: { ...hero, features: ['BYOK', 'SOC 2'] } })

    expect(
      screen.getAllByRole('listitem').map((li) => li.textContent?.trim())
    ).toEqual(['BYOK', 'SOC 2'])
  })
})
