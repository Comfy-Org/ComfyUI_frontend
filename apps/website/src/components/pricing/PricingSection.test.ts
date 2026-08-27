// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import PricingSection from './PricingSection.vue'

describe('PricingSection credit allotment copy', () => {
  it('states the monthly allotment on the monthly cycle', () => {
    render(PricingSection, { props: { defaultBillingCycle: 'monthly' } })

    expect(screen.getAllByText('monthly credits')).toHaveLength(4)
    expect(screen.queryAllByText('credits per year')).toHaveLength(0)
    expect(screen.getByText('4,200')).toBeTruthy()
    expect(screen.getByText('21,100')).toBeTruthy()
    expect(screen.getByText('Generates ~380 5s videos*')).toBeTruthy()
  })

  it('states the whole-year allotment on the yearly cycle', () => {
    render(PricingSection, { props: { defaultBillingCycle: 'yearly' } })

    expect(screen.getAllByText('credits per year')).toHaveLength(4)
    expect(screen.queryAllByText('monthly credits')).toHaveLength(0)
    expect(screen.getByText('50,400')).toBeTruthy()
    expect(screen.getByText('253,200')).toBeTruthy()
    expect(screen.getByText('Generates ~4,560 5s videos*')).toBeTruthy()
  })

  it('scales the team allotment with the billing cycle', () => {
    render(PricingSection, { props: { defaultBillingCycle: 'yearly' } })

    expect(screen.getByText('1,772,400')).toBeTruthy()
    expect(screen.getByText('Generates ~160,860 5s videos*')).toBeTruthy()
  })

  it('re-labels the credits when the billing toggle changes', async () => {
    const user = userEvent.setup()
    render(PricingSection, { props: { defaultBillingCycle: 'monthly' } })

    await user.click(screen.getByRole('button', { name: /^Yearly/ }))

    expect(screen.getAllByText('credits per year')).toHaveLength(4)
    expect(screen.getByText('50,400')).toBeTruthy()
  })

  it('localizes the yearly credit label', () => {
    render(PricingSection, {
      props: { defaultBillingCycle: 'yearly', locale: 'zh-CN' }
    })

    expect(screen.getAllByText('年度积分')).toHaveLength(4)
    expect(screen.queryAllByText('每月积分')).toHaveLength(0)
  })
})
