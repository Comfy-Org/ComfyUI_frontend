// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import CloudPricingSection from './CloudPricingSection.vue'

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
})
