import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CampaignVertical } from '@/scripts/posthog'
import {
  captureVerticalLinkClick,
  captureVfxLinkClick
} from '@/scripts/posthog'
import { mountIndustryCampaign, mountVfxCampaign } from './vfx-campaign'

vi.mock(import('@/scripts/posthog'))

let cleanup: (() => void) | undefined

afterEach(() => {
  cleanup?.()
  document.body.replaceChildren()
  window.history.replaceState(null, '', '/')
})

function mount(markup: string, vertical: CampaignVertical = 'vfx') {
  window.history.replaceState(null, '', `/${vertical}/?utm_source=linkedin`)
  const root = document.createElement('div')
  root.innerHTML = markup
  document.body.append(root)
  cleanup =
    vertical === 'vfx'
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
    vi.mocked(captureVerticalLinkClick).mockClear()
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(captureVerticalLinkClick).not.toHaveBeenCalled()
  })
})
