// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import CloudPricingSection from './CloudPricingSection.vue'

const showFreeTier = vi.hoisted(() => ({ value: true }))
vi.mock('../../config/features', () => ({
  get SHOW_FREE_TIER() {
    return showFreeTier.value
  }
}))

afterEach(() => {
  showFreeTier.value = true
})

function isBefore(first: Element, second: Element) {
  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
  )
}

describe('CloudPricingSection', () => {
  it('renders the free-tier banner between the billing toggle and the plan cards', () => {
    render(CloudPricingSection)

    const billingToggle = screen.getByText('Monthly')
    const banner = screen.getByText("Start free. Upgrade when you're ready.")
    const planCards = screen.getByText('MOST POPULAR')

    expect(isBefore(billingToggle, banner)).toBe(true)
    expect(isBefore(banner, planCards)).toBe(true)
  })

  it('points the banner CTA at Comfy Cloud in a new tab', () => {
    render(CloudPricingSection)

    const cta = screen.getByRole('link', { name: 'TRY FREE' })
    expect(cta.getAttribute('href')).toBe('https://cloud.comfy.org')
    expect(cta.getAttribute('target')).toBe('_blank')
  })

  it('localizes the banner for the zh-CN page', () => {
    render(CloudPricingSection, { props: { locale: 'zh-CN' } })

    expect(screen.getByText('免费开始，准备好了再升级。')).toBeTruthy()
    expect(screen.getByRole('link', { name: '免费试用' })).toBeTruthy()
    expect(screen.queryByText(/Start free/)).toBeNull()
  })

  it('keeps the plan cards but drops the banner while SHOW_FREE_TIER is off', () => {
    showFreeTier.value = false

    render(CloudPricingSection)

    expect(screen.queryByText(/Start free/)).toBeNull()
    expect(screen.queryByRole('link', { name: 'TRY FREE' })).toBeNull()
    expect(screen.getByText('MOST POPULAR')).toBeTruthy()
  })
})
