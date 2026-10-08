import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CampaignVertical } from '@/scripts/posthog'
import {
  captureAgencyLinkClick,
  captureVerticalLinkClick,
  captureVfxLinkClick
} from '@/scripts/posthog'
import {
  mountAgencyCampaign,
  mountIndustryCampaign,
  mountVfxCampaign
} from './vfx-campaign'

vi.mock(import('@/scripts/posthog'))

let cleanup: (() => void) | undefined

afterEach(() => {
  cleanup?.()
  document.body.replaceChildren()
  window.history.replaceState(null, '', '/')
})

function mount(
  markup: string,
  vertical: CampaignVertical = 'vfx',
  campaignType: 'industry' | 'agency' = 'industry'
) {
  window.history.replaceState(null, '', `/${vertical}/?utm_source=linkedin`)
  const root = document.createElement('div')
  root.innerHTML = markup
  document.body.append(root)
  cleanup =
    campaignType === 'agency'
      ? mountAgencyCampaign(root, vertical)
      : vertical === 'vfx'
        ? mountVfxCampaign(root)
        : mountIndustryCampaign(root, vertical)
  return root
}

describe('industry campaign journey', () => {
  it.for<CampaignVertical>(['vfx', 'advertising'])(
    'pauses other %s videos, including later mounts, until cleanup',
    async (vertical) => {
      const root = mount('<video></video>', vertical)
      const hero = root.querySelector('video')
      if (!hero) throw new Error('Missing hero video')
      await hero.play()
      const walkthrough = document.createElement('video')
      root.append(walkthrough)
      await walkthrough.play()
      expect(hero.paused).toBe(true)
      expect(walkthrough.paused).toBe(false)
      await hero.play()
      expect(walkthrough.paused).toBe(true)
      expect(hero.paused).toBe(false)
      cleanup?.()
      await walkthrough.play()
      expect(hero.paused).toBe(false)
      expect(walkthrough.paused).toBe(false)
    }
  )

  it.for<CampaignVertical>([
    'vfx',
    'advertising',
    'film-animation',
    'architectural-visualization'
  ])('carries attribution and records the %s hero click', (vertical) => {
    const heroAttribute =
      vertical === 'vfx' ? 'data-vfx-hero' : 'data-campaign-hero'
    const root = mount(
      `<section ${heroAttribute}><a href="/contact/?interest=${vertical}">Talk to our team</a></section>`,
      vertical
    )
    const link = root.querySelector('a')
    expect(link?.getAttribute('href')).toBe(
      `/contact/?interest=${vertical}&utm_source=linkedin`
    )
    link?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const properties = { destination: '/contact/', placement: 'hero' }
    if (vertical === 'vfx') {
      expect(captureVfxLinkClick).toHaveBeenCalledExactlyOnceWith(properties)
      expect(captureVerticalLinkClick).not.toHaveBeenCalled()
    } else {
      expect(captureVerticalLinkClick).toHaveBeenCalledExactlyOnceWith({
        ...properties,
        vertical
      })
      expect(captureVfxLinkClick).not.toHaveBeenCalled()
    }
  })

  it('opens a card background with the same attribution as its title link', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const root = mount(
      '<section id="workflows"><div data-testid="hub-card"><img alt="Workflow"><a data-testid="hub-card-link" href="https://comfy.org/workflows/storyboard/">Storyboard</a><div role="slider"></div></div></section>',
      'advertising'
    )
    root
      .querySelector('img')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(open).toHaveBeenCalledExactlyOnceWith(
      'https://comfy.org/workflows/storyboard/?utm_source=linkedin',
      '_blank',
      'noopener'
    )
    expect(captureVerticalLinkClick).toHaveBeenCalledWith({
      vertical: 'advertising',
      destination: '/workflows/storyboard/',
      placement: 'workflows'
    })
    root
      .querySelector('[role="slider"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(open).toHaveBeenCalledTimes(1)
  })

  it.for([
    [
      '<section id="studio"><a href="/contact/">Contact</a></section>',
      'studio'
    ],
    ['<a href="/contact/">Contact</a>', 'page']
  ])('tracks the placement of %s', ([markup, placement]) => {
    const root = mount(markup, 'architectural-visualization')
    root
      .querySelector('a')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(captureVerticalLinkClick).toHaveBeenCalledExactlyOnceWith({
      vertical: 'architectural-visualization',
      destination: '/contact/',
      placement
    })
  })

  it('decorates workflows mounted later and stops tracking after navigation', async () => {
    const root = mount('', 'film-animation')
    const link = document.createElement('a')
    link.href = 'https://comfy.org/workflows/storyboard/'
    root.append(link)
    await vi.waitFor(() => expect(link.href).toContain('utm_source=linkedin'))
    link.href = 'https://comfy.org/workflows/storyboard/'
    await vi.waitFor(() => expect(link.href).toContain('utm_source=linkedin'))
    cleanup?.()
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(captureVerticalLinkClick).not.toHaveBeenCalled()
  })
})

