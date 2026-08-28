// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { minimaxLicensePage } from '../../data/minimaxLicense'
import ModelLaunchRateCardSection from './ModelLaunchRateCardSection.vue'

// The live /minimax/license config, so a refactor of the shared section cannot
// quietly change the rate card that page (and /cloud/pricing) ships.
const { rateCard } = minimaxLicensePage
if (!rateCard)
  throw new Error('minimaxLicensePage.rateCard is no longer defined')

describe('ModelLaunchRateCardSection', () => {
  it('renders the /minimax/license rate card from its page config', () => {
    render(ModelLaunchRateCardSection, { props: { rateCard } })

    expect(
      screen.getByRole('heading', { level: 2, name: 'License pricing' })
    ).toBeTruthy()
    expect(screen.getByText('$5,000')).toBeTruthy()
    expect(screen.getByText('per month')).toBeTruthy()
    expect(
      screen.getByRole('columnheader', { name: /Enterprise/ })
    ).toBeTruthy()
    expect(
      screen.getByRole('rowheader', { name: 'Licensed users' })
    ).toBeTruthy()
    expect(screen.getByText('12-month minimum')).toBeTruthy()

    const cta = screen.getByRole('link', { name: 'REQUEST LICENSE' })
    expect(cta.getAttribute('href')).toBe('https://comfy.org/contact')
  })

  it('renders the rate card in zh-CN', () => {
    render(ModelLaunchRateCardSection, {
      props: { rateCard, locale: 'zh-CN' }
    })

    expect(
      screen.getByRole('heading', { level: 2, name: '许可定价' })
    ).toBeTruthy()
    expect(screen.getByText('每月')).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: '授权用户' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '申请许可' })).toBeTruthy()
    expect(screen.queryByText('per month')).toBeNull()
  })
})
