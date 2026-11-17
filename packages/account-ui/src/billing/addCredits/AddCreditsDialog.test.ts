import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import type {
  AddCreditsAutoTopUpOffer,
  AddCreditsRefusal,
  AutoTopUpActivation,
  AutoTopUpActivationOutcome
} from '@comfyorg/account-core/billing'

import AddCreditsDialog from './AddCreditsDialog.vue'
import type {
  AddCreditsCheckoutResult,
  AddCreditsCheckoutTab,
  AddCreditsPorts,
  AddCreditsQuoteResult
} from './useAddCreditsDialog'
import type { AutoTopUpEdit } from './useAddCreditsAutoTopUp'

expectTypeOf<['threshold', true]>().not.toExtend<AutoTopUpEdit>()
expectTypeOf<['limitOn', 'false']>().not.toExtend<AutoTopUpEdit>()
expectTypeOf<['limitOn', true]>().toExtend<AutoTopUpEdit>()

const CHECKOUT_URL = 'https://billing.comfy.org/topup?session=cs_1'
const AUTO_TOP_UP_SETUP_URL =
  'https://platform.comfy.org/profile/billing?auto_top_up=setup'
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
  autoTopUps: (AutoTopUpActivation | undefined)[] = []
  tabs: FakeTab[] = []
  popupsBlocked = false
  quoteFails = false
  quoteHeld = false
  checkoutAnswer: AddCreditsCheckoutResult | undefined = {
    status: 'ok',
    url: CHECKOUT_URL
  }
  checkoutHeld: ((answer: AddCreditsCheckoutResult) => void) | undefined
  landed: ((activation?: AutoTopUpActivationOutcome) => void) | undefined
  watchStopped = false
  autoTopUpSetupUrl: AddCreditsPorts['autoTopUpSetupUrl']
  activatesAutoTopUp = true
  singleUseCheckout = false

  quoteRejects = false
  checkoutRejects = false

  quote = (amountCents: number): Promise<AddCreditsQuoteResult> => {
    this.quotes.push(amountCents)
    if (this.quoteHeld) return new Promise(() => {})
    if (this.quoteRejects)
      return Promise.reject(new TypeError('Failed to fetch'))
    return Promise.resolve(
      this.quoteFails
        ? { status: 'error' }
        : { status: 'ok', credits: Math.round(amountCents * CREDITS_PER_CENT) }
    )
  }

  createCheckout = (
    amountCents: number,
    _signal: AbortSignal,
    autoTopUp?: AutoTopUpActivation
  ) => {
    this.checkouts.push(amountCents)
    this.autoTopUps.push(autoTopUp)
    if (this.checkoutRejects)
      return Promise.reject(new TypeError('Failed to fetch'))
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

  watchPayment = (
    landed: (activation?: AutoTopUpActivationOutcome) => void
  ) => {
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
      input: '2501',
      error: 'The largest top-up is $2,500. Add more with another top-up.'
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

  it('shows a skeleton while the quote is pending', async () => {
    const { ports, user } = renderDialog()
    ports.quoteHeld = true

    await user.click(preset('$10'))

    expect(screen.getByTestId('add-credits-credits-loading')).toBeVisible()
  })

  it('shows "— credits" when the quote fails and keeps Continue enabled', async () => {
    const { ports, user } = renderDialog()
    ports.quoteFails = true

    await user.click(preset('$10'))

    expect(await within(summary()).findByText('— credits')).toBeVisible()
    expect(continueButton()).toBeEnabled()
  })

  it('shows "— credits" when the quote port rejects', async () => {
    const { ports, user } = renderDialog()
    ports.quoteRejects = true

    await user.click(preset('$10'))

    expect(await within(summary()).findByText('— credits')).toBeVisible()
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

  it('a rejected checkout port closes the reserved tab and keeps Continue', async () => {
    const { ports, user } = renderDialog()
    ports.checkoutRejects = true

    await user.click(continueButton())

    expect(ports.tabs[0].closed).toBe(true)
    expect(notice()).toHaveTextContent("Couldn't open checkout")
    expect(continueButton()).toBeEnabled()
  })

  it('reopen creates a fresh checkout', async () => {
    const { ports, user } = renderDialog()

    await user.click(continueButton())
    await user.click(screen.getByTestId('add-credits-reopen'))

    expect(ports.checkouts).toEqual([5000, 5000])
    expect(ports.tabs[1].url).toBe(CHECKOUT_URL)
  })

  it('a rate limit on reopen shows its copy and disables Reopen', async () => {
    const { ports, user } = renderDialog()
    await user.click(continueButton())
    ports.refuse({ kind: 'rate_limited', retryAfterSeconds: 2400 })

    await user.click(screen.getByTestId('add-credits-reopen'))

    expect(notice()).toHaveTextContent("You've hit the top-up limit for now")
    expect(notice()).toHaveTextContent(
      'Try again in 40 minutes, or message support.'
    )
    expect(screen.getByTestId('add-credits-reopen')).toBeDisabled()
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

describe('AddCreditsDialog with a single-use checkout', () => {
  it('never offers the checkout as a link when the pop-up is blocked, and opens a fresh one from the blocked step', async () => {
    const { ports, user } = renderDialog()
    ports.singleUseCheckout = true
    ports.popupsBlocked = true

    await user.click(continueButton())

    expect(
      screen.getByRole('heading', { name: "Checkout didn't open" })
    ).toBeVisible()
    expect(ports.checkouts).toEqual([])
    const open = screen.getByTestId('add-credits-open-checkout')
    expect(open).not.toHaveAttribute('href')

    ports.popupsBlocked = false
    await user.click(open)

    expect(ports.checkouts).toEqual([5000])
    expect(ports.tabs[0].url).toBe(CHECKOUT_URL)
    expect(
      await screen.findByRole('heading', {
        name: 'Checkout opened in a new tab'
      })
    ).toBeVisible()
  })

  it('disables the blocked step Open checkout while top-up is not allowed', async () => {
    const { ports, user, rerender } = renderDialog()
    ports.singleUseCheckout = true
    ports.popupsBlocked = true
    await user.click(continueButton())

    await rerender({ canTopUp: false })

    expect(screen.getByTestId('add-credits-open-checkout')).toBeDisabled()
  })

  it('shows the server message when the checkout is refused', async () => {
    const { ports, user } = renderDialog()
    ports.singleUseCheckout = true
    ports.refuse({
      kind: 'checkout_failed',
      serverMessage: 'Only the workspace owner can add credits.'
    })

    await user.click(continueButton())

    expect(notice()).toHaveTextContent("Couldn't open checkout")
    expect(notice()).toHaveTextContent(
      'Only the workspace owner can add credits.'
    )
  })
})

describe('AddCreditsDialog refusals', () => {
  it.for<{ refusal: AddCreditsRefusal; wait: string }>([
    {
      refusal: { kind: 'rate_limited', retryAfterSeconds: 2400 },
      wait: 'Try again in 40 minutes, or message support.'
    },
    {
      refusal: { kind: 'rate_limited', retryAfterSeconds: 3600 },
      wait: 'Try again in an hour, or message support.'
    },
    {
      refusal: { kind: 'rate_limited' },
      wait: 'Try again later, or message support.'
    }
  ])('rate limited, shows "$wait"', async ({ refusal, wait }) => {
    const { ports, user } = renderDialog()
    ports.refuse(refusal)

    await user.click(continueButton())

    expect(notice()).toHaveTextContent("You've hit the top-up limit for now")
    expect(notice()).toHaveTextContent(wait)
    expect(
      within(notice()).getByRole('link', { name: 'message support' })
    ).toHaveAttribute('href', SUPPORT_URL)
    expect(continueButton()).toBeDisabled()
  })

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

describe('AddCreditsDialog auto top-up suggestion', () => {
  const OFFER =
    'Buy credits automatically when you run low, so workflows and API calls keep running.'

  async function landPayment(
    autoTopUpSetupUrl: AddCreditsPorts['autoTopUpSetupUrl']
  ) {
    const rendered = renderDialog()
    rendered.ports.autoTopUpSetupUrl = autoTopUpSetupUrl
    await rendered.user.click(continueButton())
    rendered.ports.landed?.()
    return rendered
  }

  it('suggests auto top-up instead of closing when the payment lands and it is offered', async () => {
    const { emitted } = await landPayment(() =>
      Promise.resolve(AUTO_TOP_UP_SETUP_URL)
    )

    expect(await screen.findByText(OFFER)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeVisible()
    expect(emitted().close).toBeUndefined()
  })

  it('Set up opens Platform billing in a new tab and closes the dialog', async () => {
    const { user, emitted } = await landPayment(() =>
      Promise.resolve(AUTO_TOP_UP_SETUP_URL)
    )

    const setUp = await screen.findByRole('link', { name: 'Set up' })
    expect(setUp).toHaveAttribute('href', AUTO_TOP_UP_SETUP_URL)
    expect(setUp).toHaveAttribute('target', '_blank')
    setUp.addEventListener('click', (event) => event.preventDefault())
    await user.click(setUp)

    expect(emitted().setUpAutoTopUp).toHaveLength(1)
    expect(emitted().close).toHaveLength(1)
  })

  it.for([
    { name: 'Not now', button: 'Not now', declined: true },
    { name: 'the X', button: 'Close', declined: false }
  ])('$name closes the suggestion', async ({ button, declined }) => {
    const { user, emitted } = await landPayment(() =>
      Promise.resolve(AUTO_TOP_UP_SETUP_URL)
    )
    await screen.findByText(OFFER)

    await user.click(screen.getByRole('button', { name: button }))

    expect(emitted().close).toHaveLength(1)
    expect(emitted().setUpAutoTopUp).toBeUndefined()
    expect('declineAutoTopUp' in emitted()).toBe(declined)
  })

  it.for([
    { name: 'not offered', answer: () => Promise.resolve(null) },
    {
      name: 'the read fails',
      answer: () => Promise.reject(new TypeError('Failed to fetch'))
    }
  ])('closes once the payment lands when $name', async ({ answer }) => {
    const { emitted } = await landPayment(answer)

    await vi.waitFor(() => expect(emitted().close).toHaveLength(1))
    expect(screen.queryByText(OFFER)).not.toBeInTheDocument()
  })

  it('withdraws a shown suggestion and closes once its setup link is hidden', async () => {
    const { emitted, rerender } = await landPayment(() =>
      Promise.resolve(AUTO_TOP_UP_SETUP_URL)
    )
    await screen.findByText(OFFER)

    await rerender({ autoTopUpSetupHidden: true })

    expect(screen.queryByRole('link', { name: 'Set up' })).toBeNull()
    expect(emitted().close).toHaveLength(1)
    expect(emitted().declineAutoTopUp).toBeUndefined()
  })
})

describe('AddCreditsDialog auto top-up with the purchase', () => {
  const BILLING_URL = 'https://platform.comfy.org/profile/billing'
  const RULES = {
    minReloadCredits: 1055,
    maxReloadCredits: 12_660_000,
    maxMonthlyBudgetCents: 6_000_000
  }
  const CHECKBOX: AddCreditsAutoTopUpOffer = {
    kind: 'checkbox',
    rules: RULES,
    defaultCard: null
  }
  const checkbox = () =>
    screen.getByRole('checkbox', { name: /Turn on auto top-up/ })
  const threshold = () => screen.getByLabelText('When credits drop below')
  const target = () => screen.getByLabelText('Top up to')

  function renderOffered(
    autoTopUp: AddCreditsAutoTopUpOffer = CHECKBOX,
    props: Partial<Props> = {}
  ) {
    return renderDialog({ autoTopUp, billingUrl: BILLING_URL, ...props })
  }

  it('shows the checkbox unchecked with its pitch when the host turns auto top-up on with the purchase', () => {
    renderOffered()

    expect(checkbox()).toHaveAttribute('aria-checked', 'false')
    expect(
      screen.getByText(
        'Buy credits automatically when you run low, so workflows keep running.'
      )
    ).toBeVisible()
    expect(screen.queryByLabelText('Top up to')).toBeNull()
  })

  it.for<{ name: string; props: Partial<Props> }>([
    { name: 'no served offer', props: { billingUrl: BILLING_URL } },
    {
      name: 'a hidden offer',
      props: { autoTopUp: { kind: 'hidden' }, billingUrl: BILLING_URL }
    },
    { name: 'no Billing link', props: { autoTopUp: CHECKBOX } },
    {
      name: 'a host that cannot turn auto top-up on with the purchase',
      props: {
        autoTopUp: CHECKBOX,
        billingUrl: BILLING_URL,
        ports: Object.assign(new FakePorts(), { activatesAutoTopUp: false })
      }
    }
  ])('shows no checkbox for $name', ({ props }) => {
    renderDialog(props)

    expect(screen.queryByTestId('add-credits-auto-top-up')).toBeNull()
  })

  it('keeps the after-payment suggestion for a host that cannot turn auto top-up on with the purchase', async () => {
    const ports = Object.assign(new FakePorts(), {
      activatesAutoTopUp: false,
      autoTopUpSetupUrl: () => Promise.resolve(AUTO_TOP_UP_SETUP_URL)
    })
    const { user, emitted } = renderOffered(CHECKBOX, { ports })
    await user.click(continueButton())

    ports.landed?.()

    expect(
      await screen.findByText(
        'Buy credits automatically when you run low, so workflows and API calls keep running.'
      )
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Set up' })).toHaveAttribute(
      'href',
      AUTO_TOP_UP_SETUP_URL
    )
    expect(emitted().close).toBeUndefined()
  })

  it('checking prefills the starting threshold and the credits picked on top', async () => {
    const { user } = renderOffered()

    await user.click(checkbox())

    expect(threshold()).toHaveValue('1000')
    expect(
      screen.getByText('Counts plan credits and credits you’ve bought.')
    ).toBeVisible()
    expect(target()).toHaveValue('11550')
    expect(
      screen.getByText('11,550 credits. Each top-up is at least $50.00.')
    ).toBeVisible()
    expect(
      screen.getByText(
        'Up to $60,000 a month, the maximum. Turn on to set a lower limit.'
      )
    ).toBeVisible()
  })

  it('the target follows the amount picked until it is edited', async () => {
    const { user } = renderOffered()
    await user.click(checkbox())

    await user.click(preset('$25'))
    expect(target()).toHaveValue('6275')

    await user.clear(target())
    await user.type(target(), '9000')
    await user.click(preset('$100'))
    expect(target()).toHaveValue('9000')
  })

  it.for([
    {
      name: 'a target under the minimum top-up',
      input: '2000',
      message: 'Must be at least 2,055 credits, about $5 above your threshold.'
    },
    {
      name: 'a fractional target',
      input: '2100.5',
      message: 'Enter a whole number of credits.'
    }
  ])(
    'shows the Billing dialog copy for $name and holds Continue',
    async ({ input, message }) => {
      const { user } = renderOffered()
      await user.click(checkbox())

      await user.clear(target())
      await user.type(target(), input)

      expect(screen.getByText(message)).toBeVisible()
      expect(continueButton()).toBeDisabled()
    }
  )

  it('turning the limit on prefills $10,000 and checks it against the ceiling', async () => {
    const { user } = renderOffered()
    await user.click(checkbox())

    await user.click(screen.getByRole('switch'))
    const limit = screen.getByLabelText('Monthly limit', { selector: 'input' })
    expect(limit).toHaveValue('10000')
    expect(
      screen.getByTestId('add-credits-auto-top-up-consent')
    ).toHaveTextContent('up to $10,000 a month')

    await user.clear(limit)
    await user.type(limit, '60001')
    expect(screen.getByText('Enter a valid value.')).toBeVisible()
    expect(continueButton()).toBeDisabled()
  })

  it.for([
    {
      name: 'no default card',
      defaultCard: null,
      consent:
        'Top-ups are charged to the card you pay with at checkout, up to $60,000 a month. Turn this off anytime in Billing.'
    },
    {
      name: 'a default card',
      defaultCard: { brand: 'Visa', last4: '4242' },
      consent:
        'Top-ups are charged to your default card, Visa ···· 4242, up to $60,000 a month. Turn this off anytime in Billing.'
    }
  ])(
    'the consent names the card for $name',
    async ({ defaultCard, consent }) => {
      const { user } = renderOffered({ ...CHECKBOX, defaultCard })
      await user.click(checkbox())

      const line = screen.getByTestId('add-credits-auto-top-up-consent')
      expect(line).toHaveTextContent(consent)
      expect(
        within(line).getByRole('link', { name: 'Billing' })
      ).toHaveAttribute('href', BILLING_URL)
    }
  )

  it('sends the settings shown with the purchase', async () => {
    const { user, ports } = renderOffered()
    await user.click(checkbox())
    await user.click(screen.getByRole('switch'))
    await user.clear(threshold())
    await user.type(threshold(), '2000')
    await user.clear(target())
    await user.type(target(), '17000')
    const limit = screen.getByLabelText('Monthly limit', { selector: 'input' })
    await user.clear(limit)
    await user.type(limit, '250')

    await user.click(continueButton())

    expect(ports.autoTopUps).toEqual([
      {
        threshold_credits: 2000,
        target_credits: 17000,
        monthly_budget_cents: 25000
      }
    ])
  })

  it('reopening checkout sends the settings the buyer accepted', async () => {
    const { user, ports } = renderOffered()
    await user.click(checkbox())
    await user.click(continueButton())

    await user.click(screen.getByTestId('add-credits-reopen'))

    const accepted = {
      threshold_credits: 1000,
      target_credits: 11550,
      monthly_budget_cents: null
    }
    expect(ports.autoTopUps).toEqual([accepted, accepted])
  })

  it('an unchecked purchase sends no settings and closes on landing without a second ask', async () => {
    const { user, ports, emitted } = renderOffered()
    ports.autoTopUpSetupUrl = () => Promise.resolve(AUTO_TOP_UP_SETUP_URL)
    await user.click(continueButton())
    expect(ports.autoTopUps).toEqual([undefined])

    ports.landed?.()

    await vi.waitFor(() => expect(emitted().close).toHaveLength(1))
  })

  it.for([
    { budget: null, expected: 'No monthly limit.' },
    { budget: 200000, expected: 'Up to $2,000 a month.' }
  ])(
    'shows the served auto top-up settings with $expected',
    async ({ budget, expected }) => {
      const { user, ports } = renderOffered()
      await user.click(checkbox())
      await user.click(continueButton())

      ports.landed?.({
        status: 'on',
        settings: {
          threshold_credits: 2000,
          target_credits: 15000,
          monthly_budget_cents: budget
        }
      })

      expect(
        await screen.findByRole('heading', { name: 'Auto top-up is on' })
      ).toBeVisible()
      expect(
        screen.getByTestId('add-credits-auto-top-up-on')
      ).toHaveTextContent('Below 2,000 credits, tops up to 15,000.')
      expect(
        screen.getByTestId('add-credits-auto-top-up-on')
      ).toHaveTextContent(expected)
      expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute(
        'href',
        BILLING_URL
      )
      expect(screen.getByRole('button', { name: 'Done' })).toBeVisible()
    }
  )

  it("shows Auto top-up didn't turn on with Set up when the server reports a failure", async () => {
    const { user, ports, emitted } = renderOffered()
    ports.autoTopUpSetupUrl = () => Promise.resolve(AUTO_TOP_UP_SETUP_URL)
    await user.click(checkbox())
    await user.click(continueButton())

    ports.landed?.({ status: 'failed' })

    expect(
      await screen.findByRole('heading', { name: "Auto top-up didn't turn on" })
    ).toBeVisible()
    expect(
      screen.getByText(
        'Your credits were added. Set up auto top-up in Billing to try again.'
      )
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Set up' })).toHaveAttribute(
      'href',
      AUTO_TOP_UP_SETUP_URL
    )
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(emitted().close).toHaveLength(1)
  })

  it("keeps Auto top-up didn't turn on but drops Set up once its setup link is hidden", async () => {
    const { user, ports, rerender, emitted } = renderOffered()
    ports.autoTopUpSetupUrl = () => Promise.resolve(AUTO_TOP_UP_SETUP_URL)
    await user.click(checkbox())
    await user.click(continueButton())
    ports.landed?.({ status: 'failed' })
    await screen.findByRole('link', { name: 'Set up' })

    await rerender({ autoTopUpSetupHidden: true })

    expect(
      screen.getByRole('heading', { name: "Auto top-up didn't turn on" })
    ).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Set up' })).toBeNull()
    expect(emitted().close).toBeUndefined()
  })

  it('a checked purchase that lands without an outcome closes without claiming a failure', async () => {
    const { user, ports, emitted } = renderOffered()
    ports.autoTopUpSetupUrl = () => Promise.resolve(AUTO_TOP_UP_SETUP_URL)
    await user.click(checkbox())
    await user.click(continueButton())

    ports.landed?.()

    await vi.waitFor(() => expect(emitted().close).toHaveLength(1))
    expect(
      screen.queryByRole('heading', { name: "Auto top-up didn't turn on" })
    ).toBeNull()
  })

  it('says auto top-up is on with a Manage link when it already is', () => {
    renderOffered({ kind: 'on' })

    const line = screen.getByTestId('add-credits-auto-top-up-is-on')
    expect(line).toHaveTextContent('Auto top-up is on. Manage')
    expect(within(line).getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'target',
      '_blank'
    )
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

describe('AddCreditsDialog when the host opens billing itself', () => {
  const BILLING_URL = 'https://platform.test/profile/billing'

  function expectNoPlatformLink(container: Element) {
    expect(screen.queryAllByRole('link')).toEqual([])
    expect(container.innerHTML).not.toContain('platform.test')
  }

  it('offers Manage as a button that asks the host to open billing', async () => {
    const { user, emitted, container } = renderDialog({
      autoTopUp: { kind: 'on' },
      billingUrl: BILLING_URL,
      hostOpensBilling: true
    })

    await user.click(screen.getByRole('button', { name: 'Manage' }))

    expect(emitted().openBilling).toHaveLength(1)
    expectNoPlatformLink(container)
  })

  it('offers Set up as a button that asks the host and closes the dialog', async () => {
    const { user, ports, emitted, container } = renderDialog({
      hostOpensBilling: true
    })
    ports.autoTopUpSetupUrl = () => Promise.resolve(AUTO_TOP_UP_SETUP_URL)
    await user.click(continueButton())
    ports.landed?.()

    await user.click(await screen.findByRole('button', { name: 'Set up' }))

    expect(emitted().setUpAutoTopUp).toHaveLength(1)
    expect(emitted().close).toHaveLength(1)
    expectNoPlatformLink(container)
  })

  it('turns a shown Set up link into a button once the host starts opening billing itself', async () => {
    const { user, ports, emitted, rerender, container } = renderDialog({
      autoTopUp: {
        kind: 'checkbox',
        rules: {
          minReloadCredits: 1055,
          maxReloadCredits: 12_660_000,
          maxMonthlyBudgetCents: 6_000_000
        },
        defaultCard: null
      },
      billingUrl: BILLING_URL
    })
    ports.autoTopUpSetupUrl = () => Promise.resolve(AUTO_TOP_UP_SETUP_URL)
    await user.click(
      screen.getByRole('checkbox', { name: /Turn on auto top-up/ })
    )
    await user.click(continueButton())
    ports.landed?.({ status: 'failed' })
    await screen.findByRole('link', { name: 'Set up' })

    await rerender({ hostOpensBilling: true })
    await user.click(screen.getByRole('button', { name: 'Set up' }))

    expect(emitted().openBilling).toHaveLength(1)
    expectNoPlatformLink(container)
  })

  it('does not ask the host to open a plain link', async () => {
    const { user, emitted } = renderDialog({
      autoTopUp: { kind: 'on' },
      billingUrl: BILLING_URL
    })
    const manage = screen.getByRole('link', { name: 'Manage' })
    manage.addEventListener('click', (event) => event.preventDefault())

    await user.click(manage)

    expect(manage).toHaveAttribute('href', BILLING_URL)
    expect(emitted().openBilling).toBeUndefined()
  })
})
