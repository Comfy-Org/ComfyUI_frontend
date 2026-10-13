import { within } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CampaignVertical } from '@/scripts/posthog'
import { captureAgencyLinkClick, captureVfxLinkClick } from '@/scripts/posthog'
import { mountAgencyCampaign } from './vfx-campaign'

vi.mock(import('@/scripts/posthog'))
let cleanup: (() => void) | undefined

afterEach(() => {
  cleanup?.()
  document.body.replaceChildren()
  window.history.replaceState(null, '', '/')
})
function mount(
  markup: string,
  vertical: CampaignVertical,
  partner?: 'black-math'
) {
  window.history.replaceState(null, '', `/${vertical}/?utm_source=linkedin`)
  const root = document.createElement('div')
  root.innerHTML = markup
  document.body.append(root)
  cleanup = mountAgencyCampaign(root, vertical, partner)
  return root
}

describe('agency campaign journey', () => {
  it('keeps Black Math inquiry attribution through the contact click', () => {
    const root = mount(
      '<section data-campaign-hero><a href="/contact/?interest=vfx&campaign_type=agency-led&agency_partner=black-math">Discuss your project</a></section>',
      'vfx',
      'black-math'
    )
    const link = within(root).getByRole('link', {
      name: 'Discuss your project'
    })
    expect(link).toHaveAttribute(
      'href',
      '/contact/?interest=vfx&campaign_type=agency-led&agency_partner=black-math&utm_source=linkedin'
    )
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(captureAgencyLinkClick).toHaveBeenCalledExactlyOnceWith({
      vertical: 'vfx',
      campaign_type: 'agency-led',
      agency_partner: 'black-math',
      destination: '/contact/',
      placement: 'hero'
    })
  })

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
        vertical
      )
      const link = within(root).getByRole('link')
      expect(link.getAttribute('href')).toBe(
        `/contact/?interest=${vertical}&campaign_type=agency-led&utm_source=linkedin`
      )
      link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(captureAgencyLinkClick).toHaveBeenCalledExactlyOnceWith({
        vertical,
        campaign_type: 'agency-led',
        destination: '/contact/',
        placement: 'hero'
      })
      expect(captureVfxLinkClick).not.toHaveBeenCalled()
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
        'advertising'
      )
      within(root)
        .getByRole('link', { name: 'Contact' })
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(captureAgencyLinkClick).toHaveBeenCalledExactlyOnceWith({
        vertical: 'advertising',
        campaign_type: 'agency-led',
        destination: '/contact/',
        placement
      })
    }
  )

  it('carries attribution into hydrated agency cards without recording query values', async () => {
    const root = mount('', 'film-animation')
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
    const root = mount('<video aria-label="Hero"></video>', 'vfx')
    const hero = within(root).getByLabelText<HTMLVideoElement>('Hero')
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
