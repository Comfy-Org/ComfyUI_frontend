import { render, screen } from '@testing-library/vue'

import type { PromoEntry } from '@/checkout/promoEntry'
import type { PromoChip } from '@/checkout/summaryLedger'
import PromoCodeEntry from '@/components/fullPage/summary/PromoCodeEntry.vue'
import { createBillingI18n } from '@/i18n'

function renderEntry({
  chips = [],
  entry = { kind: 'idle' },
  accepts = true,
  live = true
}: {
  chips?: PromoChip[]
  entry?: PromoEntry
  accepts?: boolean
  live?: boolean
}) {
  return render(PromoCodeEntry, {
    props: { chips, entry, accepts, live },
    global: { plugins: [createBillingI18n()] }
  })
}

const HELD: PromoChip = { code: 'COMFY-EDU', removable: false }
const ENTERED: PromoChip = { code: 'COMFY50', removable: true }

describe('PromoCodeEntry', () => {
  it('shows a held chip with no remove beside the Add control, which it does not count against', () => {
    renderEntry({ chips: [HELD] })

    expect(screen.getByText('COMFY-EDU')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Remove/ })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add promo code' })).toBeEnabled()
  })

  it('hides the Add control while the one entered code is applied', () => {
    renderEntry({
      chips: [HELD, ENTERED],
      entry: { kind: 'applied', code: 'COMFY50' }
    })

    expect(screen.getByRole('button', { name: 'Remove COMFY50' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Add promo code' })
    ).not.toBeInTheDocument()
  })

  it.for<{ name: string; entry: PromoEntry; control: string }>([
    {
      name: 'the Add control',
      entry: { kind: 'idle' },
      control: 'Add promo code'
    },
    { name: 'Apply', entry: { kind: 'editing', draft: 'X' }, control: 'Apply' },
    {
      name: 'a chip remove',
      entry: { kind: 'applied', code: 'COMFY50' },
      control: 'Remove COMFY50'
    }
  ])('locks $name while promo entry is not live', ({ entry, control }) => {
    renderEntry({ chips: [ENTERED], entry, live: false })

    expect(screen.getByRole('button', { name: control })).toBeDisabled()
  })

  it('says a code it could not check apart from one the server refused', () => {
    renderEntry({
      entry: { kind: 'rejected', draft: 'LAUNCH20', reason: 'unchecked' }
    })

    expect(
      screen.getByText("We couldn't check this code. Try again.")
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Promo code' })).toHaveValue(
      'LAUNCH20'
    )
  })

  it('renders no entry anywhere on a charge that takes no code', () => {
    renderEntry({ accepts: false })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
