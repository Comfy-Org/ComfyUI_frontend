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
      id: 'example-row',
      label: { en: 'Example row', 'zh-CN': '示例行' },
      values: {
        professional: { en: 'First value', 'zh-CN': '第一个值' },
        enterprise: { en: 'Second value', 'zh-CN': '第二个值' }
      }
    }
  ]
}

const ctaLabel = 'REQUEST LICENSE'

describe('ModelLaunchComparisonSection', () => {
  it('orders every cell to match the column headers', () => {
    render(ModelLaunchComparisonSection, { props: { comparison } })

    const text = (el: Element) =>
      el.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    const row = screen.getByRole('row', { name: /Example row/ })

    expect(screen.getAllByRole('columnheader').map(text)).toEqual([
      'Professional',
      'Enterprise'
    ])
    expect(within(row).getAllByRole('cell').map(text)).toEqual([
      'ProfessionalFirst value',
      'EnterpriseSecond value'
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
