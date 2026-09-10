// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubIntersectionObserver } from '../../test/fakeIntersectionObserver'
import type * as CameraWidgetModule from './camera/CameraWidget'
import HeroGraphSection from './HeroGraphSection.vue'

// The concrete class has private fields, so a structural fake cannot implement
// it. Pin the fake to the public surface these tests drive instead.
type CameraWidgetContract = Pick<
  CameraWidgetModule.CameraWidget,
  'setState' | 'pause' | 'resume' | 'dispose'
>

class FakeCameraWidget implements CameraWidgetContract {
  setState = vi.fn()
  pause = vi.fn()
  resume = vi.fn()
  dispose = vi.fn()
}

vi.mock(import('./camera/CameraWidget'), () => ({
  CameraWidget:
    FakeCameraWidget as unknown as typeof CameraWidgetModule.CameraWidget
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
