import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { AddCreditsRefusal } from '@comfyorg/account-core/billing'

import AddCreditsDialog from './AddCreditsDialog.vue'
import type {
  AddCreditsCheckoutResult,
  AddCreditsCheckoutTab,
  AddCreditsPorts,
  AddCreditsQuoteResult
} from './useAddCreditsDialog'

const CHECKOUT_URL = 'https://billing.comfy.org/topup?session=cs_1'
const SUPPORT_URL = 'https://support.example/billing'
const CREDITS_PER_CENT = 2.11

class FakeTab implements AddCreditsCheckoutTab {
  url: string | undefined
  closed = false
  navigate(url: string) {
    this.url = url
  }
  close() {
    this.closed = true
  }
}

class FakePorts implements AddCreditsPorts {
  quotes: number[] = []
  checkouts: number[] = []
  tabs: FakeTab[] = []
  popupsBlocked = false
  quoteFails = false
  quoteHeld = false
  checkoutAnswer: AddCreditsCheckoutResult | undefined = {
    status: 'ok',
    url: CHECKOUT_URL
  }
  checkoutHeld: ((answer: AddCreditsCheckoutResult) => void) | undefined
  landed: (() => void) | undefined
  watchStopped = false

  quote = (amountCents: number): Promise<AddCreditsQuoteResult> => {
    this.quotes.push(amountCents)
    if (this.quoteHeld) return new Promise(() => {})
    return Promise.resolve(
      this.quoteFails
        ? { status: 'error' }
        : { status: 'ok', credits: Math.round(amountCents * CREDITS_PER_CENT) }
    )
  }

  createCheckout = (amountCents: number) => {
    this.checkouts.push(amountCents)
    return new Promise<AddCreditsCheckoutResult>((resolve) => {
      this.checkoutHeld = resolve
      if (this.checkoutAnswer) resolve(this.checkoutAnswer)
    })
  }

  reserveTab = () => {
    if (this.popupsBlocked) return null
    const tab = new FakeTab()
    this.tabs.push(tab)
    return tab
  }

  watchPayment = (landed: () => void) => {
    this.landed = landed
    return () => {
      this.watchStopped = true
    }
  }

  refuse(refusal: AddCreditsRefusal) {
    this.checkoutAnswer = { status: 'error', refusal }
  }
}

type Props = InstanceType<typeof AddCreditsDialog>['$props']

function renderDialog(props: Partial<Props> = {}) {
  const ports = new FakePorts()
  const user = userEvent.setup()
  const rendered = render(AddCreditsDialog, {
    props: {
      ports,
      canTopUp: true,
      supportUrl: SUPPORT_URL,
      locale: 'en-US',
      ...props
    }
  })
  return { ports, user, ...rendered }
}

const presets = () => screen.getAllByRole('radio')
const preset = (label: string) => screen.getByRole('radio', { name: label })
const field = () => screen.getByLabelText('Or enter an amount')
const continueButton = () => screen.getByTestId('add-credits-continue')
const summary = () => screen.getByTestId('add-credits-summary')
const notice = () => screen.getByTestId('add-credits-notice')

