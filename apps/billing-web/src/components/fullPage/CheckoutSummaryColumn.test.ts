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
  discounts: [],
  chips: [],
  acceptsPromo: true,
  total: '$32.50',
  trailing: ['Existing credits are kept', 'Renews at $100.00 on July 28, 2026']
}

const LANDMARKS = [
  'Pro Plan - Prorated',
  '$50.00',
  'Unused time from Creator plan',
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

  it('renders a $0 due quote as the headline and the total, with no row between', () => {
    renderColumn({
      family: 'charge_now',
      eyebrow: 'Subscribe to Team Plan · Comfy Studios',
      headline: { amount: '$0', currency: 'USD' },
      credits: { count: '1,772,400', qualifier: 'credits per year' },
      items: [],
      discounts: [],
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

  it('lists every discount row in the ledger order, above the chips', () => {
    render(CheckoutSummaryColumn, {
      props: {
        ledger: {
          ...UPGRADE,
          items: [UPGRADE.items[0]],
          discounts: [
            { label: 'Promo code', amount: '−$7.50' },
            { label: 'Education discount', amount: '−$10.00' }
          ]
        }
      },
      slots: { default: '<p>chips and entry</p>' },
      global: { plugins: [createBillingI18n()] }
    })

    const expected = [
      'Pro Plan - Prorated',
      'Promo code',
      '−$7.50',
      'Education discount',
      '−$10.00',
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

describe('CheckoutSummaryColumn discount rows', () => {
  const discounted = (...rows: [string, string][]): SummaryLedger => ({
    ...UPGRADE,
    items: [UPGRADE.items[0]],
    discounts: rows.map(([label, amount]) => ({ label, amount }))
  })
  const discountRows = () =>
    screen
      .getAllByRole('listitem')
      .map((row) => row.textContent.trim())
      .filter((text) => /discount|Promo code/.test(text))

  it('re-prices two unnamed discounts as rows of their own', async () => {
    const { rerender } = renderColumn(
      discounted(['Promo code', '−$10.00'], ['Education discount', '−$4.00'])
    )

    await rerender({
      ledger: discounted(
        ['Education discount', '−$4.00'],
        ['Promo code', '−$10.00'],
        ['Promo code', '−$5.00']
      )
    })

    expect(discountRows()).toEqual([
      'Education discount−$4.00',
      'Promo code−$10.00',
      'Promo code−$5.00'
    ])
    expect(console.warn).not.toHaveBeenCalled()
  })
})

describe('CheckoutSummaryColumn server-reported rows', () => {
  function inPageOrder(nodes: Element[]): string[] {
    return nodes
      .sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      )
      .map((node) => (node.tagName === 'HR' ? '---' : node.textContent.trim()))
  }

  it('strikes through only the list price of a discounted rate', () => {
    renderColumn({
      ...UPGRADE,
      items: [
        {
          label: 'Team Plan',
          amount: '$7,560.00',
          comparedRate: {
            keypath: 'checkout.fullPage.summary.item.comparedYearly',
            amount: '$7,560',
            listAmount: '$8,400'
          },
          sublines: []
        }
      ]
    })

    expect(screen.getByText('$8,400').tagName).toBe('S')
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'SPAN' &&
          element.textContent.trim() === '$7,560 $8,400 /yr, billed yearly'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('$7,560.00').tagName).not.toBe('S')
  })

  it('bounds a discount by its term under its label', () => {
    renderColumn({
      ...UPGRADE,
      items: [UPGRADE.items[0]],
      discounts: [
        { label: 'Promo code', amount: '−$1,512.00', subline: 'First year' }
      ]
    })

    expect(
      inPageOrder([
        screen.getByText('First year'),
        screen.getByText('Promo code'),
        screen.getByText('Total due today')
      ])
    ).toEqual(['Promo code', 'First year', 'Total due today'])
  })

  it('divides a Subtotal off the money rows, then lists the discount and last the account balance', () => {
    renderColumn({
      ...UPGRADE,
      subtotal: '$32.50',
      discounts: [{ label: 'Promo code', amount: '−$10.00' }],
      balance: {
        label: 'Account balance',
        amount: '−$5.00',
        subline: 'Credit already on your account'
      },
      total: '$17.50'
    })

    const labels = [
      'Unused time from Creator plan',
      'Subtotal',
      'Promo code',
      '−$10.00',
      'Account balance',
      '−$5.00',
      'Credit already on your account',
      'Total due today'
    ]
    const outline = inPageOrder([
      ...screen.getAllByRole('separator'),
      ...labels.map((text) => screen.getByText(text))
    ])
    expect(outline).toEqual([
      '---',
      'Unused time from Creator plan',
      '---',
      'Subtotal',
      'Promo code',
      '−$10.00',
      'Account balance',
      '−$5.00',
      'Credit already on your account',
      '---',
      'Total due today'
    ])
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'DIV' &&
          element.textContent.replace(/\s/g, '') === 'Subtotal$32.50'
      )
    ).toBeInTheDocument()
  })

  it('lists no Subtotal and no balance row when the ledger has neither', () => {
    renderColumn(UPGRADE)

    expect(screen.queryByText('Subtotal')).not.toBeInTheDocument()
    expect(screen.queryByText('Account balance')).not.toBeInTheDocument()
  })
})
