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
    qualifier: 'credits added today (expire July 28, 2026)'
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
      '6,850 credits added today (expire July 28, 2026)'
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
