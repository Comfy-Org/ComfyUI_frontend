import { render, screen } from '@testing-library/vue'

import type { SummaryLedger } from '@/checkout/summaryLedger'
import CheckoutSummaryColumn from '@/components/fullPage/CheckoutSummaryColumn.vue'
import { createBillingI18n } from '@/i18n'

const UPGRADE: SummaryLedger = {
  family: 'prorated_change',
  eyebrow: 'Upgrade to Pro Plan · Comfy Studios',
  headline: { amount: '$32.50', currency: 'USD' },
  credits: {
    count: '6,850',
    qualifier: 'credits added today (expire July 28)'
  },
  items: [
    {
      label: 'Pro Plan - Prorated',
      amount: '$50.00',
      sublines: ['Remaining time for Pro plan']
    },
    {
      label: 'Creator - Prorated',
      amount: '−$17.50',
      sublines: ['Unused time from Creator plan']
    }
  ],
  adjustments: [],
  chips: [],
  acceptsPromo: true,
  total: '$32.50',
  trailing: ['Existing credits are kept', 'Renews at $100.00 on July 28, 2026']
}

const LANDMARKS = [
  'Pro Plan - Prorated',
  '$50.00',
  'Unused time from Creator plan',
  'Subtotal',
  'Total due today',
  'Renews at $100.00 on July 28, 2026'
]

function renderColumn(ledger?: SummaryLedger) {
  return render(CheckoutSummaryColumn, {
    props: { ledger },
    global: { plugins: [createBillingI18n()] }
  })
}

/** The rendered landmarks and every divider (`---`), in page order. */
function ledgerOutline(): string[] {
  const nodes = [
    ...screen.getAllByRole('separator'),
    ...LANDMARKS.flatMap((text) => screen.queryAllByText(text))
  ]
  return nodes
    .sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    )
    .map((node) => (node.tagName === 'HR' ? '---' : node.textContent.trim()))
}

describe('CheckoutSummaryColumn', () => {
  it('keeps the capture skeleton until the quote arrives', () => {
    renderColumn()

    expect(
      screen.getByRole('region', { name: 'Order summary', busy: true })
    ).toHaveTextContent('Loading…')
    expect(screen.queryAllByRole('separator')).toHaveLength(0)
    expect(screen.queryByText(/USD/)).not.toBeInTheDocument()
  })

  it('renders the header, and divides the ledger only at its sums', () => {
    renderColumn(UPGRADE)

    expect(
      screen.getByText('Upgrade to Pro Plan · Comfy Studios')
    ).toBeInTheDocument()
    expect(screen.getAllByText('$32.50')).toHaveLength(2)
    expect(screen.getByText('USD')).toBeInTheDocument()
    expect(screen.getByText(/credits added today/)).toHaveTextContent(
      '6,850 credits added today (expire July 28)'
    )
    expect(ledgerOutline()).toEqual([
      '---',
      'Pro Plan - Prorated',
      '$50.00',
      'Unused time from Creator plan',
      '---',
      'Total due today',
      'Renews at $100.00 on July 28, 2026'
    ])
  })

  it('divides above a Subtotal when the ledger has one', () => {
    renderColumn({ ...UPGRADE, subtotal: '$32.50' })

    expect(ledgerOutline()).toEqual([
      '---',
      'Pro Plan - Prorated',
      '$50.00',
      'Unused time from Creator plan',
      '---',
      'Subtotal',
      '---',
      'Total due today',
      'Renews at $100.00 on July 28, 2026'
    ])
  })

  it('renders a $0 due quote as the headline and the total, with no row between', () => {
    renderColumn({
      family: 'charge_now',
      eyebrow: 'Subscribe to Team Plan · Comfy Studios',
      headline: { amount: '$0', currency: 'USD' },
      credits: { count: '1,772,400', qualifier: 'credits per year' },
      items: [],
      adjustments: [],
      chips: [],
      acceptsPromo: true,
      total: '$0.00',
      trailing: ['Renews at $100.00 on July 28, 2026']
    })

    expect(ledgerOutline()).toEqual([
      '---',
      'Total due today',
      'Renews at $100.00 on July 28, 2026'
    ])
    expect(screen.getByText('$0.00')).toBeInTheDocument()
  })

  it('prices a held discount, then the Subtotal an entered code applied to', () => {
    render(CheckoutSummaryColumn, {
      props: {
        ledger: {
          ...UPGRADE,
          items: [UPGRADE.items[0]],
          adjustments: [{ label: 'Education discount', amount: '−$10.00' }],
          subtotal: '$40.00',
          promo: { label: 'Promo code', amount: '−$7.50' }
        }
      },
      slots: { default: '<p>chips and entry</p>' },
      global: { plugins: [createBillingI18n()] }
    })

    const expected = [
      'Pro Plan - Prorated',
      'Education discount',
      '−$10.00',
      'Subtotal',
      '$40.00',
      'Promo code',
      '−$7.50',
      'chips and entry',
      'Total due today'
    ]
    const rendered = expected
      .map((text) => screen.getByText(text))
      .sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      )
      .map((node) => node.textContent.trim())
    expect(rendered).toEqual(expected)
  })

  it('shows a scheduled rate beside the currency', () => {
    renderColumn({
      ...UPGRADE,
      family: 'scheduled',
      headline: { amount: '$35', currency: 'USD', rate: '/ mo' }
    })

    expect(screen.getByText('$35')).toBeInTheDocument()
    expect(screen.getByText(/USD/)).toHaveTextContent('USD / mo')
  })
})

describe('CheckoutSummaryColumn held discounts', () => {
  const held = (...rows: [string, string][]): SummaryLedger => ({
    ...UPGRADE,
    items: [UPGRADE.items[0]],
    adjustments: rows.map(([label, amount]) => ({ label, amount }))
  })
  const heldRows = () =>
    screen
      .getAllByRole('listitem')
      .map((row) => row.textContent.trim())
      .filter((text) => /discount|Promo code/.test(text))

  it('re-prices two unnamed held discounts as rows of their own', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { rerender } = renderColumn(
      held(['Promo code', '−$10.00'], ['Education discount', '−$4.00'])
    )

    await rerender({
      ledger: held(
        ['Education discount', '−$4.00'],
        ['Promo code', '−$10.00'],
        ['Promo code', '−$5.00']
      )
    })

    expect(heldRows()).toEqual([
      'Education discount−$4.00',
      'Promo code−$10.00',
      'Promo code−$5.00'
    ])
    expect(warn).not.toHaveBeenCalled()
  })
})
