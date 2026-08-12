// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import PricingFreeBanner from './PricingFreeBanner.vue'

type BannerProps = ComponentProps<typeof PricingFreeBanner>

const defaultProps = {
  titleKey: 'pricing.banner.title',
  subtitleKey: 'pricing.banner.subtitle',
  cta: {
    labelKey: 'pricing.banner.cta',
    href: 'https://cloud.comfy.org',
    target: '_blank'
  }
} satisfies BannerProps

function renderBanner(props: Partial<BannerProps> = {}) {
  return render(PricingFreeBanner, { props: { ...defaultProps, ...props } })
}

describe('PricingFreeBanner', () => {
  it('renders the English title, subtitle and CTA by default', () => {
    renderBanner()

    expect(
      screen.getByText("Start free. Upgrade when you're ready.")
    ).toBeTruthy()
    expect(screen.getByText(/no credit card required/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'TRY FREE' })).toBeTruthy()
  })

  it('points the CTA at Comfy Cloud in a new tab', () => {
    renderBanner()

    const cta = screen.getByRole('link', { name: 'TRY FREE' })
    expect(cta.getAttribute('href')).toBe('https://cloud.comfy.org')
    expect(cta.getAttribute('target')).toBe('_blank')
  })

  it('forwards whatever CTA href and target it is given', () => {
    renderBanner({
      cta: {
        labelKey: 'pricing.banner.cta',
        href: 'https://example.com/signup',
        target: '_self'
      }
    })

    const cta = screen.getByRole('link', { name: 'TRY FREE' })
    expect(cta.getAttribute('href')).toBe('https://example.com/signup')
    expect(cta.getAttribute('target')).toBe('_self')
  })

  it('localizes every string when given the zh-CN locale', () => {
    renderBanner({ locale: 'zh-CN' })

    expect(screen.getByText('免费开始，准备好了再升级。')).toBeTruthy()
    expect(screen.getByText(/在真实 GPU 上免费运行 5 次/)).toBeTruthy()
    expect(screen.getByRole('link', { name: '免费试用' })).toBeTruthy()
    expect(screen.queryByText(/Start free/)).toBeNull()
    expect(screen.queryByText(/no credit card required/)).toBeNull()
    expect(screen.queryByRole('link', { name: 'TRY FREE' })).toBeNull()
  })
})