describe('AddCreditsDialog amount step', () => {
  it('opens on $50 with its quoted credits', async () => {
    const { ports } = renderDialog()

    expect(screen.getByRole('heading', { name: 'Add credits' })).toBeVisible()
    expect(presets().map((radio) => radio.textContent.trim())).toEqual([
      '$10',
      '$25',
      '$50',
      '$100'
    ])
    expect(preset('$50')).toHaveAttribute('aria-checked', 'true')
    expect(field()).toHaveValue('')
    expect(await within(summary()).findByText('10,550 credits')).toBeVisible()
    expect(
      within(summary()).getByText('$50.00, paid at checkout')
    ).toBeVisible()
    expect(continueButton()).toBeEnabled()
    expect(ports.quotes).toEqual([5000])
  })

  it('picking a preset clears the field', async () => {
    const { user } = renderDialog()

    await user.type(field(), '40')
    await user.click(preset('$25'))

    expect(field()).toHaveValue('')
    expect(preset('$25')).toHaveAttribute('aria-checked', 'true')
    expect(
      await within(summary()).findByText('$25.00, paid at checkout')
    ).toBeVisible()
  })

  it('typing clears the preset, even for an amount a preset matches', async () => {
    const { user } = renderDialog()

    await user.type(field(), '25')

    expect(presets().some((radio) => radio.ariaChecked === 'true')).toBe(false)
    expect(
      await within(summary()).findByText('$25.00, paid at checkout')
    ).toBeVisible()
  })

  it('an emptied field selects nothing and disables Continue', async () => {
    const { user } = renderDialog()

    await user.type(field(), '40')
    await user.clear(field())

    expect(presets().some((radio) => radio.ariaChecked === 'true')).toBe(false)
    expect(continueButton()).toBeDisabled()
  })

  it.for([
    { input: '3', error: 'Minimum is $5.' },
    {
      input: '10001',
      error: 'The largest top-up is $10,000. Add more with another top-up.'
    },
    { input: '12.50', error: 'Whole dollars only.' }
  ])(
    '"$input" shows "$error" and disables Continue',
    async ({ input, error }) => {
      const { user } = renderDialog()

      await user.type(field(), input)

      expect(screen.getByTestId('add-credits-amount-error')).toHaveTextContent(
        error
      )
      expect(field()).toHaveAttribute('aria-invalid', 'true')
      expect(field()).toHaveValue(input)
      expect(continueButton()).toBeDisabled()
    }
  )

  it('counts "12." as $12', async () => {
    const { user } = renderDialog()

    await user.type(field(), '12.')

    expect(continueButton()).toBeEnabled()
    expect(
      await within(summary()).findByText('$12.00, paid at checkout')
    ).toBeVisible()
  })

  it('reads its bounds from the served balance', async () => {
    const { user } = renderDialog({ minTopupCents: 1000, maxTopupCents: 50000 })

    await user.type(field(), '600')

    expect(screen.getByTestId('add-credits-amount-error')).toHaveTextContent(
      'The largest top-up is $500.'
    )
  })

  it('a negative balance prefills the served suggestion', async () => {
    renderDialog({ negativeBalanceCredits: 23000, suggestedTopupCents: 11400 })

    expect(
      screen.getByTestId('add-credits-negative-balance')
    ).toHaveTextContent(
      'Your balance is −23,000 credits. This top-up covers that first.'
    )
    expect(field()).toHaveValue('114')
    expect(presets().some((radio) => radio.ariaChecked === 'true')).toBe(false)
    expect(
      await within(summary()).findByText('$114.00, paid at checkout')
    ).toBeVisible()
  })

  it('renders the plan line it is given', () => {
    renderDialog({ planLine: 'ended' })

    expect(screen.getByTestId('add-credits-plan-line')).toHaveTextContent(
      "Buying credits doesn't restart your Cloud plan."
    )
  })

  it('shows a skeleton while quoting and "— credits" when the quote fails', async () => {
    const held = renderDialog()
    held.ports.quoteHeld = true
    await held.user.click(preset('$10'))
    expect(screen.getByTestId('add-credits-credits-loading')).toBeVisible()
    held.unmount()

    const failing = renderDialog()
    failing.ports.quoteFails = true
    await failing.user.click(preset('$10'))
    expect(await within(summary()).findByText('— credits')).toBeVisible()
    expect(continueButton()).toBeEnabled()
  })

  it('an earlier payment still processing keeps Continue enabled', () => {
    renderDialog({ pendingTopup: { kind: 'processing', amountCents: 2500 } })

    expect(notice()).toHaveTextContent('A $25 payment is still processing')
    expect(notice()).toHaveTextContent('No need to pay again.')
    expect(continueButton()).toBeEnabled()
  })
})

describe('AddCreditsDialog checkout hand-off', () => {
  it('opens checkout in the reserved tab, then closes once the payment lands', async () => {
    const { ports, user, emitted } = renderDialog()

    await user.click(continueButton())

    expect(ports.checkouts).toEqual([5000])
    expect(ports.tabs[0].url).toBe(CHECKOUT_URL)
    expect(
      screen.getByRole('heading', { name: 'Checkout opened in a new tab' })
    ).toBeVisible()
    const opened = screen.getByTestId('add-credits-opened-summary')
    expect(within(opened).getByText('10,550')).toBeVisible()
    expect(within(opened).getByText('$50.00')).toBeVisible()
    expect(emitted().close).toBeUndefined()

    ports.landed?.()
    await Promise.resolve()

    expect(emitted().close).toHaveLength(1)
    expect(ports.watchStopped).toBe(true)
  })

  it('says "in your browser" when checkout opens outside the app', async () => {
    const { user } = renderDialog({ opensIn: 'browser' })

    await user.click(continueButton())

    expect(
      screen.getByRole('heading', { name: 'Checkout opened in your browser' })
    ).toBeVisible()
  })

  it('locks the amount and reads "Opening…" until the session exists', async () => {
    const { ports, user } = renderDialog()
    ports.checkoutAnswer = undefined

    await user.click(continueButton())

    expect(continueButton()).toHaveTextContent('Opening…')
    expect(continueButton()).toBeDisabled()
    expect(field()).toBeDisabled()
    expect(preset('$10')).toBeDisabled()

    ports.checkoutHeld?.({ status: 'ok', url: CHECKOUT_URL })
    expect(
      await screen.findByRole('heading', {
        name: 'Checkout opened in a new tab'
      })
    ).toBeVisible()
  })

  it("couldn't open checkout keeps the selection and Continue", async () => {
    const { ports, user } = renderDialog()
    ports.refuse({ kind: 'checkout_failed' })

    await user.click(preset('$25'))
    await user.click(continueButton())

    expect(ports.tabs[0].closed).toBe(true)
    expect(notice()).toHaveTextContent("Couldn't open checkout")
    expect(notice()).toHaveTextContent('Nothing was charged. Try again.')
    expect(preset('$25')).toHaveAttribute('aria-checked', 'true')
    expect(continueButton()).toBeEnabled()
  })

  it('reopen creates a fresh checkout', async () => {
    const { ports, user } = renderDialog()

    await user.click(continueButton())
    await user.click(screen.getByTestId('add-credits-reopen'))

    expect(ports.checkouts).toEqual([5000, 5000])
    expect(ports.tabs[1].url).toBe(CHECKOUT_URL)
  })

  it('offers a plain link to the session when the pop-up is blocked', async () => {
    const { ports, user } = renderDialog()
    ports.popupsBlocked = true

    await user.click(continueButton())

    expect(
      screen.getByRole('heading', { name: "Checkout didn't open" })
    ).toBeVisible()
    const link = screen.getByTestId('add-credits-open-checkout')
    expect(link).toHaveAttribute('href', CHECKOUT_URL)
    expect(link).toHaveAttribute('target', '_blank')

    link.addEventListener('click', (event) => event.preventDefault())
    await user.click(link)

    expect(
      screen.getByRole('heading', { name: 'Checkout opened in a new tab' })
    ).toBeVisible()
  })
})