describe('agency campaign journey', () => {
  it.for<CampaignVertical>([
    'vfx',
    'advertising',
    'film-animation',
    'architectural-visualization'
  ])(
    'preserves attribution and distinguishes the %s agency inquiry',
    (vertical) => {
      const root = mount(
        `<section data-campaign-hero><a href="/contact/?interest=${vertical}&campaign_type=agency-led">Meet a partner</a></section>`,
        vertical,
        'agency'
      )
      const link = root.querySelector('a')
      expect(link?.getAttribute('href')).toBe(
        `/contact/?interest=${vertical}&campaign_type=agency-led&utm_source=linkedin`
      )
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(captureAgencyLinkClick).toHaveBeenCalledExactlyOnceWith({
        vertical,
        campaign_type: 'agency-led',
        destination: '/contact/',
        placement: 'hero'
      })
      expect(captureVfxLinkClick).not.toHaveBeenCalled()
      expect(captureVerticalLinkClick).not.toHaveBeenCalled()
    }
  )

  it.for([
    { section: 'agency-partners', placement: 'partners' },
    { section: 'workflows', placement: 'workflows' },
    { section: 'studio', placement: 'studio' }
  ] as const)(
    'attributes $section inquiries to their placement',
    ({ section, placement }) => {
      const root = mount(
        `<section id="${section}"><a href="/contact/">Contact</a></section>`,
        'advertising',
        'agency'
      )
      root
        .querySelector('a')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(captureAgencyLinkClick).toHaveBeenCalledExactlyOnceWith({
        vertical: 'advertising',
        campaign_type: 'agency-led',
        destination: '/contact/',
        placement
      })
    }
  )

  it('carries attribution into hydrated agency cards without recording query values', async () => {
    const root = mount('', 'film-animation', 'agency')
    const link = document.createElement('a')
    link.href = '/contact/?interest=film-animation&campaign_type=agency-led'
    root.append(link)
    await vi.waitFor(() => expect(link.href).toContain('utm_source=linkedin'))
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(captureAgencyLinkClick).toHaveBeenCalledExactlyOnceWith({
      vertical: 'film-animation',
      campaign_type: 'agency-led',
      destination: '/contact/',
      placement: 'page'
    })
    cleanup?.()
    link.href = '/contact/'
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(captureAgencyLinkClick).toHaveBeenCalledTimes(1)
    expect(link.search).toBe('')
  })

  it('pauses the agency hero when a case study starts playing', async () => {
    const root = mount('<video aria-label="Hero"></video>', 'vfx', 'agency')
    const hero = root.querySelector('video')
    if (!hero) throw new Error('Missing hero video')
    await hero.play()
    const caseStudy = document.createElement('video')
    root.append(caseStudy)
    await caseStudy.play()
    expect(hero.paused).toBe(true)
    expect(caseStudy.paused).toBe(false)
    cleanup?.()
    await hero.play()
    expect(caseStudy.paused).toBe(false)
  })
})
