// @vitest-environment happy-dom
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { ModelLaunchComparison } from './types'

import ModelLaunchComparisonSection from './ModelLaunchComparisonSection.vue'

const comparison: ModelLaunchComparison<'professional' | 'enterprise'> = {
  headingKey: 'minimaxLicense.comparison.heading',
  primaryCta: {
    labelKey: 'minimaxLicense.comparison.primaryCta',
    href: 'https://comfy.org/contact'
  },
  columns: [
    { id: 'professional', label: { en: 'Professional', 'zh-CN': '专业版' } },
    {
      id: 'enterprise',
      label: { en: 'Enterprise', 'zh-CN': '企业版' },
      featured: true
    }
  ],
  rows: [
    {
      id: 'monthly-price',
      label: { en: 'Monthly price', 'zh-CN': '月费' },
      values: {
        professional: { en: '$5,000', 'zh-CN': '5,000 美元' },
        enterprise: { en: 'Custom', 'zh-CN': '定制' }
      }
    }
  ]
}

const ctaLabel = 'REQUEST LICENSE'

describe('ModelLaunchComparisonSection', () => {
  it('orders every cell to match the column headers', () => {
    render(ModelLaunchComparisonSection, { props: { comparison } })

    const squashed = (el: Element) => el.textContent?.replace(/\s+/g, '') ?? ''
    const row = screen.getByRole('row', { name: /Monthly price/ })

    expect(screen.getAllByRole('columnheader').map(squashed)).toEqual([
      'Professional',
      'Enterprise'
    ])
    expect(within(row).getAllByRole('cell').map(squashed)).toEqual([
      'Professional$5,000',
      'EnterpriseCustom'
    ])
  })

  it('links the CTA at the configured href by default', () => {
    render(ModelLaunchComparisonSection, { props: { comparison } })

    expect(
      screen.getByRole('link', { name: ctaLabel }).getAttribute('href')
    ).toBe('https://comfy.org/contact')
  })

  it('prefers a ctaHref override so localized pages keep their prefix', () => {
    render(ModelLaunchComparisonSection, {
      props: { comparison, locale: 'zh-CN', ctaHref: '/zh-CN/contact' }
    })

    expect(
      screen.getByRole('link', { name: '申请许可' }).getAttribute('href')
    ).toBe('/zh-CN/contact')
  })
})
