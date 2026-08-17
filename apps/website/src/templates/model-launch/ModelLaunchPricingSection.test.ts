// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { minimaxPage } from '../../data/minimax'
import ModelLaunchPricingSection from './ModelLaunchPricingSection.vue'

// The live /minimax config, so a refactor of the shared banner cannot quietly
// change what that page ships. `pricing` is optional on a launch page, so fail
// loudly here rather than silently testing an empty section.
const { pricing } = minimaxPage
if (!pricing) throw new Error('minimaxPage.pricing is no longer defined')

describe('ModelLaunchPricingSection', () => {
  it('still renders the /minimax banner from its page config', () => {
    render(ModelLaunchPricingSection, { props: { pricing, locale: 'en' } })

    expect(
      screen.getByText("Start free. Upgrade when you're ready.")
    ).toBeTruthy()
    expect(screen.getByText(/5 free runs on real GPUs/)).toBeTruthy()

    const cta = screen.getByRole('link', { name: 'TRY FREE' })
    expect(cta.getAttribute('href')).toBe('https://cloud.comfy.org')
    expect(cta.getAttribute('target')).toBe('_blank')
  })

  it('renders the /minimax banner in zh-CN', () => {
    render(ModelLaunchPricingSection, { props: { pricing, locale: 'zh-CN' } })

    expect(screen.getByText('免费开始，准备好了再升级。')).toBeTruthy()
    expect(screen.getByText(/在真实 GPU 上免费运行 5 次/)).toBeTruthy()

    const cta = screen.getByRole('link', { name: '免费试用' })
    expect(cta.getAttribute('href')).toBe('https://cloud.comfy.org')
    expect(cta.getAttribute('target')).toBe('_blank')
    expect(screen.queryByText(/Start free/)).toBeNull()
  })

  it('omits the banner when a page config does not define one', () => {
    render(ModelLaunchPricingSection, {
      props: { pricing: { defaultBillingCycle: 'monthly' }, locale: 'en' }
    })

    expect(screen.queryByRole('link', { name: 'TRY FREE' })).toBeNull()
    expect(screen.getByText('Choose a plan')).toBeTruthy()
  })
})
