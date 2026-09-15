import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { minimaxLicenseComparison } from '../../data/minimaxLicense'
import MinimaxLicensePricingSection from './MinimaxLicensePricingSection.vue'

const { columns, rows } = minimaxLicenseComparison
const contactSalesCount = rows.flatMap((row) =>
  row.cells.filter((cell) => cell.en === 'Contact sales')
).length

describe('MinimaxLicensePricingSection', () => {
  it('renders the English heading, description and CTA by default', () => {
    render(MinimaxLicensePricingSection)

    expect(screen.getByText('MiniMax license pricing')).toBeTruthy()
    expect(
      screen.getByText(/Comfy Cloud already includes commercial use/)
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'See license tiers' })).toBeTruthy()
  })

  it('renders a column header and a labelled row for every tier', () => {
    render(MinimaxLicensePricingSection, { props: { locale: 'en' } })

    for (const column of columns) {
      expect(
        screen.getByRole('columnheader', { name: column.label.en })
      ).toBeTruthy()
    }
    for (const row of rows) {
      expect(screen.getByRole('rowheader', { name: row.label.en })).toBeTruthy()
    }
    // The leading spacer cell means the table has one more column than tiers.
    expect(screen.getAllByRole('columnheader')).toHaveLength(columns.length + 1)
    expect(screen.getAllByRole('row')).toHaveLength(rows.length + 1)
  })

  it('renders every cell against the tier it belongs to', () => {
    render(MinimaxLicensePricingSection, { props: { locale: 'en' } })

    // Skip the header row, so body rows line up with the data rows by index.
    const [, ...bodyRows] = screen.getAllByRole('row')
    for (const [rowIndex, row] of rows.entries()) {
      const scope = within(bodyRows[rowIndex])
      expect(scope.getByRole('rowheader').textContent.trim()).toBe(row.label.en)
      const cells = scope.getAllByRole('cell')
      expect(cells).toHaveLength(row.cells.length)
      for (const [index, cell] of row.cells.entries()) {
        expect(cells[index]?.textContent?.trim()).toBe(cell.en)
      }
    }
  })

  it('links every Contact sales cell to the contact page and leaves other cells plain', () => {
    render(MinimaxLicensePricingSection, { props: { locale: 'en' } })

    const contactLinks = screen.getAllByRole('link', { name: 'Contact sales' })
    expect(contactLinks).toHaveLength(contactSalesCount)
    for (const link of contactLinks) {
      expect(link.getAttribute('href')).toBe('/contact')
    }

    const priceCell = screen.getByRole('cell', { name: 'From $5,000 / month' })
    expect(within(priceCell).queryByRole('link')).toBeNull()
  })

  it('localizes the Contact sales links for zh-CN', () => {
    render(MinimaxLicensePricingSection, { props: { locale: 'zh-CN' } })

    const contactLinks = screen.getAllByRole('link', { name: '联系销售' })
    expect(contactLinks).toHaveLength(contactSalesCount)
    for (const link of contactLinks) {
      expect(link.getAttribute('href')).toBe('/zh-CN/contact')
    }

    const priceCell = screen.getByRole('cell', { name: '5,000 美元 / 月起' })
    expect(within(priceCell).queryByRole('link')).toBeNull()
  })

  it('points the CTA at the license page', () => {
    render(MinimaxLicensePricingSection, { props: { locale: 'en' } })

    const cta = screen.getByRole('link', { name: 'See license tiers' })
    expect(cta.getAttribute('href')).toBe('/minimax/license')
  })

  it('re-resolves the CTA route when the locale prop changes', async () => {
    const { rerender } = render(MinimaxLicensePricingSection, {
      props: { locale: 'en' as const }
    })
    expect(
      screen
        .getByRole('link', { name: 'See license tiers' })
        .getAttribute('href')
    ).toBe('/minimax/license')

    await rerender({ locale: 'zh-CN' })

    expect(
      screen.getByRole('link', { name: '查看许可级别' }).getAttribute('href')
    ).toBe('/zh-CN/minimax/license')
  })

  it('localizes the copy, the table and the CTA route for zh-CN', () => {
    render(MinimaxLicensePricingSection, { props: { locale: 'zh-CN' } })

    expect(screen.getByText('MiniMax 许可定价')).toBeTruthy()
    expect(screen.getByText(/Comfy Cloud 已包含商业使用权/)).toBeTruthy()

    const cta = screen.getByRole('link', { name: '查看许可级别' })
    expect(cta.getAttribute('href')).toBe('/zh-CN/minimax/license')

    for (const column of columns) {
      expect(
        screen.getByRole('columnheader', { name: column.label['zh-CN'] })
      ).toBeTruthy()
    }
    for (const row of rows) {
      expect(
        screen.getByRole('rowheader', { name: row.label['zh-CN'] })
      ).toBeTruthy()
    }

    expect(screen.queryByText('MiniMax license pricing')).toBeNull()
    expect(screen.queryByRole('link', { name: 'See license tiers' })).toBeNull()
  })
})