describe('AddCreditsDialog refusals', () => {
  it.for([
    {
      retryAfterSeconds: 2400,
      wait: 'Try again in 40 minutes, or message support.'
    },
    {
      retryAfterSeconds: 3600,
      wait: 'Try again in an hour, or message support.'
    },
    {
      retryAfterSeconds: undefined,
      wait: 'Try again later, or message support.'
    }
  ])(
    'rate limited for $retryAfterSeconds seconds',
    async ({ retryAfterSeconds, wait }) => {
      const { ports, user } = renderDialog()
      ports.refuse(
        retryAfterSeconds === undefined
          ? { kind: 'rate_limited' }
          : { kind: 'rate_limited', retryAfterSeconds }
      )

      await user.click(continueButton())

      expect(notice()).toHaveTextContent("You've hit the top-up limit for now")
      expect(notice()).toHaveTextContent(wait)
      expect(
        within(notice()).getByRole('link', { name: 'message support' })
      ).toHaveAttribute('href', SUPPORT_URL)
      expect(continueButton()).toBeDisabled()
    }
  )

  it('purchases stopped after Continue', async () => {
    const { ports, user } = renderDialog()
    ports.refuse({ kind: 'purchases_paused' })

    await user.click(continueButton())

    expect(notice()).toHaveTextContent(
      "Buying credits isn't available right now"
    )
    expect(notice()).toHaveTextContent('Try again later, or message support.')
    expect(continueButton()).toBeDisabled()
  })

  it.for([
    {
      denial: 'topup_purchases_paused',
      title: "Buying credits isn't available right now"
    },
    { denial: undefined, title: "You can't add credits right now" }
  ] as const)(
    'can_top_up going false while open ($denial)',
    async ({ denial, title }) => {
      const { rerender } = renderDialog()

      await rerender({ canTopUp: false, topUpDenial: denial })

      expect(notice()).toHaveTextContent(title)
      expect(continueButton()).toBeDisabled()
    }
  )
})

describe('AddCreditsDialog pending bank check', () => {
  it('needs verification offers only Verify payment', async () => {
    const { ports } = renderDialog({
      pendingTopup: {
        kind: 'needs_verification',
        amountCents: 2500,
        verifyUrl: 'https://bank.example/3ds'
      }
    })

    expect(notice()).toHaveTextContent('Your $25 payment needs verification')
    expect(
      screen.getByRole('link', { name: /Verify payment/ })
    ).toHaveAttribute('href', 'https://bank.example/3ds')
    expect(screen.queryByTestId('add-credits-continue')).toBeNull()
    expect(field()).toBeDisabled()
    expect(within(summary()).getByText('$25.00, unverified')).toBeVisible()
    expect(await within(summary()).findByText('5,275 credits')).toBeVisible()
    expect(ports.quotes).toEqual([2500])
  })

  it('needs verification without a served amount shows no amount', () => {
    renderDialog({
      pendingTopup: {
        kind: 'needs_verification',
        verifyUrl: 'https://bank.example/3ds'
      }
    })

    expect(notice()).toHaveTextContent('Your payment needs verification')
    expect(summary()).not.toHaveTextContent('$0.00')
    expect(summary()).not.toHaveTextContent('0 credits')
  })

  it("wasn't verified offers only Contact support and never says nothing was charged", () => {
    renderDialog({ pendingTopup: { kind: 'not_verified', amountCents: 2500 } })

    expect(notice()).toHaveTextContent("Your $25 payment wasn't verified")
    expect(
      screen.getByRole('link', { name: 'Contact support' })
    ).toHaveAttribute('href', SUPPORT_URL)
    expect(within(summary()).getByText('$25.00 top-up')).toBeVisible()
    expect(within(summary()).getByText('Not verified')).toBeVisible()
    expect(screen.queryByText(/nothing was charged/i)).toBeNull()
  })
})
