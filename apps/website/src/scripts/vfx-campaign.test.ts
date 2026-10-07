import { afterEach, describe, expect, it, vi } from 'vitest'

import { captureVfxLinkClick } from '@/scripts/posthog'
import { mountVfxCampaign } from './vfx-campaign'

vi.mock(import('@/scripts/posthog'))

let cleanup: (() => void) | undefined

afterEach(() => {
  cleanup?.()
  document.body.replaceChildren()
  window.history.replaceState(null, '', '/')
})

function mount(markup: string) {
  window.history.replaceState(null, '', '/vfx/?utm_source=linkedin')
  const root = document.createElement('div')
  root.innerHTML = markup
  document.body.append(root)
  cleanup = mountVfxCampaign(root)
  return root
}

describe('VFX campaign journey', () => {
  it('pauses the previous video when another starts, including videos mounted later', async () => {
    const root = mount('<video></video>')
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
  })

  it('carries attribution to sales and captures a hero click', () => {
    const root = mount(
      '<section data-vfx-hero><a href="/contact/?interest=vfx">Talk to our team</a></section>'
    )
    const link = root.querySelector('a')
    expect(link?.getAttribute('href')).toBe(
      '/contact/?interest=vfx&utm_source=linkedin'
    )
    link?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(captureVfxLinkClick).toHaveBeenCalledWith({
      destination: '/contact/',
      placement: 'hero'
    })
  })

  it('opens a card background with the same attribution as its title link', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const root = mount(
      '<section id="workflows"><div data-testid="hub-card"><img alt="Workflow"><a data-testid="hub-card-link" href="https://comfy.org/workflows/storyboard/">Storyboard</a><div role="slider"></div></div></section>'
    )
    root
      .querySelector('img')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(open).toHaveBeenCalledExactlyOnceWith(
      'https://comfy.org/workflows/storyboard/?utm_source=linkedin',
      '_blank',
      'noopener'
    )
    expect(captureVfxLinkClick).toHaveBeenCalledWith({
      destination: '/workflows/storyboard/',
      placement: 'workflows'
    })
    root
      .querySelector('[role="slider"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('decorates workflows mounted later and stops tracking after navigation', async () => {
    const root = mount('')
    const link = document.createElement('a')
    link.href = 'https://comfy.org/workflows/storyboard/'
    root.append(link)
    await vi.waitFor(() => expect(link.href).toContain('utm_source=linkedin'))
    link.href = 'https://comfy.org/workflows/storyboard/'
    await vi.waitFor(() => expect(link.href).toContain('utm_source=linkedin'))
    cleanup?.()
    vi.mocked(captureVfxLinkClick).mockClear()
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(captureVfxLinkClick).not.toHaveBeenCalled()
  })
})
