// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubIntersectionObserver } from '../../test/fakeIntersectionObserver'
import HeroGraphSection from './HeroGraphSection.vue'

vi.mock('./camera/CameraWidget', () => ({
  CameraWidget: class {
    setState = vi.fn()
    pause = vi.fn()
    resume = vi.fn()
    dispose = vi.fn()
  }
}))

describe('HeroGraphSection', () => {
  beforeEach(() => {
    stubIntersectionObserver()
  })

  it('renders the graph hero and the mobile flow with their own CTAs', () => {
    render(HeroGraphSection)

    // One desktop and one mobile copy of the pipeline.
    expect(screen.getAllByRole('slider', { name: 'HUE' })).toHaveLength(2)
    expect(
      screen.getAllByAltText(
        'Generated image rendered from the selected camera angle'
      )
    ).toHaveLength(2)

    const ctas = screen.getAllByRole('link', { name: 'Get started for free' })
    expect(ctas.length).toBeGreaterThanOrEqual(2)
    for (const cta of ctas)
      expect(cta.getAttribute('href')).toContain('cloud.comfy.org')
  })

  it('localizes the headline and CTA for zh-CN', () => {
    render(HeroGraphSection, { props: { locale: 'zh-CN' } })

    expect(
      screen.getAllByRole('link', { name: '免费开始使用' }).length
    ).toBeGreaterThanOrEqual(2)
  })
})
