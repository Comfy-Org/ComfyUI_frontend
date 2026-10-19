import { within } from '@testing-library/vue'
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
  window.history.replaceState(null, '', '/solutions/vfx/?utm_source=linkedin')
  const root = document.createElement('div')
  root.innerHTML = markup
  document.body.append(root)
  cleanup = mountVfxCampaign(root)
  return root
}

describe('VFX campaign journey', () => {
  it('plays a synchronized comparison as a pair and pauses outside videos', async () => {
    const root = mount(
      '<video aria-label="Hero"></video><div data-synchronized-comparison><video aria-label="Original"></video><video aria-label="Result"></video></div>'
    )
    const hero = within(root).getByLabelText<HTMLVideoElement>('Hero')
    const original = within(root).getByLabelText<HTMLVideoElement>('Original')
    const result = within(root).getByLabelText<HTMLVideoElement>('Result')
    await hero.play()
    await original.play()
    await result.play()
    expect(original.paused).toBe(false)
    expect(result.paused).toBe(false)
    expect(hero.paused).toBe(true)
    await hero.play()
    expect(original.paused).toBe(true)
    expect(result.paused).toBe(true)
  })

  it('plays canvas examples and their comparison together until an outside video starts', async () => {
    const root = mount(
      '<video aria-label="Hero"></video><vfx-workflow-showcase><video aria-label="Preview" data-src="sample.mp4"></video><div data-synchronized-comparison><video aria-label="Original"></video><video aria-label="Result"></video></div></vfx-workflow-showcase>'
    )
    const hero = within(root).getByLabelText<HTMLVideoElement>('Hero')
    const preview = within(root).getByLabelText<HTMLVideoElement>('Preview')
    const original = within(root).getByLabelText<HTMLVideoElement>('Original')
    const result = within(root).getByLabelText<HTMLVideoElement>('Result')
    const otherCanvas = document.createElement('vfx-workflow-showcase')
    const otherPreview = document.createElement('video')
    otherPreview.dataset.src = 'other.mp4'
    otherCanvas.append(otherPreview)
    root.append(otherCanvas)
    await original.play()
    await result.play()
    await preview.play()
    await otherPreview.play()
    expect([
      preview.paused,
      original.paused,
      result.paused,
      otherPreview.paused
    ]).toEqual([false, false, false, false])
    const heroComparison = document.createElement('div')
    heroComparison.dataset.synchronizedComparison = ''
    const heroOriginal = document.createElement('video')
    heroComparison.append(heroOriginal)
    root.append(heroComparison)
    await heroOriginal.play()
    expect([preview.paused, otherPreview.paused]).toEqual([false, false])
    expect([original.paused, result.paused]).toEqual([true, true])
    await hero.play()
    expect([
      preview.paused,
      original.paused,
      result.paused,
      otherPreview.paused
    ]).toEqual([true, true, true, true])
  })

  it('pauses other videos, including later mounts, until cleanup', async () => {
    const root = mount('<video aria-label="Hero"></video>')
    const hero = within(root).getByLabelText<HTMLVideoElement>('Hero')
    await hero.play()
    const walkthrough = document.createElement('video')
    root.append(walkthrough)
    await walkthrough.play()
    expect(hero.paused).toBe(true)
    expect(walkthrough.paused).toBe(false)
    await hero.play()
    expect(walkthrough.paused).toBe(true)
    cleanup?.()
    await walkthrough.play()
    expect(hero.paused).toBe(false)
  })

  it.for([
    { attribute: 'data-campaign-hero', placement: 'hero' },
    { attribute: 'id="workflows"', placement: 'workflows' },
    { attribute: 'id="studio"', placement: 'studio' },
    { attribute: '', placement: 'page' }
  ])(
    'preserves attribution for $placement clicks',
    ({ attribute, placement }) => {
      const root = mount(
        `<section ${attribute}><a href="/contact/?interest=vfx">Contact</a></section>`
      )
      const link = within(root).getByRole('link', { name: 'Contact' })
      expect(link).toHaveAttribute(
        'href',
        '/contact/?interest=vfx&utm_source=linkedin'
      )
      link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(captureVfxLinkClick).toHaveBeenCalledExactlyOnceWith({
        destination: '/contact/',
        placement
      })
    }
  )

  it('opens a card background with the same attribution as its title link', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const root = mount(
      '<section id="workflows"><div data-testid="hub-card"><img alt="Workflow"><a data-testid="hub-card-link" href="https://comfy.org/workflows/storyboard/">Storyboard</a><div role="slider"></div></div></section>'
    )
    within(root)
      .getByRole('img', { name: 'Workflow' })
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(open).toHaveBeenCalledExactlyOnceWith(
      'https://comfy.org/workflows/storyboard/?utm_source=linkedin',
      '_blank',
      'noopener'
    )
    expect(captureVfxLinkClick).toHaveBeenCalledExactlyOnceWith({
      destination: '/workflows/storyboard/',
      placement: 'workflows'
    })
    within(root)
      .getByRole('slider')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('decorates later links and stops tracking after navigation', async () => {
    const root = mount('')
    const link = document.createElement('a')
    link.href = 'https://comfy.org/workflows/storyboard/'
    root.append(link)
    await vi.waitFor(() => expect(link.href).toContain('utm_source=linkedin'))
    link.href = 'https://comfy.org/workflows/storyboard/'
    await vi.waitFor(() => expect(link.href).toContain('utm_source=linkedin'))
    cleanup?.()
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(captureVfxLinkClick).not.toHaveBeenCalled()
  })
})
