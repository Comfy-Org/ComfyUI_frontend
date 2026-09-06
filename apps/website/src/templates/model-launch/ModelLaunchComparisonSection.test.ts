// @vitest-environment happy-dom
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { ModelLaunchComparison } from './types'

import { minimaxLicenseComparison } from '../../data/minimaxLicense'
import ModelLaunchComparisonSection from './ModelLaunchComparisonSection.vue'

const comparison: ModelLaunchComparison = {
  headingKey: 'minimaxLicense.comparison.heading',
  columns: [
    { id: 'professional', label: { en: 'Professional', 'zh-CN': '专业版' } },
    { id: 'enterprise', label: { en: 'Enterprise', 'zh-CN': '企业版' } }
  ],
  rows: [
    {
      id: 'price',
      label: { en: 'Price', 'zh-CN': '价格' },
      cells: [
        { en: 'From $5,000 / month', 'zh-CN': '5,000 美元 / 月起' },
        { en: 'Contact sales', 'zh-CN': '联系销售' }
      ]
    },
    {
      id: 'support',
      label: { en: 'Support', 'zh-CN': '支持' },
      cells: [
        { en: 'Email', 'zh-CN': '电子邮件' },
        { en: 'Dedicated', 'zh-CN': '专属' }
      ]
    }
  ]
}

/** Body rows only: the header row is dropped so indexes match `rows`. */
function bodyRows() {
  const [, ...rest] = screen.getAllByRole('row')
  return rest
}

describe('ModelLaunchComparisonSection', () => {
  it('renders the localized heading', () => {
    render(ModelLaunchComparisonSection, { props: { comparison } })

    expect(
      screen.getByRole('heading', { name: 'Compare license tiers' })
    ).toBeTruthy()
  })

  it('renders a header per column, after the leading spacer cell', () => {
    render(ModelLaunchComparisonSection, {
      props: { comparison, locale: 'en' }
    })

    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(comparison.columns.length + 1)
    expect(headers[0]?.textContent?.trim()).toBe('')
    expect(headers.slice(1).map((h) => h.textContent?.trim())).toEqual([
      'Professional',
      'Enterprise'
    ])
  })

  it('renders each row label with its cells in column order', () => {
    render(ModelLaunchComparisonSection, {
      props: { comparison, locale: 'en' }
    })

    const rows = bodyRows()
    expect(rows).toHaveLength(comparison.rows.length)
    for (const [index, row] of comparison.rows.entries()) {
      const scope = within(rows[index]!)
      expect(scope.getByRole('rowheader').textContent?.trim()).toBe(
        row.label.en
      )
      expect(
        scope.getAllByRole('cell').map((cell) => cell.textContent?.trim())
      ).toEqual(row.cells.map((cell) => cell.en))
    }
  })

  it('localizes the heading, headers and cells for zh-CN', () => {
    render(ModelLaunchComparisonSection, {
      props: { comparison, locale: 'zh-CN' }
    })

    expect(screen.getByRole('heading', { name: '许可级别对比' })).toBeTruthy()
    expect(
      screen
        .getAllByRole('columnheader')
        .slice(1)
        .map((header) => header.textContent?.trim())
    ).toEqual(['专业版', '企业版'])
    expect(
      within(bodyRows()[0]!)
        .getAllByRole('cell')
        .map((cell) => cell.textContent?.trim())
    ).toEqual(['5,000 美元 / 月起', '联系销售'])
    expect(screen.queryByText('Professional')).toBeNull()
  })

  it('falls back to English when a locale string is empty', () => {
    render(ModelLaunchComparisonSection, {
      props: {
        locale: 'zh-CN',
        comparison: {
          ...comparison,
          columns: [{ id: 'pro', label: { en: 'Professional', 'zh-CN': '' } }],
          rows: [
            {
              id: 'price',
              label: { en: 'Price', 'zh-CN': '' },
              cells: [{ en: 'From $5,000 / month', 'zh-CN': '' }]
            }
          ]
        }
      }
    })

    expect(
      screen.getByRole('columnheader', { name: 'Professional' })
    ).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'Price' })).toBeTruthy()
    expect(
      screen.getByRole('cell', { name: 'From $5,000 / month' })
    ).toBeTruthy()
  })

  it('leaves a trailing column empty when a row is short a cell', () => {
    render(ModelLaunchComparisonSection, {
      props: {
        comparison: {
          ...comparison,
          rows: [
            {
              id: 'short',
              label: { en: 'Short', 'zh-CN': '短' },
              cells: [{ en: 'Only cell', 'zh-CN': '仅此单元格' }]
            }
          ]
        }
      }
    })

    // Two columns are declared but one cell is supplied, so the table renders a
    // ragged row rather than padding it out.
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
    expect(within(bodyRows()[0]!).getAllByRole('cell')).toHaveLength(1)
  })

  it('renders the real /minimax/license comparison', () => {
    render(ModelLaunchComparisonSection, {
      props: { comparison: minimaxLicenseComparison, locale: 'en' }
    })

    expect(bodyRows()).toHaveLength(minimaxLicenseComparison.rows.length)
    expect(screen.getAllByRole('columnheader')).toHaveLength(
      minimaxLicenseComparison.columns.length + 1
    )
  })
})
