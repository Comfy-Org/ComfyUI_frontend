import { datadogRum } from '@datadog/browser-rum'
import userEvent from '@testing-library/user-event'
import { cleanup, render, screen, waitFor } from '@testing-library/vue'
import { nextTick, ref } from 'vue'
import type { VNode } from 'vue'

import type {
  BillingOperationReceipt,
  BillingOperationState,
  BillingResult,
  CancelOperationResult,
  PendingBillingOperation,
  PreviewSubscribeResult,
  SavedPaymentMethod
} from '@comfyorg/account-core/billing'
import {
  OPERATION_POLL_TIMING,
  readBillingErrorCode
} from '@comfyorg/account-core/billing'
import type { AccountCredential } from '@comfyorg/account-core/session'
import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import type { StripePaymentPhase } from '@comfyorg/account-ui/billing/stripe'
import {
  parseBillingEntry,
  parseReturnResult
} from '@comfyorg/billing-contract'

import type { OperationNotice } from '@/checkout/operationChannel'

import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import type {
  FakeBillingClient,
  FakeBillingClientOptions
} from '@/test/fakeBillingClient'
import {
  createFakeBillingClient,
  failedOperation,
  hostedPendingOperation,
  pendingOperation,
  planOf,
  previewOf,
  succeededOperation
} from '@/test/fakeBillingClient'
import { trackedBillingEvents } from '@/test/trackedBillingEvents'
import FullPageCheckoutView from '@/views/FullPageCheckoutView.vue'

/** Money the bank is capturing: the phase that can no longer be called back. */
const processingOperation = (id = 'op_1'): PendingBillingOperation => ({
  ...pendingOperation(id),
  authenticationState: 'processing'
})

const CHECKOUT_PATH =
  '/v1/checkout?product=comfyui&return_to=comfyui_workspace&plan=creator_monthly'

vi.mock(import('@datadog/browser-rum'))

vi.mock<unknown>(import('@/config/env'), () => ({
  BILLING_WEB_ENV: 'test',
  CLOUD_BASE_URL: 'https://testcloud.comfy.org'
}))

/** The Stripe key this origin resolves; a test clears it to play a deployment without one. */
const stripeKey = vi.hoisted(() => ({
  value: 'pk_test_example' as string | undefined
}))

vi.mock(import('@/config/stripeKey'), () => ({
  awaitBillingWebStripeKey: () => Promise.resolve(stripeKey.value),
  useBillingWebStripeKey: () => ref(stripeKey.value)
}))

/** Where Stripe says the intent's next step runs; a test flips it to play a redirect method. */
const nextStep = vi.hoisted(() => ({
  leavesPage: false as boolean | Promise<boolean>,
  asked: 0
}))

vi.mock(import('@/session/stripeChallengePort'), () => ({
  createDeferredStripeChallengePort: () => ({
    handleNextAction: async () => ({}),
    leavesPage: async () => {
      nextStep.asked += 1
      return nextStep.leavesPage
    }
  })
}))

vi.mock(import('@/entry/workspaceBinding'), () => ({
  boundWorkspaceId: () => undefined,
  bindEntryWorkspace: () => false
}))

/** The cross-tab channel, held so a test can play a sibling tab. */
const siblings = vi.hoisted(() => ({
  scope: undefined as { uid: string; workspaceId: string } | undefined,
  listeners: new Set<(notice: OperationNotice) => void>(),
  published: [] as OperationNotice[],
  closed: 0,
  nudge(notice: OperationNotice) {
    for (const listener of this.listeners) listener(notice)
  },
  reset() {
    this.scope = undefined
    this.listeners.clear()
    this.published = []
    this.closed = 0
  }
}))

vi.mock(import('@/checkout/operationChannel'), () => ({
  createOperationChannel: (uid: string, workspaceId: string) => {
    siblings.scope = { uid, workspaceId }
    return {
      publish: (notice: OperationNotice) => {
        siblings.published.push(notice)
      },
      subscribe: (listener: (notice: OperationNotice) => void) => {
        siblings.listeners.add(listener)
        return () => siblings.listeners.delete(listener)
      },
      close: () => {
        siblings.closed += 1
      }
    }
  }
}))

const SESSION: AccountCredential = {
  token: 'jwt-1',
  permissions: [],
  expiresAt: Date.now() + 3_600_000,
  uid: 'uid-1',
  workspace: { id: 'ws-team', name: 'Acme Team', type: 'team' },
  role: 'owner'
}

vi.mock(import('@/session/billingWebSession'), async () => {
  const { computed } = await import('vue')
  return {
    useBillingWebSession: () => ({
      phase: computed(() => 'authenticated' as const),
      user: computed(() => null),
      session: computed(() => SESSION),
      failure: computed(() => undefined)
    })
  }
})

/** The provider form is covered in its package; here it reports phases and hands back a token. */
const form = vi.hoisted(() => ({
  mounts: 0,
  emit: (() => {}) as (event: string, ...payload: unknown[]) => void,
  locked: (): boolean => false
}))

vi.mock<unknown>(import('@comfyorg/account-ui/billing/stripe'), async () => {
  const { h } = await import('vue')
  return {
    StripePaymentForm: {
      name: 'StripePaymentForm',
      props: {
        canSubmit: { type: Boolean, default: true },
        isLoading: { type: Boolean, default: false },
        locked: { type: Boolean, default: false }
      },
      emits: ['confirm', 'phase'],
      setup(
        props: { canSubmit: boolean; isLoading: boolean; locked: boolean },
        {
          emit,
          slots
        }: {
          emit: (event: string, ...payload: unknown[]) => void
          slots: { submit?: (slotProps: Record<string, unknown>) => VNode[] }
        }
      ) {
        form.mounts += 1
        form.emit = emit
        form.locked = () => props.locked
        return () =>
          h(
            'div',
            slots.submit?.({
              disabled: !props.canSubmit,
              loading: props.isLoading
            })
          )
      }
    }
  }
})

function reportPhase(phase: StripePaymentPhase) {
  form.emit('phase', phase)
}

async function renderCheckout(
  options: FakeBillingClientOptions = {},
  arrange: (fake: FakeBillingClient) => void = () => {},
  path = CHECKOUT_PATH
) {
  recordBillingEntry(parseBillingEntry(path))
  const fake = createFakeBillingClient({
    preview: { status: 'ok', value: previewOf({ quote_id: 'q_1' }) },
    capabilities: { can_subscribe_self_serve: true },
    ...options
  })
  arrange(fake)
  render(FullPageCheckoutView, {
    global: {
      plugins: [createBillingI18n()],
      provide: { [BILLING_CLIENT_KEY]: fake.client }
    }
  })
  return fake
}

const payButton = () =>
  screen.getByRole('button', { name: 'Pay and subscribe' })

afterEach(() => {
  sessionStorage.clear()
})

describe('FullPageCheckoutView', () => {
  beforeEach(() => {
    form.mounts = 0
  })

  it('holds the skeleton with Pay disabled until the quote and the element are both ready', async () => {
    let answerQuote: (result: PreviewSubscribeResult) => void = () => {}
    await renderCheckout({}, (fake) =>
      fake.previewSubscribe.mockImplementation(
        () => new Promise((resolve) => (answerQuote = resolve))
      )
    )

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.getByText('Total due today')).toBeInTheDocument()
    expect(payButton()).toBeDisabled()
    expect(form.mounts).toBe(0)

    answerQuote({ status: 'ok', value: previewOf() })

    expect(
      await screen.findByText('Subscribe to Creator Plan · Acme Team')
    ).toBeInTheDocument()
    expect(screen.getAllByText('$28.00')).toHaveLength(2)
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    expect(payButton()).toBeDisabled()

    reportPhase({ phase: 'payment_element_ready', element: 'address' })
    await nextTick()
    expect(payButton()).toBeDisabled()

    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    await waitFor(() => expect(payButton()).toBeEnabled())
  })

  it('subscribes with the quoted plan and the confirmation token on Pay', async () => {
    const fake = await renderCheckout()
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })

    form.emit('confirm', 'ctoken_1')

    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_slug: 'creator_monthly',
          confirmation_token: 'ctoken_1',
          quote_id: 'q_1'
        })
      )
    )
  })

  it('charges a plan change to the method on file without mounting the card form', async () => {
    const fake = await renderCheckout({
      preview: {
        status: 'ok',
        value: previewOf({ transition_type: 'upgrade' })
      }
    })
    await screen.findByText('Upgrade to Creator Plan · Acme Team')

    expect(form.mounts).toBe(0)
    await userEvent.click(payButton())

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce())
    expect(fake.subscribe.mock.calls[0][0]).not.toHaveProperty(
      'confirmation_token'
    )
  })

  describe('with no Stripe key', () => {
    beforeEach(() => {
      stripeKey.value = undefined
    })
    afterEach(() => {
      stripeKey.value = 'pk_test_example'
    })

    it('370-15519: fails inside the payment column beside the summary, and Try again mounts the card form', async () => {
      const fake = await renderCheckout()

      expect(
        await screen.findByText("The payment form couldn't load")
      ).toBeInTheDocument()
      expect(
        screen.getByText('Subscribe to Creator Plan · Acme Team')
      ).toBeInTheDocument()
      expect(
        screen.queryByTestId('checkout-ending-code')
      ).not.toBeInTheDocument()
      expect(form.mounts).toBe(0)

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

      expect(form.mounts).toBe(1)
      expect(fake.subscribe).not.toHaveBeenCalled()
    })

    it('still charges a plan change to the method on file, which needs no card form', async () => {
      const fake = await renderCheckout({
        preview: {
          status: 'ok',
          value: previewOf({ transition_type: 'upgrade' })
        }
      })
      await screen.findByText('Upgrade to Creator Plan · Acme Team')

      await userEvent.click(payButton())

      await waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce())
      expect(
        screen.queryByTestId('checkout-ending-code')
      ).not.toBeInTheDocument()
    })
  })

  it.for<Extract<StripePaymentPhase, { phase: 'payment_element_failed' }>>([
    {
      phase: 'payment_element_failed',
      element: 'payment',
      element_phase: 'init'
    },
    {
      phase: 'payment_element_failed',
      element: 'payment',
      element_phase: 'mount'
    },
    {
      phase: 'payment_element_failed',
      element: 'address',
      element_phase: 'mount'
    },
    {
      phase: 'payment_element_failed',
      element: 'payment',
      element_phase: 'update'
    }
  ])(
    'replaces the whole payment column when the $element element fails at $element_phase, and Try again remounts it',
    async (failure) => {
      await renderCheckout()
      await screen.findByText('Subscribe to Creator Plan · Acme Team')
      reportPhase(failure)

      expect(
        await screen.findByText("The payment form couldn't load")
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Pay and subscribe' })
      ).not.toBeInTheDocument()
      expect(
        screen.getByText('Subscribe to Creator Plan · Acme Team')
      ).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

      expect(form.mounts).toBe(2)
      expect(
        screen.queryByText("The payment form couldn't load")
      ).not.toBeInTheDocument()
      expect(payButton()).toBeDisabled()
    }
  )

  it('ignores a confirm that arrives before the element is ready', async () => {
    const fake = await renderCheckout()
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    form.emit('confirm', 'ctoken_early')
    await nextTick()

    expect(fake.subscribe).not.toHaveBeenCalled()
  })

  it('leaves the form for the waiting state once money is in flight, so a second click cannot charge twice', async () => {
    const fake = await renderCheckout({
      preview: {
        status: 'ok',
        value: previewOf({ transition_type: 'upgrade' })
      }
    })
    await screen.findByText('Upgrade to Creator Plan · Acme Team')
    expect(payButton()).toBeEnabled()

    fake.publishOperation(processingOperation())

    await screen.findByTestId('checkout-waiting')
    expect(screen.getByRole('status')).toHaveTextContent(
      "This payment is already processing and can't be canceled."
    )
    expect(payButton()).toBeDisabled()
    expect(
      screen.getByText('Upgrade to Creator Plan · Acme Team')
    ).toBeInTheDocument()
  })

  it.for<{
    name: string
    options: FakeBillingClientOptions
    arrange: (fake: FakeBillingClient) => void
    body: string
  }>([
    {
      name: 'the capabilities read',
      options: {},
      arrange: (fake) =>
        fake.readCapabilities.mockResolvedValue({
          status: 'error',
          code: 'REQUEST_FAILED'
        }),
      body: "We couldn't check whether this workspace can check out, so checkout can't open yet. Try again, or contact support if this keeps happening."
    },
    {
      name: 'the quote',
      options: { preview: { status: 'error', code: 'REQUEST_FAILED' } },
      arrange: () => {},
      body: "We couldn't load your quote. Nothing has been charged. Try again, or contact support if this keeps happening."
    }
  ])(
    'says so instead of capture when $name fails',
    async ({ options, arrange, body }) => {
      await renderCheckout(options, arrange)

      expect(
        await screen.findByRole('heading', {
          name: "Couldn't load your checkout"
        })
      ).toBeInTheDocument()
      expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
        'REQUEST_FAILED'
      )
      expect(screen.getByText(body)).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Pay and subscribe' })
      ).not.toBeInTheDocument()
    }
  )

  it('renders the refusal instead of capture when the capability is denied', async () => {
    await renderCheckout({ capabilities: {} })

    expect(
      await screen.findByRole('heading', { name: 'Checkout not available' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
      'UNSPECIFIED'
    )
    expect(screen.getByRole('link', { name: 'Contact support' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Pay and subscribe' })
    ).not.toBeInTheDocument()
    expect(form.mounts).toBe(0)
  })

  const SCHEDULED_CHANGE = {
    plan_slug: 'pro_yearly',
    effective_at: '2026-10-28T00:00:00.000Z',
    team_credit_stop: null
  }
  const PRO_YEARLY = planOf({
    slug: 'pro_yearly',
    tier: 'PRO',
    duration: 'ANNUAL'
  })
  const CHANGE_NAMED =
    'Your plan is set to change to Pro Yearly on October 28, 2026. Cancel that change in your billing settings to make a different one.'
  const CHANGE_UNNAMED =
    'Your plan already has a change scheduled. Cancel it in your billing settings to make a different one.'

  it.for<{
    name: string
    scheduled: typeof SCHEDULED_CHANGE | null
    catalog: ReturnType<typeof planOf>[]
    body: string
  }>([
    {
      name: 'names the scheduled plan from the catalog and the date the server set',
      scheduled: SCHEDULED_CHANGE,
      catalog: [PRO_YEARLY],
      body: CHANGE_NAMED
    },
    {
      name: 'falls back when the catalog does not carry the scheduled plan',
      scheduled: SCHEDULED_CHANGE,
      catalog: [planOf()],
      body: CHANGE_UNNAMED
    },
    {
      name: 'falls back when the status names no scheduled change',
      scheduled: null,
      catalog: [PRO_YEARLY],
      body: CHANGE_UNNAMED
    }
  ])(
    'a refusal for a change already scheduled $name',
    async ({ scheduled, catalog, body }) => {
      await renderCheckout({
        capabilities: {},
        denials: {
          can_subscribe_self_serve: 'subscription_change_in_progress'
        },
        plans: {
          status: 'ok',
          value: { current_plan_slug: 'creator_monthly', plans: catalog }
        },
        status: {
          is_active: true,
          has_funds: true,
          max_seats: 1,
          occupied_seats: 1,
          scheduled_change: scheduled,
          team_credit_stop: null
        }
      })

      expect(await screen.findByText(body)).toBeInTheDocument()
      expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
        'SUBSCRIPTION_CHANGE_IN_PROGRESS'
      )
    }
  )

  it.for<{ name: string; returnTo: string; href: string }>([
    {
      name: 'the product that sent the customer, in the billed workspace',
      returnTo: 'comfyui_workspace',
      href: 'https://testcloud.comfy.org/?workspace=ws-team'
    },
    {
      name: "the workspace's Plan & Credits settings when this family has no destination for the target",
      returnTo: 'platform_account',
      href: 'https://testcloud.comfy.org/?settings=plan-credits&workspace=ws-team'
    }
  ])('the back arrow goes to $name', async ({ returnTo, href }) => {
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    const sent = trackedBillingEvents()
    await renderCheckout(
      {},
      () => {},
      `/v1/checkout?product=comfyui&return_to=${returnTo}&plan=creator_monthly`
    )
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(assign).toHaveBeenCalledWith(href)
    expect(sent()).toStrictEqual([
      {
        operation: 'web_return',
        stage: 'clicked',
        outcome: 'pending',
        control: 'back'
      }
    ])
  })

  it.for<{ name: string; serverCode: string; heading: string }>([
    {
      name: 'a plan the catalog lacks is Plan not available',
      serverCode: 'INVALID_PLAN',
      heading: "This plan isn't available"
    },
    {
      name: 'any other refused quote is a load failure',
      serverCode: 'TRANSITION_NOT_ALLOWED',
      heading: "Couldn't load your checkout"
    }
  ])('$name', async ({ serverCode, heading }) => {
    await renderCheckout({
      preview: {
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 400,
        serverCode: readBillingErrorCode({ code: serverCode, message: 'no' })
      }
    })

    expect(
      await screen.findByRole('heading', { name: heading })
    ).toBeInTheDocument()
    expect(form.mounts).toBe(0)
  })

  it.for<{
    name: string
    path: string
    options: FakeBillingClientOptions
    code: string
    plans: string
  }>([
    {
      name: 'a retired plan',
      path: CHECKOUT_PATH,
      options: {
        preview: {
          status: 'error',
          code: 'REQUEST_FAILED',
          httpStatus: 400,
          serverCode: readBillingErrorCode({
            code: 'INVALID_PLAN',
            message: 'no'
          })
        }
      },
      code: 'PLAN_NOT_FOUND',
      plans: 'https://testcloud.comfy.org/?pricing=1&workspace=ws-team'
    },
    {
      name: 'a retired team plan whose link carries its commit stop',
      path: `${CHECKOUT_PATH}&team_credit_stop_id=stop_1`,
      options: {
        preview: {
          status: 'error',
          code: 'REQUEST_FAILED',
          httpStatus: 400,
          serverCode: readBillingErrorCode({
            code: 'INVALID_PLAN',
            message: 'no'
          })
        }
      },
      code: 'PLAN_NOT_FOUND',
      plans: 'https://testcloud.comfy.org/?pricing=team&workspace=ws-team'
    },
    {
      name: 'a team plan named without its commit stop',
      path: '/v1/checkout?product=comfyui&return_to=comfyui_workspace&plan=team_per_credit_monthly',
      options: {
        preview: {
          status: 'ok',
          value: previewOf({
            new_plan: { ...previewOf().new_plan, tier: 'TEAM' }
          })
        }
      },
      code: 'CHECKOUT_LINK_INVALID',
      plans: 'https://testcloud.comfy.org/?pricing=team&workspace=ws-team'
    },
    {
      name: 'a link the contract cannot read',
      path: '/v1/checkout?product=comfyui&return_to=comfyui_workspace&plan=creator/monthly',
      options: {},
      code: 'CHECKOUT_LINK_INVALID',
      plans: 'https://testcloud.comfy.org/?pricing=1&workspace=ws-team'
    },
    {
      name: 'a link that names no plan',
      path: '/v1/checkout?product=comfyui&return_to=comfyui_workspace',
      options: {},
      code: 'CHECKOUT_LINK_INVALID',
      plans: 'https://testcloud.comfy.org/?pricing=1&workspace=ws-team'
    }
  ])(
    '$name is Plan not available, coded for support, and View plans opens the live catalog',
    async ({ path, options, code, plans }) => {
      const assign = vi
        .spyOn(window.location, 'assign')
        .mockImplementation(() => {})
      const fake = await renderCheckout(options, () => {}, path)

      expect(
        await screen.findByRole('heading', {
          name: "This plan isn't available"
        })
      ).toBeInTheDocument()
      expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(code)
      expect(form.mounts).toBe(0)
      expect(fake.subscribe).not.toHaveBeenCalled()

      await userEvent.click(screen.getByRole('button', { name: 'View plans' }))

      expect(assign).toHaveBeenCalledWith(plans)
    }
  )
})

const VISA: SavedPaymentMethod = {
  id: 'pm_visa',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: false
}
const MASTERCARD: SavedPaymentMethod = {
  id: 'pm_mastercard',
  type: 'card',
  brand: 'mastercard',
  last4: '4402',
  is_default: true
}

const tab = (name: 'Saved' | 'Add new payment') =>
  screen.getByRole('tab', { name })

const savedPicker = () =>
  screen.getByRole('combobox', { name: 'Choose a saved payment method' })

async function renderQuoted(options: FakeBillingClientOptions = {}) {
  const fake = await renderCheckout(options)
  await screen.findByText('Subscribe to Creator Plan · Acme Team')
  return fake
}

describe('FullPageCheckoutView saved methods and rail failures', () => {
  beforeEach(() => {
    form.mounts = 0
  })

  it('opens on Saved with the default method and charges it without a card token', async () => {
    const fake = await renderQuoted({
      paymentMethods: { status: 'ok', value: [VISA, MASTERCARD] }
    })

    expect(tab('Saved')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    await userEvent.click(payButton())

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce())
    const request = fake.subscribe.mock.calls[0][0]
    expect(request).toMatchObject({ saved_payment_method_id: 'pm_mastercard' })
    expect(request).not.toHaveProperty('confirmation_token')
  })

  it('180-6640: shows a lone saved card as a static row of its brand and last four, and charges it', async () => {
    const fake = await renderQuoted({
      paymentMethods: { status: 'ok', value: [VISA] }
    })

    expect(screen.getByText('visa')).toBeInTheDocument()
    expect(screen.getByText('·· 4242')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Change' })
    ).not.toBeInTheDocument()
    await userEvent.click(payButton())

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce())
    expect(fake.subscribe.mock.calls[0][0]).toMatchObject({
      saved_payment_method_id: 'pm_visa'
    })
  })

  it('charges the saved method picked from the list', async () => {
    const fake = await renderQuoted({
      paymentMethods: { status: 'ok', value: [VISA, MASTERCARD] }
    })

    await userEvent.click(savedPicker())
    await userEvent.click(await screen.findByRole('option', { name: /4242/ }))
    expect(savedPicker()).toHaveTextContent('·· 4242')
    await userEvent.click(payButton())

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce())
    expect(fake.subscribe.mock.calls[0][0]).toMatchObject({
      saved_payment_method_id: 'pm_visa'
    })
  })

  it('keeps the card form mounted across tab switches, so typed details survive', async () => {
    const fake = await renderQuoted({
      paymentMethods: { status: 'ok', value: [VISA] }
    })
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })

    await userEvent.click(tab('Add new payment'))
    await userEvent.click(tab('Saved'))
    await userEvent.click(tab('Add new payment'))
    form.emit('confirm', 'ctoken_new')

    expect(form.mounts).toBe(1)
    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ confirmation_token: 'ctoken_new' })
      )
    )
    expect(fake.subscribe.mock.calls[0][0]).not.toHaveProperty(
      'saved_payment_method_id'
    )
  })

  it('368-15401: a failed saved read errors on Saved only, hides the address, and Try again reads again', async () => {
    const fake = await renderQuoted({
      paymentMethods: { status: 'error', code: 'REQUEST_FAILED' }
    })
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })

    expect(tab('Saved')).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByText("Your saved payment methods couldn't load")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Pay and subscribe' })
    ).not.toBeInTheDocument()

    await userEvent.click(tab('Add new payment'))
    expect(payButton()).toBeEnabled()

    await userEvent.click(tab('Saved'))
    fake.readPaymentMethods.mockResolvedValueOnce({
      status: 'ok',
      value: {
        scope: { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' },
        methods: [VISA],
        readAt: 0
      }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('·· 4242')).toBeInTheDocument()
    expect(tab('Saved')).toHaveAttribute('aria-selected', 'true')
    expect(payButton()).toBeEnabled()
    expect(form.mounts).toBe(1)
  })

  it('368-15319: a failed element beside saved methods errors on Add new only, and Saved stays payable', async () => {
    await renderQuoted({ paymentMethods: { status: 'ok', value: [VISA] } })
    reportPhase({
      phase: 'payment_element_failed',
      element: 'payment',
      element_phase: 'mount'
    })
    await nextTick()

    expect(tab('Saved')).toHaveAttribute('aria-selected', 'true')
    expect(payButton()).toBeEnabled()

    await userEvent.click(tab('Add new payment'))
    expect(
      screen.getByText(
        'Nothing has been charged. Check your connection and try again, or pay with a saved payment method.'
      )
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(form.mounts).toBe(2)
    expect(tab('Add new payment')).toHaveAttribute('aria-selected', 'true')
    expect(payButton()).toBeDisabled()
  })

  it('takes the whole column when both rails are down, and Try again retries both', async () => {
    const fake = await renderQuoted({
      paymentMethods: { status: 'error', code: 'REQUEST_FAILED' }
    })
    reportPhase({
      phase: 'payment_element_failed',
      element: 'payment',
      element_phase: 'init'
    })

    expect(
      await screen.findByText(
        'Nothing has been charged. Check your connection and try again — your order details are unaffected.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(fake.readPaymentMethods).toHaveBeenCalledOnce()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(form.mounts).toBe(2)
    await waitFor(() =>
      expect(fake.readPaymentMethods).toHaveBeenCalledTimes(2)
    )
  })
})

const payReady = async (options: FakeBillingClientOptions = {}) => {
  const fake = await renderQuoted(options)
  reportPhase({ phase: 'payment_element_ready', element: 'payment' })
  await waitFor(() => expect(payButton()).toBeEnabled())
  return fake
}

describe('FullPageCheckoutView outcomes after Pay', () => {
  beforeEach(() => {
    form.mounts = 0
  })

  it('puts a decline above Pay with its reason, keeps the typed form, and clears it on the next Pay', async () => {
    const fake = await payReady({
      subscribe: {
        status: 'ok',
        value: {
          phase: 'failed',
          operation: failedOperation('insufficient_funds', 'op_declined')
        }
      }
    })

    form.emit('confirm', 'ctoken_1')

    const card = await screen.findByRole('alert')
    expect(card).toHaveTextContent('Payment declined')
    expect(card).toHaveTextContent('Reported issue: Insufficient funds')
    expect(card).toHaveFocus()
    const support = screen.getByRole('link', { name: 'Contact support' })
    expect(support.getAttribute('href')).toContain('op_declined')
    expect(support.getAttribute('href')).toContain('insufficient_funds')
    expect(form.mounts).toBe(1)
    await waitFor(() => expect(payButton()).toBeEnabled())

    fake.subscribe.mockResolvedValueOnce({
      status: 'ok',
      value: { phase: 'succeeded' }
    })
    form.emit('confirm', 'ctoken_2')

    await waitFor(() =>
      expect(screen.queryByText('Payment declined')).not.toBeInTheDocument()
    )
    expect(
      screen.queryByRole('link', { name: 'Contact support' })
    ).not.toBeInTheDocument()
    expect(fake.subscribe).toHaveBeenCalledTimes(2)
  })

  it.for<{
    name: string
    declineReason:
      | 'authentication_failed'
      | 'payment_not_completed'
      | 'processing_error'
    title: string
  }>([
    {
      name: 'a challenge the customer did not complete',
      declineReason: 'authentication_failed',
      title: 'Payment not completed'
    },
    {
      name: 'a payment the customer did not approve',
      declineReason: 'payment_not_completed',
      title: 'Payment not completed'
    },
    {
      name: 'a processing fault',
      declineReason: 'processing_error',
      title: "Payment couldn't be processed"
    }
  ])(
    'names $name in its own card, with no reason line',
    async ({ declineReason, title }) => {
      await payReady({
        subscribe: {
          status: 'ok',
          value: { phase: 'failed', operation: failedOperation(declineReason) }
        }
      })

      form.emit('confirm', 'ctoken_1')

      const card = await screen.findByRole('alert')
      expect(card).toHaveTextContent(title)
      expect(card).not.toHaveTextContent('Reported issue')
      expect(payButton()).toBeInTheDocument()
    }
  )

  it.for<{
    name: string
    code: 'OPERATION_ALREADY_PENDING' | 'CONFLICT'
    found: BillingOperationState
    lands: string
    pay: 'disabled' | 'absent'
  }>([
    {
      name: 'an operation already pending, still in flight',
      code: 'OPERATION_ALREADY_PENDING',
      found: processingOperation('op_elsewhere'),
      lands: "This payment is already processing and can't be canceled.",
      pay: 'disabled'
    },
    {
      name: 'a server conflict over a payment that went through',
      code: 'CONFLICT',
      found: succeededOperation('op_elsewhere'),
      lands: 'Already completed',
      pay: 'absent'
    }
  ])(
    'never shows a decline for $name: it re-reads the operation and lands on it',
    async ({ code, found, lands, pay }) => {
      const fake = await payReady({ subscribe: { status: 'error', code } })
      fake.recover.mockImplementationOnce(async () => {
        fake.publishOperation(found)
        return { status: 'ok', value: found }
      })

      form.emit('confirm', 'ctoken_1')

      expect(await screen.findByText(lands)).toBeInTheDocument()
      expect(fake.subscribe).toHaveBeenCalledOnce()
      expect(fake.recover).toHaveBeenCalledTimes(2)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      const button = screen.queryByRole('button', { name: 'Pay and subscribe' })
      if (pay === 'absent') expect(button).not.toBeInTheDocument()
      else expect(button).toBeDisabled()
      expect(
        screen.queryByRole('link', { name: 'Contact support' })
      ).not.toBeInTheDocument()
    }
  )

  it('314-10612: a refused Pay is the processing error card, with support quoting its code, and Pay stays free for another try', async () => {
    const fake = await payReady({
      subscribe: { status: 'error', code: 'REQUEST_FAILED' }
    })

    form.emit('confirm', 'ctoken_1')

    const card = await screen.findByRole('alert')
    expect(card).toHaveTextContent("Payment couldn't be processed")
    expect(card).toHaveTextContent(
      "We couldn't reach the billing service. Please try again."
    )
    const support = new URL(
      screen
        .getByRole('link', { name: 'Contact support' })
        .getAttribute('href') ?? ''
    )
    expect(support.searchParams.get('body')).toBe('Error code: REQUEST_FAILED')
    await waitFor(() => expect(payButton()).toBeEnabled())

    form.emit('confirm', 'ctoken_2')

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledTimes(2))
  })

  it('shows the sentence a server error wrote inside the processing error card', async () => {
    await payReady({
      subscribe: {
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 500,
        serverMessage: 'Billing is down for maintenance.'
      }
    })

    form.emit('confirm', 'ctoken_1')

    const card = await screen.findByRole('alert')
    expect(card).toHaveTextContent("Payment couldn't be processed")
    expect(card).toHaveTextContent('Billing is down for maintenance.')
  })

  it('frees Pay again when the collision re-reads as nothing pending', async () => {
    const fake = await payReady({
      subscribe: { status: 'error', code: 'OPERATION_ALREADY_PENDING' }
    })

    form.emit('confirm', 'ctoken_1')

    await waitFor(() => expect(fake.recover).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(payButton()).toBeEnabled())
    expect(form.mounts).toBe(1)
  })

  it("names the plan and the workspace once this page's own Pay goes through", async () => {
    const fake = await payReady({
      subscribe: {
        status: 'ok',
        value: { phase: 'succeeded', operation: succeededOperation('op_mine') }
      }
    })

    form.emit('confirm', 'ctoken_1')

    expect(
      await screen.findByRole('heading', { name: "You're all set" })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Your plan for Acme Team has been successfully updated.')
    ).toBeInTheDocument()
    expect(screen.getByTestId('checkout-ending-plan')).toHaveTextContent(
      'Creator$28.00 USD / mo'
    )
    expect(screen.queryByTestId('checkout-ending-code')).not.toBeInTheDocument()
    expect(fake.subscribe).toHaveBeenCalledOnce()
  })

  describe('Close', () => {
    const SETTLED: FakeBillingClientOptions = {
      subscribe: {
        status: 'ok',
        value: { phase: 'succeeded', operation: succeededOperation('op_mine') }
      }
    }

    afterEach(() => {
      Reflect.deleteProperty(window, 'opener')
    })

    it('goes back to return_to with the outcome and reference when no script opened the tab', async () => {
      const assign = vi
        .spyOn(window.location, 'assign')
        .mockImplementation(() => {})
      const close = vi.spyOn(window, 'close').mockImplementation(() => {})
      const sent = trackedBillingEvents()
      await payReady(SETTLED)
      form.emit('confirm', 'ctoken_1')

      await userEvent.click(
        await screen.findByRole('button', { name: 'Close' })
      )

      expect(close).not.toHaveBeenCalled()
      expect(assign).toHaveBeenCalledOnce()
      expect(parseReturnResult(String(assign.mock.calls[0][0]))).toEqual({
        result: 'success',
        reference: 'op_mine'
      })
      expect(
        sent().filter((event) => event.operation === 'web_return')
      ).toStrictEqual([
        {
          operation: 'web_return',
          stage: 'clicked',
          outcome: 'pending',
          control: 'success_close'
        }
      ])
    })

    it("goes to the workspace's Plan & Credits settings when this family has no destination for return_to", async () => {
      const assign = vi
        .spyOn(window.location, 'assign')
        .mockImplementation(() => {})
      await renderCheckout(
        SETTLED,
        () => {},
        '/v1/checkout?product=comfyui&return_to=platform_account&plan=creator_monthly'
      )
      await screen.findByText('Subscribe to Creator Plan · Acme Team')
      reportPhase({ phase: 'payment_element_ready', element: 'payment' })
      await waitFor(() => expect(payButton()).toBeEnabled())
      form.emit('confirm', 'ctoken_1')

      await userEvent.click(
        await screen.findByRole('button', { name: 'Close' })
      )

      expect(assign).toHaveBeenCalledWith(
        'https://testcloud.comfy.org/?settings=plan-credits&workspace=ws-team'
      )
    })

    it('closes a tab a script opened, and navigates nowhere', async () => {
      Object.defineProperty(window, 'opener', {
        value: {},
        configurable: true
      })
      const assign = vi
        .spyOn(window.location, 'assign')
        .mockImplementation(() => {})
      const close = vi.spyOn(window, 'close').mockImplementation(() => {})
      await payReady(SETTLED)
      form.emit('confirm', 'ctoken_1')

      await userEvent.click(
        await screen.findByRole('button', { name: 'Close' })
      )

      expect(close).toHaveBeenCalledOnce()
      expect(assign).not.toHaveBeenCalled()
    })

    it.for<{ name: string; opened: boolean; footer: string }>([
      { name: 'a tab a script opened', opened: true, footer: 'Closing in 5…' },
      {
        name: 'any other tab',
        opened: false,
        footer: 'You can close this tab now.'
      }
    ])('ends Success on $name with "$footer"', async ({ opened, footer }) => {
      if (opened)
        Object.defineProperty(window, 'opener', {
          value: {},
          configurable: true
        })
      vi.spyOn(window, 'close').mockImplementation(() => {})
      await payReady(SETTLED)
      form.emit('confirm', 'ctoken_1')

      expect(await screen.findByText(footer)).toBeInTheDocument()
    })
  })

  it('lands on the terminal for a plan the server activated with no operation to follow', async () => {
    await renderCheckout({
      preview: {
        status: 'ok',
        value: previewOf({ transition_type: 'upgrade' })
      },
      subscribe: { status: 'ok', value: { phase: 'succeeded' } }
    })
    await screen.findByText('Upgrade to Creator Plan · Acme Team')
    await waitFor(() => expect(payButton()).toBeEnabled())

    await userEvent.click(payButton())

    expect(
      await screen.findByRole('heading', { name: "You're all set" })
    ).toBeInTheDocument()
  })

  it('re-prices an expired quote and says so, without charging', async () => {
    const fake = await payReady({
      subscribe: {
        status: 'error',
        code: 'CONFLICT',
        serverCode: readBillingErrorCode({
          code: 'PRORATION_QUOTE_EXPIRED',
          message: 'expired'
        })
      }
    })
    fake.previewSubscribe.mockResolvedValueOnce({
      status: 'ok',
      value: previewOf({ amount_due_cents: 3100 })
    })

    form.emit('confirm', 'ctoken_1')

    const card = await screen.findByRole('alert')
    expect(card).toHaveTextContent('The price has updated')
    expect(card).toHaveTextContent(
      'Your quote expired, so the numbers were refreshed. Review the new total before paying. You have not been charged.'
    )
    expect(fake.previewSubscribe).toHaveBeenCalledTimes(2)
    expect(form.mounts).toBe(1)
    expect(payButton()).toBeEnabled()
    expect(
      screen.queryByRole('link', { name: 'Contact support' })
    ).not.toBeInTheDocument()
  })

  it('553-9297: a plan change on a plan set to end asks to keep it; Pay without the tick sends nothing, with it sends the consent', async () => {
    const fake = await renderCheckout({
      preview: {
        status: 'ok',
        value: previewOf({
          transition_type: 'upgrade',
          requires_reactivation_confirmation: true,
          cost_next_period_cents: 10_000,
          renewal_at: '2026-07-28T00:00:00.000Z'
        })
      },
      status: {
        is_active: true,
        has_funds: true,
        max_seats: 1,
        occupied_seats: 1,
        scheduled_change: null,
        team_credit_stop: null,
        cancel_at: '2026-07-28T00:00:00.000Z'
      }
    })
    await screen.findByText('Upgrade to Creator Plan · Acme Team')

    expect(
      await screen.findByText('Your plan was set to end on July 28, 2026')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Upgrading keeps your subscription, and it renews that day at $100.00.'
      )
    ).toBeInTheDocument()
    const box = screen.getByRole('checkbox', {
      name: 'Keep my subscription and renew it'
    })
    expect(payButton()).toBeEnabled()

    await userEvent.click(payButton())

    expect(fake.subscribe).not.toHaveBeenCalled()
    expect(box).toHaveAttribute('aria-invalid', 'true')
    expect(box).toHaveFocus()
    expect(box).toHaveAccessibleDescription(
      'Check the box to keep your subscription, then pay.'
    )
    expect(payButton()).toBeEnabled()

    await userEvent.click(box)

    expect(box).toHaveAttribute('aria-invalid', 'false')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await userEvent.click(payButton())

    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ confirm_reactivation: true })
      )
    )
  })

  it('a token the form hands over without the tick sends nothing either', async () => {
    const fake = await payReady({
      preview: {
        status: 'ok',
        value: previewOf({ requires_reactivation_confirmation: true })
      }
    })

    form.emit('confirm', 'ctoken_1')
    await nextTick()

    expect(fake.subscribe).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('locks the keep-subscription box, ticked, while its Pay is in flight', async () => {
    const fake = await payReady({
      preview: {
        status: 'ok',
        value: previewOf({ requires_reactivation_confirmation: true })
      }
    })
    const box = screen.getByRole('checkbox', {
      name: 'Keep my subscription and renew it'
    })
    await userEvent.click(box)
    fake.subscribe.mockImplementation(() => new Promise(() => {}))

    form.emit('confirm', 'ctoken_1')

    await waitFor(() => expect(box).toBeDisabled())
    expect(box).toBeChecked()
  })

  it('re-quotes and asks unticked when the server wants the consent, with Pay still live', async () => {
    const fake = await payReady({
      subscribe: { status: 'error', code: 'REACTIVATION_CONFIRMATION_REQUIRED' }
    })

    form.emit('confirm', 'ctoken_1')

    expect(await screen.findByRole('checkbox')).not.toBeChecked()
    expect(fake.previewSubscribe).toHaveBeenCalledTimes(2)
    expect(fake.readStatus).toHaveBeenCalledOnce()
    expect(payButton()).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.for<{ name: string; subscribe: FakeBillingClientOptions['subscribe'] }>([
    {
      name: 'an expired quote',
      subscribe: {
        status: 'error',
        code: 'CONFLICT',
        serverCode: readBillingErrorCode({
          code: 'PRORATION_QUOTE_EXPIRED',
          message: 'expired'
        })
      }
    },
    {
      name: 'a consent the server wants',
      subscribe: { status: 'error', code: 'REACTIVATION_CONFIRMATION_REQUIRED' }
    }
  ])(
    'leaves no Pay over the refused price when re-quoting $name fails, and Try again prices again in place',
    async ({ subscribe }) => {
      const fake = await payReady({ subscribe })
      fake.previewSubscribe.mockResolvedValueOnce({
        status: 'error',
        code: 'REQUEST_FAILED'
      })

      form.emit('confirm', 'ctoken_1')

      expect(
        await screen.findByRole('heading', {
          name: "Couldn't load your checkout"
        })
      ).toBeInTheDocument()
      expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
        'REQUEST_FAILED'
      )
      expect(fake.previewSubscribe).toHaveBeenCalledTimes(2)
      expect(fake.subscribe).toHaveBeenCalledOnce()
      expect(
        screen.queryByRole('button', { name: 'Pay and subscribe' })
      ).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

      expect(
        await screen.findByText('Subscribe to Creator Plan · Acme Team')
      ).toBeInTheDocument()
      expect(fake.previewSubscribe).toHaveBeenCalledTimes(3)
      expect(fake.subscribe).toHaveBeenCalledOnce()
    }
  )
})

const waitingStatus = () => screen.findByTestId('checkout-waiting')

const settlingOperation = (id: string): PendingBillingOperation => ({
  ...pendingOperation(id),
  authenticationState: 'processing',
  serverPhase: 'in_progress'
})

/** Every read the capture needs has answered by the next macrotask. */
const capturePromisesFlushed = () =>
  new Promise((resolve) => setTimeout(resolve))

describe('FullPageCheckoutView mount reconciliation', () => {
  beforeEach(() => {
    form.mounts = 0
  })

  it('holds the skeleton until reconciliation answers, even with the quote in hand', async () => {
    let answerRecovery: (
      result: BillingResult<BillingOperationState | undefined>
    ) => void = () => {}
    await renderCheckout({}, (fake) =>
      fake.recover.mockImplementationOnce(
        () => new Promise((resolve) => (answerRecovery = resolve))
      )
    )
    await waitFor(() => expect(screen.getByText('Loading…')).toBeVisible())
    await capturePromisesFlushed()

    expect(
      screen.queryByText('Subscribe to Creator Plan · Acme Team')
    ).not.toBeInTheDocument()
    expect(form.mounts).toBe(0)
    expect(payButton()).toBeDisabled()

    answerRecovery({ status: 'ok', value: undefined })

    expect(
      await screen.findByText('Subscribe to Creator Plan · Acme Team')
    ).toBeInTheDocument()
    expect(form.mounts).toBe(1)
  })

  it('renders the waiting state over a locked form for money already in flight, and follows it to Already completed', async () => {
    const fake = await renderCheckout({
      recover: { status: 'ok', value: processingOperation('op_reloaded') }
    })

    await waitingStatus()
    expect(screen.getByRole('status')).toHaveTextContent(
      "This payment is already processing and can't be canceled."
    )
    expect(
      screen.getByText('Subscribe to Creator Plan · Acme Team')
    ).toBeInTheDocument()
    await waitFor(() => expect(form.locked()).toBe(true))
    expect(payButton()).toBeDisabled()

    fake.publishOperation(succeededOperation('op_reloaded'))

    expect(
      await screen.findByRole('heading', { name: 'Already completed' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "This payment for Acme Team already went through. You won't be charged again."
      )
    ).toBeInTheDocument()
    expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
      'op_reloaded'
    )
    expect(screen.queryByTestId('checkout-ending-plan')).not.toBeInTheDocument()
  })

  it.for<{
    name: string
    serverPhase: 'awaiting_invoice_payment' | 'in_progress'
  }>([
    {
      name: 'an invoice awaiting payment',
      serverPhase: 'awaiting_invoice_payment'
    },
    { name: 'a charge in progress', serverPhase: 'in_progress' }
  ])('treats $name as money in flight', async ({ serverPhase }) => {
    await renderCheckout({
      recover: {
        status: 'ok',
        value: { ...pendingOperation(), serverPhase }
      }
    })

    expect(await waitingStatus()).toBeInTheDocument()
    await waitFor(() => expect(form.locked()).toBe(true))
  })

  it('renders capture with Pay live for an operation parked on a payment method (rule 4)', async () => {
    const fake = await renderCheckout({
      recover: {
        status: 'ok',
        value: {
          ...pendingOperation('op_parked'),
          serverPhase: 'awaiting_payment_method'
        }
      }
    })
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })

    await waitFor(() => expect(payButton()).toBeEnabled())
    expect(screen.queryByTestId('checkout-waiting')).not.toBeInTheDocument()
    form.emit('confirm', 'ctoken_1')

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce())
  })

  it('opens capture on the card of a recovered operation that already declined', async () => {
    await renderCheckout({
      recover: {
        status: 'ok',
        value: failedOperation('insufficient_funds', 'op_declined_elsewhere')
      }
    })

    const card = await screen.findByRole('alert')
    expect(card).toHaveTextContent('Payment declined')
    expect(card).toHaveTextContent('Reported issue: Insufficient funds')
    expect(
      screen.getByRole('link', { name: 'Contact support' }).getAttribute('href')
    ).toContain('op_declined_elsewhere')
    expect(form.mounts).toBe(1)
  })

  it('lands on Already completed for a payment the server already settled when the quote refuses this link again', async () => {
    await renderCheckout({
      recover: { status: 'ok', value: succeededOperation('op_done') },
      preview: { status: 'ok', value: previewOf({ allowed: false }) }
    })

    expect(
      await screen.findByRole('heading', { name: 'Already completed' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
      'op_done'
    )
    expect(form.mounts).toBe(0)
  })

  it('opens the form over a settled payment when the quote still sells this link', async () => {
    await renderCheckout({
      recover: { status: 'ok', value: succeededOperation('op_done') }
    })

    expect(
      await screen.findByText('Subscribe to Creator Plan · Acme Team')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Already completed' })
    ).not.toBeInTheDocument()
    expect(form.mounts).toBe(1)
  })

  it('resolves a fresh capture, on its card, when the money it arrived on declines', async () => {
    const fake = await renderCheckout({
      recover: { status: 'ok', value: pendingOperation('op_awaited') }
    })
    await waitingStatus()

    fake.publishOperation(failedOperation('card_declined', 'op_awaited'))

    const card = await screen.findByRole('alert')
    expect(card).toHaveTextContent('Payment declined')
    expect(fake.previewSubscribe).toHaveBeenCalledTimes(2)
    expect(form.mounts).toBe(1)
  })

  it("keeps a form left open plain when another tab's payment declines", async () => {
    const fake = await payReady()

    fake.publishOperation(failedOperation('card_declined', 'op_sibling'))
    await nextTick()

    expect(screen.queryByText('Payment declined')).not.toBeInTheDocument()
    expect(payButton()).toBeEnabled()
    expect(form.mounts).toBe(1)
  })

  it('says so instead of a form when the recovery itself fails, without claiming nothing was charged, and Try again resolves again in place', async () => {
    const fake = await renderCheckout({
      recover: { status: 'error', code: 'REQUEST_FAILED' }
    })

    expect(
      await screen.findByRole('heading', {
        name: "Couldn't load your checkout"
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "We couldn't check your recent payments, so checkout can't open yet. Try again, or contact support if this keeps happening."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Nothing has been charged/)
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
      'REQUEST_FAILED'
    )
    expect(form.mounts).toBe(0)

    fake.recover.mockResolvedValue({ status: 'ok', value: undefined })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByText('Subscribe to Creator Plan · Acme Team')
    ).toBeInTheDocument()
    expect(fake.recover).toHaveBeenCalledTimes(2)
    expect(fake.previewSubscribe).toHaveBeenCalledTimes(2)
    expect(form.mounts).toBe(1)
  })

  it('renders Payment in progress for a capture the bank is still settling, then follows it to a card-less success', async () => {
    const fake = await renderCheckout({
      recover: { status: 'ok', value: settlingOperation('op_bank') }
    })

    expect(
      await screen.findByRole('heading', { name: 'Payment in progress' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
      'op_bank'
    )
    expect(screen.getByRole('link', { name: 'Contact support' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Close' })
    ).not.toBeInTheDocument()
    expect(form.mounts).toBe(0)

    fake.publishOperation({
      ...settlingOperation('op_bank'),
      authenticationState: 'succeeded'
    })
    expect(
      await screen.findByRole('heading', { name: 'Payment received' })
    ).toBeInTheDocument()

    fake.publishOperation(succeededOperation('op_bank'))
    expect(
      await screen.findByRole('heading', { name: "You're all set" })
    ).toBeInTheDocument()
    expect(fake.subscribe).not.toHaveBeenCalled()
  })

  it.for<{ name: string; watched: PendingBillingOperation; heading: string }>([
    {
      name: 'a settling capture keeps Payment in progress',
      watched: settlingOperation('op_lapsed'),
      heading: 'Payment in progress'
    },
    {
      name: 'money still being verified says it could not confirm',
      watched: pendingOperation('op_lapsed'),
      heading: "We couldn't confirm your payment"
    }
  ])(
    'follows a watch whose poll budget ran out afresh: $name',
    async ({ watched, heading }) => {
      const fake = await renderCheckout({
        recover: { status: 'ok', value: watched }
      })
      await waitFor(() => expect(fake.recover).toHaveBeenCalledOnce())

      fake.publishOperation({
        ...succeededOperation('op_lapsed'),
        phase: 'timed_out'
      })

      expect(
        await screen.findByRole('heading', { name: heading })
      ).toBeInTheDocument()
      await waitFor(() => expect(fake.recover).toHaveBeenCalledTimes(2))
      expect(form.mounts).toBe(0)
    }
  )
})

function pageShow(persisted: boolean): Event {
  const event = new Event('pageshow')
  Object.defineProperty(event, 'persisted', { value: persisted })
  return event
}

describe('FullPageCheckoutView re-reconciliation', () => {
  beforeEach(() => {
    form.mounts = 0
    siblings.reset()
  })

  it('re-reads the operation when the page is restored from the back-forward cache, and lands on what it finds', async () => {
    const fake = await payReady()
    fake.recover.mockImplementationOnce(async () => {
      fake.publishOperation(pendingOperation('op_moved_on'))
      return { status: 'ok', value: pendingOperation('op_moved_on') }
    })

    window.dispatchEvent(pageShow(true))

    expect(await waitingStatus()).toBeInTheDocument()
    expect(fake.recover).toHaveBeenCalledTimes(2)
    expect(payButton()).toBeDisabled()
  })

  it('leaves a fresh navigation alone', async () => {
    const fake = await payReady()

    window.dispatchEvent(pageShow(false))
    await nextTick()

    expect(fake.recover).toHaveBeenCalledOnce()
    expect(payButton()).toBeEnabled()
  })

  it('lets the newest reconciliation win over a slower, older one', async () => {
    let answerFirst: (
      result: BillingResult<BillingOperationState | undefined>
    ) => void = () => {}
    const fake = await renderCheckout({}, (fake) =>
      fake.recover.mockImplementationOnce(
        () => new Promise((resolve) => (answerFirst = resolve))
      )
    )
    await waitFor(() => expect(fake.recover).toHaveBeenCalledOnce())
    fake.recover.mockImplementationOnce(async () => {
      fake.publishOperation(pendingOperation('op_newer'))
      return { status: 'ok', value: pendingOperation('op_newer') }
    })

    window.dispatchEvent(pageShow(true))
    await waitingStatus()
    answerFirst({ status: 'ok', value: undefined })
    await capturePromisesFlushed()

    expect(screen.getByTestId('checkout-waiting')).toBeInTheDocument()
    expect(form.locked()).toBe(true)
  })

  it('listens on a channel scoped to the signed-in user and the workspace, and lets go on unmount', async () => {
    await renderQuoted()

    expect(siblings.scope).toEqual({ uid: 'uid-1', workspaceId: 'ws-team' })
    expect(siblings.listeners.size).toBe(1)

    cleanup()

    expect(siblings.listeners.size).toBe(0)
    expect(siblings.closed).toBe(1)
  })

  it("re-reads the server on a sibling tab's nudge, trusting nothing in the notice itself", async () => {
    const fake = await payReady()
    fake.recover.mockImplementationOnce(async () => {
      fake.publishOperation(succeededOperation('op_from_server'))
      return { status: 'ok', value: succeededOperation('op_from_server') }
    })

    siblings.nudge({
      workspaceId: 'ws-team',
      operationId: 'op_claimed_by_notice',
      kind: 'settled'
    })

    expect(
      await screen.findByRole('heading', { name: 'Already completed' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
      'op_from_server'
    )
    expect(fake.recover).toHaveBeenCalledTimes(2)
  })

  it('tells sibling tabs when its own Pay starts an operation and when it settles, once each', async () => {
    const fake = await payReady({
      subscribe: {
        status: 'ok',
        value: { phase: 'succeeded', operation: succeededOperation('op_mine') }
      }
    })
    fake.subscribe.mockImplementationOnce(async () => {
      fake.publishOperation(pendingOperation('op_mine'))
      await nextTick()
      fake.publishOperation({
        ...pendingOperation('op_mine'),
        serverPhase: 'in_progress'
      })
      await nextTick()
      fake.publishOperation(succeededOperation('op_mine'))
      return {
        status: 'ok',
        value: { phase: 'succeeded', operation: succeededOperation('op_mine') }
      }
    })

    form.emit('confirm', 'ctoken_1')

    await screen.findByRole('heading', { name: "You're all set" })
    expect(siblings.published).toEqual([
      { workspaceId: 'ws-team', operationId: 'op_mine', kind: 'started' },
      { workspaceId: 'ws-team', operationId: 'op_mine', kind: 'settled' }
    ])
  })

  it('never announces an operation it only heard about', async () => {
    const fake = await renderCheckout({
      recover: { status: 'ok', value: pendingOperation('op_theirs') }
    })
    await waitingStatus()

    fake.publishOperation(succeededOperation('op_theirs'))
    await screen.findByRole('heading', { name: 'Already completed' })

    expect(siblings.published).toEqual([])
  })
})

describe("FullPageCheckoutView over this tab's own payment", () => {
  beforeEach(() => {
    form.mounts = 0
    siblings.reset()
  })

  const awaited = <T extends BillingOperationState>(operation: T): T => ({
    ...operation,
    awaitedHere: true
  })
  const couldNotConfirm = (id: string): BillingOperationState => ({
    ...awaited(succeededOperation(id)),
    phase: 'reconciliation_needed'
  })
  const ON_PRO: FakeBillingClientOptions = {
    status: {
      is_active: true,
      has_funds: true,
      max_seats: 1,
      occupied_seats: 1,
      plan_slug: 'pro_monthly',
      scheduled_change: null,
      team_credit_stop: null
    },
    plans: {
      status: 'ok',
      value: {
        plans: [
          planOf(),
          planOf({ slug: 'pro_monthly', tier: 'PRO', price_cents: 5000n })
        ]
      }
    }
  }

  it("asks the lifecycle for this tab's settled payment too", async () => {
    const fake = await renderCheckout()
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    expect(fake.recover).toHaveBeenCalledWith({ includeSettled: true })
  })

  it('ends on Checkout not available, never a dead form, when the quote refuses a link nothing here paid', async () => {
    await renderCheckout({
      preview: { status: 'ok', value: previewOf({ allowed: false }) }
    })

    expect(
      await screen.findByRole('heading', { name: 'Checkout not available' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
      'UNSPECIFIED'
    )
    expect(
      screen.queryByRole('button', { name: 'Pay and subscribe' })
    ).not.toBeInTheDocument()
    expect(form.mounts).toBe(0)
  })

  it('is Success, naming the plan the server now lists, for its own payment that went through while it was on a provider page', async () => {
    await renderCheckout({
      ...ON_PRO,
      recover: { status: 'ok', value: awaited(succeededOperation('op_mine')) },
      preview: { status: 'ok', value: previewOf({ allowed: false }) }
    })

    expect(
      await screen.findByRole('heading', { name: "You're all set" })
    ).toBeInTheDocument()
    const plan = await screen.findByTestId('checkout-ending-plan')
    expect(plan).toHaveTextContent('Pro')
    expect(plan).toHaveTextContent('$50.00')
    expect(plan).not.toHaveTextContent('Creator')
    expect(form.mounts).toBe(0)
  })

  it('keeps re-reading a payment it could not confirm, and resolves forward to Success when it settles', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const fake = await renderCheckout({
      ...ON_PRO,
      recover: { status: 'ok', value: couldNotConfirm('op_mine') }
    })
    expect(
      await screen.findByRole('heading', {
        name: "We couldn't confirm your payment"
      })
    ).toBeInTheDocument()
    expect(fake.recover).toHaveBeenCalledOnce()

    vi.advanceTimersByTime(OPERATION_POLL_TIMING.parkedMs)
    await waitFor(() => expect(fake.recover).toHaveBeenCalledTimes(2))
    expect(
      screen.getByRole('heading', { name: "We couldn't confirm your payment" })
    ).toBeInTheDocument()

    fake.recover.mockImplementationOnce(async () => {
      fake.publishOperation(awaited(succeededOperation('op_mine')))
      return { status: 'ok', value: awaited(succeededOperation('op_mine')) }
    })
    vi.advanceTimersByTime(OPERATION_POLL_TIMING.parkedMs)

    expect(
      await screen.findByRole('heading', { name: "You're all set" })
    ).toBeInTheDocument()
    expect(await screen.findByTestId('checkout-ending-plan')).toHaveTextContent(
      'Pro'
    )
    expect(fake.subscribe).not.toHaveBeenCalled()
  })

  const RECEIPT_PLAN = { slug: 'pro_monthly', duration: 'MONTHLY' } as const
  const withReceipt = (
    operation: BillingOperationState,
    receipt: BillingOperationReceipt
  ): BillingOperationState => ({ ...operation, phase: 'succeeded', receipt })

  it('328-4444: Already completed names the plan and credits its receipt reports, from the catalog', async () => {
    await renderCheckout({
      plans: ON_PRO.plans,
      recover: {
        status: 'ok',
        value: withReceipt(succeededOperation('op_done'), {
          plan: RECEIPT_PLAN,
          creditsAdded: 10_000
        })
      },
      preview: { status: 'ok', value: previewOf({ allowed: false }) }
    })

    expect(
      await screen.findByRole('heading', { name: 'Already completed' })
    ).toBeInTheDocument()
    const plan = await screen.findByTestId('checkout-ending-plan')
    expect(plan).toHaveTextContent('Pro$50.00 USD / mo10,000 credits added')
    expect(screen.queryByTestId('checkout-ending-code')).not.toBeInTheDocument()
  })

  it('390-4947: shows Payment received while its credits land, and Success once a re-read reports them', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const landing = withReceipt(awaited(succeededOperation('op_mine')), {
      amountChargedCents: 5000,
      plan: RECEIPT_PLAN
    })
    const fake = await renderCheckout({
      ...ON_PRO,
      recover: { status: 'ok', value: landing },
      preview: { status: 'ok', value: previewOf({ allowed: false }) }
    })

    expect(
      await screen.findByRole('heading', { name: 'Payment received' })
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByTestId('checkout-ending-receipt')).toHaveTextContent(
        'Payment$50.00Credits addedAdding…PlanPro'
      )
    )

    const landed = withReceipt(landing, {
      amountChargedCents: 5000,
      creditsAdded: 10_000,
      plan: RECEIPT_PLAN
    })
    fake.recover.mockImplementation(async () => ({
      status: 'ok',
      value: landed
    }))
    vi.advanceTimersByTime(OPERATION_POLL_TIMING.parkedMs)

    expect(
      await screen.findByRole('heading', { name: "You're all set" })
    ).toBeInTheDocument()
    expect(await screen.findByTestId('checkout-ending-plan')).toHaveTextContent(
      '10,000 credits added'
    )
    const reads = fake.recover.mock.calls.length
    vi.advanceTimersByTime(OPERATION_POLL_TIMING.parkedMs * 3)
    expect(fake.recover).toHaveBeenCalledTimes(reads)
  })
})

const challengedOperation = (
  id: string,
  status: 'required' | 'in_progress'
): PendingBillingOperation => ({
  ...pendingOperation(id),
  authenticationState: 'requires_action',
  challenge: { clientSecret: 'cs', status }
})

const PHASE_A = 'Nothing has been charged yet.'
const PHASE_B = "This payment is already processing and can't be canceled."
const ALIPAY =
  'Taking you to Alipay to finish paying. Nothing has been charged yet.'

const footnote = () => screen.getByTestId('checkout-phase-footnote')

/** A Pay whose subscribe never answers, so the page follows only what the lifecycle publishes. */
async function payHeld(methodType?: string) {
  const fake = await payReady()
  fake.subscribe.mockImplementation(() => new Promise(() => {}))
  form.emit('confirm', 'ctoken_1', methodType)
  await waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce())
  return fake
}

describe('FullPageCheckoutView payment authentication', () => {
  beforeEach(() => {
    form.mounts = 0
    nextStep.leavesPage = false
    nextStep.asked = 0
  })

  it('cancels its own challenge once however often Cancel payment is clicked, then frees the form as typed', async () => {
    let answer: (result: CancelOperationResult) => void = () => {}
    const fake = await payReady()
    fake.subscribe.mockImplementation(() => new Promise(() => {}))
    fake.cancelOperation.mockImplementation(
      () => new Promise((resolve) => (answer = resolve))
    )
    form.emit('confirm', 'ctoken_1')
    fake.publishOperation(challengedOperation('op_3ds', 'required'))
    const mounts = form.mounts

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel payment' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'Canceling…' }))

    expect(fake.cancelOperation).toHaveBeenCalledExactlyOnceWith('op_3ds')
    answer({ status: 'canceled' })

    await waitFor(() => expect(footnote()).toHaveTextContent(''))
    expect(form.locked()).toBe(false)
    expect(form.mounts).toBe(mounts)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('stops asking after a cancel the server never settles, and offers Cancel payment again', async () => {
    const fake = await payReady({
      cancelOperation: { status: 'cancel_requested' }
    })
    fake.subscribe.mockImplementation(() => new Promise(() => {}))
    form.emit('confirm', 'ctoken_1')
    fake.publishOperation(challengedOperation('op_3ds', 'required'))
    const cancel = await screen.findByRole('button', { name: 'Cancel payment' })

    vi.useFakeTimers({ toFake: ['setTimeout'] })
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(cancel)
    await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.initialMs * 30)
    vi.useRealTimers()

    expect(fake.cancelOperation).toHaveBeenCalledTimes(10)
    expect(
      await screen.findByRole('button', { name: 'Cancel payment' })
    ).toBeEnabled()
    expect(footnote()).toHaveTextContent(PHASE_A)
  })

  it('locks its own Pay through a challenge, then processing, then lands on the success', async () => {
    const fake = await payReady()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    fake.subscribe.mockImplementation(() => new Promise(() => {}))
    form.emit('confirm', 'ctoken_1')

    fake.publishOperation(challengedOperation('op_3ds', 'in_progress'))

    await waitFor(() => expect(footnote()).toHaveTextContent(PHASE_A))
    expect(payButton()).toBeDisabled()
    expect(payButton()).toHaveAttribute('aria-busy', 'true')
    expect(form.locked()).toBe(true)
    expect(
      screen.queryByRole('button', { name: 'Back' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel payment' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Continue verification' })
    ).not.toBeInTheDocument()

    fake.publishOperation({
      ...pendingOperation('op_3ds'),
      authenticationState: 'processing'
    })

    await waitFor(() => expect(footnote()).toHaveTextContent(PHASE_B))
    expect(payButton()).toBeDisabled()

    fake.publishOperation(succeededOperation('op_3ds'))

    expect(
      await screen.findByRole('heading', { name: "You're all set" })
    ).toBeInTheDocument()
  })

  it('makes the payment tabs inert while its own Pay is in flight', async () => {
    const fake = await renderQuoted({
      paymentMethods: { status: 'ok', value: [VISA] }
    })
    fake.subscribe.mockImplementation(() => new Promise(() => {}))
    expect(screen.getByRole('tablist')).not.toHaveAttribute('inert')

    await userEvent.click(payButton())

    await waitFor(() =>
      expect(screen.getByRole('tablist')).toHaveAttribute('inert')
    )
  })

  it('puts a challenge the bank refused on its card and frees Pay for the retry, on the same form', async () => {
    const fake = await payHeld()
    fake.publishOperation(challengedOperation('op_3ds', 'in_progress'))
    await waitFor(() => expect(footnote()).toHaveTextContent(PHASE_A))

    fake.publishOperation({
      ...pendingOperation('op_3ds'),
      authenticationState: 'failed_retryable',
      challenge: { clientSecret: 'cs', status: 'failed' }
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Payment not completed'
    )
    await waitFor(() => expect(payButton()).toBeEnabled())
    expect(footnote()).toBeEmptyDOMElement()
    expect(form.locked()).toBe(false)
    expect(form.mounts).toBe(1)

    form.emit('confirm', 'ctoken_2')

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledTimes(2))
    expect(fake.subscribe.mock.calls[1][0]).toMatchObject({
      confirmation_token: 'ctoken_2'
    })
  })

  it.for<{
    name: string
    methodType: string
    sent: string
    challenged: string
  }>([
    {
      name: 'an Alipay Pay names where it is going, even over a challenge',
      methodType: 'alipay',
      sent: ALIPAY,
      challenged: ALIPAY
    },
    {
      name: 'a card Pay claims no phase until the bank asks for a challenge',
      methodType: 'card',
      sent: '',
      challenged: PHASE_A
    }
  ])('$name', async ({ methodType, sent, challenged }) => {
    const fake = await payHeld(methodType)

    await waitFor(() => expect(footnote().textContent.trim()).toBe(sent))
    expect(payButton()).toHaveAttribute('aria-busy', 'true')

    fake.publishOperation(challengedOperation('op_3ds', 'in_progress'))

    await waitFor(() => expect(footnote().textContent.trim()).toBe(challenged))
  })

  it('claims no phase for an operation the bank has not answered for, then Phase B once it is processing', async () => {
    const fake = await payHeld()
    fake.publishOperation(pendingOperation('op_card'))
    await nextTick()

    expect(footnote()).toBeEmptyDOMElement()
    expect(payButton()).toHaveAttribute('aria-busy', 'true')

    fake.publishOperation(processingOperation('op_card'))

    await waitFor(() => expect(footnote()).toHaveTextContent(PHASE_B))
  })

  it('re-opens an in-page challenge on a reload mid-challenge, and again from Complete verification', async () => {
    const fake = await renderCheckout({
      recover: {
        status: 'ok',
        value: challengedOperation('op_reload', 'required')
      }
    })

    await waitFor(() => expect(footnote()).toHaveTextContent(PHASE_A))
    await waitFor(() =>
      expect(fake.reportChallengeStarted).toHaveBeenCalledExactlyOnceWith(
        'op_reload'
      )
    )
    expect(
      screen.queryByRole('button', { name: 'Back' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel payment' })).toBeEnabled()
    await capturePromisesFlushed()
    fake.reportChallengeStarted.mockClear()
    fake.reportChallengeSettled.mockClear()

    await userEvent.click(
      screen.getByRole('button', { name: 'Complete verification' })
    )

    expect(fake.reportChallengeStarted).toHaveBeenCalledExactlyOnceWith(
      'op_reload'
    )
    await waitFor(() =>
      expect(fake.reportChallengeSettled).toHaveBeenCalledExactlyOnceWith(
        'op_reload',
        'completed'
      )
    )
    expect(fake.subscribe).not.toHaveBeenCalled()
  })

  it('keeps Complete verification hidden while a reload re-opens the challenge on its own, over the locked form', async () => {
    let answer: (leavesPage: boolean) => void = () => {}
    nextStep.leavesPage = new Promise((resolve) => {
      answer = resolve
    })
    const fake = await renderCheckout({
      recover: {
        status: 'ok',
        value: challengedOperation('op_reload', 'required')
      }
    })
    await waitFor(() => expect(nextStep.asked).toBe(1))
    await waitFor(() => expect(form.locked()).toBe(true))

    expect(footnote()).toHaveTextContent(PHASE_A)
    expect(screen.getByTestId('checkout-waiting')).not.toHaveAttribute(
      'aria-busy'
    )
    expect(payButton()).toHaveAttribute('aria-busy', 'true')
    expect(
      screen.queryByRole('button', { name: 'Complete verification' })
    ).not.toBeInTheDocument()

    answer(false)

    await waitFor(() =>
      expect(fake.reportChallengeStarted).toHaveBeenCalledExactlyOnceWith(
        'op_reload'
      )
    )
  })

  it('keeps the phase and Complete verification for a reload mid-challenge when the card form cannot load, with no saved method', async () => {
    stripeKey.value = undefined
    try {
      const fake = await renderCheckout({
        recover: {
          status: 'ok',
          value: challengedOperation('op_reload', 'required')
        }
      })
      await waitFor(() =>
        expect(fake.reportChallengeStarted).toHaveBeenCalledOnce()
      )
      await capturePromisesFlushed()

      expect(footnote()).toHaveTextContent(PHASE_A)
      expect(
        screen.getByRole('button', { name: 'Complete verification' })
      ).toBeInTheDocument()
      expect(
        screen.queryByText("The payment form couldn't load")
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Try again' })
      ).not.toBeInTheDocument()
    } finally {
      stripeKey.value = 'pk_test_example'
    }
  })

  it("keeps the phase over a failed Add new tab when another tab's payment is in flight", async () => {
    const fake = await renderQuoted({
      paymentMethods: { status: 'ok', value: [VISA] }
    })
    reportPhase({
      phase: 'payment_element_failed',
      element: 'payment',
      element_phase: 'mount'
    })
    await userEvent.click(tab('Add new payment'))

    fake.publishOperation(processingOperation('op_sibling'))
    await waitingStatus()

    expect(footnote()).toHaveTextContent(PHASE_B)
    expect(payButton()).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Try again' })
    ).not.toBeInTheDocument()
  })

  it('marks only the skeleton blocks busy while the quote loads, so the phase line is still announced', async () => {
    await renderCheckout(
      {
        recover: {
          status: 'ok',
          value: challengedOperation('op_reload', 'required')
        }
      },
      (fake) =>
        fake.previewSubscribe.mockImplementation(() => new Promise(() => {}))
    )
    await waitFor(() => expect(footnote()).toHaveTextContent(PHASE_A))

    const blocks = screen.getAllByTestId('checkout-skeleton')
    expect(blocks).toHaveLength(2)
    for (const block of blocks) {
      expect(block).toHaveAttribute('aria-busy', 'true')
      expect(block).not.toContainElement(footnote())
    }
    expect(screen.getByTestId('checkout-waiting')).not.toHaveAttribute(
      'aria-busy'
    )
  })

  it('loads afresh when restored from the back-forward cache after an Alipay Pay left, since its challenge froze with the page', async () => {
    const reload = vi
      .spyOn(window.location, 'reload')
      .mockImplementation(() => {})
    const fake = await payHeld('alipay')
    fake.publishOperation(challengedOperation('op_3ds', 'in_progress'))
    await waitFor(() => expect(footnote()).toHaveTextContent(ALIPAY))

    window.dispatchEvent(pageShow(true))

    expect(reload).toHaveBeenCalledOnce()
    expect(fake.recover).toHaveBeenCalledOnce()
  })

  it.for<{
    name: string
    operation: PendingBillingOperation
    opens: 'challenge' | 'page'
  }>([
    {
      name: 'a challenge Stripe finishes on another site, such as Alipay',
      operation: challengedOperation('op_away', 'required'),
      opens: 'challenge'
    },
    {
      name: "a bank's hosted page",
      operation: {
        ...hostedPendingOperation('https://pay.test/3ds', 'op_away'),
        authenticationState: 'requires_action'
      },
      opens: 'page'
    }
  ])(
    'never sends a customer back to $name on arrival: Complete verification does, on a click',
    async ({ operation, opens }) => {
      nextStep.leavesPage = true
      const assign = vi
        .spyOn(window.location, 'assign')
        .mockImplementation(() => {})
      const fake = await renderCheckout({
        recover: { status: 'ok', value: operation }
      })

      await waitFor(() => expect(form.locked()).toBe(true))
      await capturePromisesFlushed()
      expect(footnote()).toHaveTextContent(PHASE_A)
      expect(fake.reportChallengeStarted).not.toHaveBeenCalled()
      expect(assign).not.toHaveBeenCalled()

      await userEvent.click(
        screen.getByRole('button', { name: 'Complete verification' })
      )

      if (opens === 'challenge')
        expect(fake.reportChallengeStarted).toHaveBeenCalledExactlyOnceWith(
          'op_away'
        )
      else
        expect(assign).toHaveBeenCalledExactlyOnceWith('https://pay.test/3ds')
      expect(fake.subscribe).not.toHaveBeenCalled()
    }
  )

  it('opens nothing when reconciliation replaces the challenge while Stripe is still saying where it runs', async () => {
    let answer: (leavesPage: boolean) => void = () => {}
    nextStep.leavesPage = new Promise((resolve) => {
      answer = resolve
    })
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    const fake = await renderCheckout({
      recover: {
        status: 'ok',
        value: challengedOperation('op_embedded', 'required')
      }
    })
    await waitFor(() => expect(nextStep.asked).toBe(1))

    const hosted: PendingBillingOperation = {
      ...hostedPendingOperation('https://pay.test/3ds', 'op_hosted'),
      authenticationState: 'requires_action'
    }
    fake.recover.mockImplementationOnce(async () => {
      fake.publishOperation(hosted)
      return { status: 'ok', value: hosted }
    })
    siblings.nudge({
      workspaceId: 'ws-team',
      operationId: 'op_hosted',
      kind: 'started'
    })
    await waitFor(() => expect(fake.recover).toHaveBeenCalledTimes(2))
    await capturePromisesFlushed()

    answer(false)
    await capturePromisesFlushed()

    expect(assign).not.toHaveBeenCalled()
    expect(fake.reportChallengeStarted).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Complete verification' })
    ).toBeInTheDocument()
  })

  it('returns a challenge to this checkout, not the result page', async () => {
    const fake = await payHeld()

    const request = fake.subscribe.mock.calls[0][0]
    expect(request.return_url).toContain('/v1/checkout')
    expect(request.return_url).not.toContain('/v1/result')
  })
})

const LAUNCH20_QUOTE = previewOf({
  quote_id: 'q_promo',
  amount_due_cents: 2240,
  promotion_code: 'LAUNCH20',
  discounts: [{ kind: 'promotion', code: 'LAUNCH20', amount_off_cents: 560 }]
})

function refusedWith(serverCode: string): PreviewSubscribeResult {
  return {
    status: 'error',
    code: 'REQUEST_FAILED',
    httpStatus: 400,
    serverCode: readBillingErrorCode({ code: serverCode, message: 'refused' })
  }
}

/** Answers a quote by the code it was asked for: none, LAUNCH20, or anything else. */
function quotesByCode(
  fake: FakeBillingClient,
  launch20: PreviewSubscribeResult = { status: 'ok', value: LAUNCH20_QUOTE }
) {
  fake.previewSubscribe.mockImplementation(async ({ promotionCode }) => {
    if (promotionCode === undefined)
      return { status: 'ok', value: previewOf({ quote_id: 'q_1' }) }
    return promotionCode.toUpperCase() === 'LAUNCH20'
      ? launch20
      : refusedWith('PROMOTION_CODE_INVALID')
  })
}

const promoField = () => screen.getByRole('textbox', { name: 'Promo code' })
const orderSummary = () => screen.getByRole('region', { name: 'Order summary' })

async function enterCode(code: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Add promo code' }))
  await userEvent.type(promoField(), code)
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
}

describe('FullPageCheckoutView promo codes', () => {
  beforeEach(() => {
    form.mounts = 0
  })

  it('applies a code: its row, its removable chip, the new total, and Pay binds the code', async () => {
    const fake = await renderCheckout({}, quotesByCode)
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })

    await enterCode('launch20')

    expect(await screen.findByText('Promo code')).toBeInTheDocument()
    expect(screen.getByText('−$5.60')).toBeInTheDocument()
    expect(screen.getAllByText('$22.40')).toHaveLength(2)
    expect(
      screen.getByRole('button', { name: 'Remove LAUNCH20' })
    ).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Add promo code' })
    ).not.toBeInTheDocument()
    expect(fake.previewSubscribe).toHaveBeenLastCalledWith(
      expect.objectContaining({ promotionCode: 'launch20' }),
      expect.anything()
    )

    await waitFor(() => expect(payButton()).toBeEnabled())
    form.emit('confirm', 'ctoken_1')
    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          promotion_code: 'LAUNCH20',
          quote_id: 'q_promo'
        })
      )
    )
  })

  it('removing the chip re-quotes without the code', async () => {
    const fake = await renderCheckout({}, quotesByCode)
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    await enterCode('LAUNCH20')
    await screen.findByText('−$5.60')

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove LAUNCH20' })
    )

    expect(
      await screen.findByRole('button', { name: 'Add promo code' })
    ).toBeInTheDocument()
    expect(screen.queryByText('−$5.60')).not.toBeInTheDocument()
    expect(screen.getAllByText('$28.00')).toHaveLength(2)
    expect(fake.previewSubscribe).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ promotionCode: expect.anything() }),
      expect.anything()
    )
  })

  it('says an invalid code under the field, keeps it typed, and leaves the total alone', async () => {
    await renderCheckout({}, quotesByCode)
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    await enterCode('NOPE')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This code isn't valid."
    )
    expect(promoField()).toHaveValue('NOPE')
    expect(promoField()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByText('$28.00')).toHaveLength(2)
    expect(screen.queryByText('Promo code')).not.toBeInTheDocument()
  })

  it('prefills a code from the URL without pricing it until Apply', async () => {
    const fake = await renderCheckout(
      {},
      quotesByCode,
      `${CHECKOUT_PATH}&promo=LAUNCH20`
    )
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    expect(promoField()).toHaveValue('LAUNCH20')
    expect(screen.getAllByText('$28.00')).toHaveLength(2)
    expect(fake.previewSubscribe).toHaveBeenCalledOnce()
    expect(fake.previewSubscribe).toHaveBeenCalledWith(
      expect.not.objectContaining({ promotionCode: expect.anything() }),
      expect.anything()
    )

    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByText('−$5.60')).toBeInTheDocument()
  })

  it('a Pay over a typed, unapplied code applies it and waits for a second Pay at the new total', async () => {
    const fake = await renderCheckout(
      {},
      quotesByCode,
      `${CHECKOUT_PATH}&promo=LAUNCH20`
    )
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    await waitFor(() => expect(payButton()).toBeEnabled())

    form.emit('confirm', 'ctoken_1')

    expect(await screen.findByText('−$5.60')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Remove LAUNCH20' })
    ).toBeEnabled()
    expect(fake.subscribe).not.toHaveBeenCalled()

    await waitFor(() => expect(payButton()).toBeEnabled())
    form.emit('confirm', 'ctoken_2')
    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          promotion_code: 'LAUNCH20',
          quote_id: 'q_promo'
        })
      )
    )
  })

  it('a Pay over a code Apply already refused pays without it', async () => {
    const fake = await renderCheckout({}, quotesByCode)
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    await enterCode('NOPE')
    await screen.findByRole('alert')
    await waitFor(() => expect(payButton()).toBeEnabled())

    form.emit('confirm', 'ctoken_1')

    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledExactlyOnceWith(
        expect.not.objectContaining({ promotion_code: expect.anything() })
      )
    )
  })

  it('opens a URL code it cannot read as refused under the field, and still loads the checkout', async () => {
    const fake = await renderCheckout(
      {},
      quotesByCode,
      `${CHECKOUT_PATH}&promo=SAVE%2020`
    )

    expect(
      await screen.findByText('Subscribe to Creator Plan · Acme Team')
    ).toBeInTheDocument()
    expect(promoField()).toHaveValue('SAVE 20')
    expect(promoField()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent(
      "This code isn't valid."
    )
    expect(fake.previewSubscribe).toHaveBeenCalledExactlyOnceWith(
      expect.not.objectContaining({ promotionCode: expect.anything() }),
      expect.anything()
    )
  })

  it('lets the URL prefill be removed before it is applied', async () => {
    await renderCheckout({}, quotesByCode, `${CHECKOUT_PATH}&promo=LAUNCH20`)
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    await userEvent.click(
      screen.getByRole('button', { name: 'Close promo code' })
    )

    expect(
      screen.getByRole('button', { name: 'Add promo code' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: 'Promo code' })
    ).not.toBeInTheDocument()
  })

  it('a code that lapsed before Pay: back to capture, chip gone, the expired card instead of a decline', async () => {
    const fake = await renderCheckout(
      {
        subscribe: { status: 'error', code: 'QUOTE_STALE' }
      },
      quotesByCode
    )
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    await enterCode('LAUNCH20')
    await screen.findByText('−$5.60')
    quotesByCode(fake, refusedWith('PROMOTION_CODE_INVALID'))

    form.emit('confirm', 'ctoken_1')

    const card = await screen.findByRole('alert')
    expect(card).toHaveTextContent('Your promo code expired')
    expect(card).toHaveTextContent(
      'The LAUNCH20 code expired, so the total was updated. Review the new total before paying. You have not been charged.'
    )
    expect(card).not.toHaveTextContent('declined')
    expect(
      screen.queryByRole('button', { name: 'Remove LAUNCH20' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add promo code' })).toBeEnabled()
    expect(screen.getAllByText('$28.00')).toHaveLength(2)
    expect(payButton()).toBeEnabled()
    expect(
      screen.queryByRole('link', { name: 'Contact support' })
    ).not.toBeInTheDocument()
  })

  it('locks promo entry from the Pay click until the attempt resolves', async () => {
    let settle: () => void = () => {}
    const fake = await renderCheckout({}, (scripted) => {
      quotesByCode(scripted)
      scripted.subscribe.mockImplementation(
        () =>
          new Promise((resolve) => {
            settle = () =>
              resolve({
                status: 'ok',
                value: {
                  phase: 'failed',
                  operation: failedOperation('card_declined')
                }
              })
          })
      )
    })
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    await waitFor(() => expect(payButton()).toBeEnabled())

    form.emit('confirm', 'ctoken_1')

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce())
    expect(
      screen.getByRole('button', { name: 'Add promo code' })
    ).toBeDisabled()

    settle()

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add promo code' })
      ).toBeEnabled()
    )
  })

  it('holds Pay while a code is being priced, so the old total cannot be charged', async () => {
    let answer: (result: PreviewSubscribeResult) => void = () => {}
    const fake = await renderCheckout({}, quotesByCode)
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    await waitFor(() => expect(payButton()).toBeEnabled())
    fake.previewSubscribe.mockImplementationOnce(
      () => new Promise((resolve) => (answer = resolve))
    )

    await enterCode('LAUNCH20')

    expect(payButton()).toBeDisabled()
    expect(orderSummary()).toHaveAttribute('aria-busy', 'true')
    answer({ status: 'ok', value: LAUNCH20_QUOTE })
    await waitFor(() => expect(payButton()).toBeEnabled())
    expect(orderSummary()).toHaveAttribute('aria-busy', 'false')
  })

  it('keeps an applied code through a fresh capture after money it was watching declined', async () => {
    const fake = await renderCheckout({}, quotesByCode)
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    await enterCode('LAUNCH20')
    await screen.findByText('−$5.60')
    fake.recover.mockImplementationOnce(async () => {
      fake.publishOperation(pendingOperation('op_watched'))
      return { status: 'ok', value: pendingOperation('op_watched') }
    })
    window.dispatchEvent(pageShow(true))
    await screen.findByTestId('checkout-waiting')

    fake.publishOperation(failedOperation('card_declined', 'op_watched'))

    await waitFor(() =>
      expect(screen.queryByTestId('checkout-waiting')).not.toBeInTheDocument()
    )
    await screen.findByRole('button', { name: 'Remove LAUNCH20' })
    expect(screen.queryByText('Payment declined')).not.toBeInTheDocument()
    expect(fake.previewSubscribe).toHaveBeenLastCalledWith(
      expect.objectContaining({ promotionCode: 'LAUNCH20' }),
      expect.anything()
    )
    expect(screen.getByText('−$5.60')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Remove LAUNCH20' })
    ).toBeEnabled()
  })

  it('a code that lapsed while the page re-read on its own: the expired card, not a silent price change', async () => {
    const fake = await renderCheckout({}, quotesByCode)
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    await enterCode('LAUNCH20')
    await screen.findByText('−$5.60')
    fake.recover.mockImplementationOnce(async () => ({
      status: 'ok',
      value: pendingOperation('op_watched')
    }))
    window.dispatchEvent(pageShow(true))
    await screen.findByTestId('checkout-waiting')
    quotesByCode(fake, refusedWith('PROMOTION_CODE_INVALID'))

    fake.recover.mockResolvedValueOnce({ status: 'ok', value: undefined })
    window.dispatchEvent(pageShow(true))

    const card = await screen.findByRole('alert')
    expect(card).toHaveTextContent('Your promo code expired')
    expect(card).toHaveTextContent(
      'The LAUNCH20 code expired, so the total was updated.'
    )
    expect(
      screen.queryByRole('button', { name: 'Remove LAUNCH20' })
    ).not.toBeInTheDocument()
    expect(screen.getAllByText('$28.00')).toHaveLength(2)
  })

  it('ignores a URL code on a change that charges nothing today, so the first Pay pays', async () => {
    const fake = await renderCheckout(
      {
        preview: {
          status: 'ok',
          value: previewOf({
            transition_type: 'downgrade',
            is_immediate: false
          })
        }
      },
      () => {},
      `${CHECKOUT_PATH}&promo=LAUNCH20`
    )
    await screen.findByText(/Switch to Creator Plan/)
    await waitFor(() => expect(payButton()).toBeEnabled())

    await userEvent.click(payButton())

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce())
    expect(fake.previewSubscribe).toHaveBeenCalledExactlyOnceWith(
      expect.not.objectContaining({ promotionCode: expect.anything() }),
      expect.anything()
    )
  })

  it('a Pay over a code it could not check tries Apply again, then waits for a second Pay', async () => {
    const fake = await renderCheckout({}, (scripted) =>
      quotesByCode(scripted, { status: 'error', code: 'REQUEST_FAILED' })
    )
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    await enterCode('LAUNCH20')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't check this code. Try again."
    )
    quotesByCode(fake)
    await waitFor(() => expect(payButton()).toBeEnabled())

    form.emit('confirm', 'ctoken_1')

    expect(await screen.findByText('−$5.60')).toBeInTheDocument()
    expect(fake.subscribe).not.toHaveBeenCalled()

    await waitFor(() => expect(payButton()).toBeEnabled())
    form.emit('confirm', 'ctoken_2')
    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          promotion_code: 'LAUNCH20',
          quote_id: 'q_promo'
        })
      )
    )
  })

  it.for<{
    name: string
    applied: boolean
    change: () => Promise<void>
  }>([
    {
      name: 'applying a code',
      applied: false,
      change: () => enterCode('LAUNCH20')
    },
    {
      name: 'removing a code',
      applied: true,
      change: async () => {
        await userEvent.click(
          screen.getByRole('button', { name: 'Remove LAUNCH20' })
        )
        await screen.findByRole('button', { name: 'Add promo code' })
      }
    }
  ])(
    '553-9297: $name re-prices the plan, so the keep-subscription tick is asked again',
    async ({ applied, change }) => {
      const kept = { requires_reactivation_confirmation: true }
      const fake = await renderCheckout(
        {
          status: {
            is_active: true,
            has_funds: true,
            max_seats: 1,
            occupied_seats: 1,
            scheduled_change: null,
            team_credit_stop: null,
            cancel_at: '2026-07-28T00:00:00.000Z'
          }
        },
        (scripted) => {
          scripted.previewSubscribe.mockImplementation(
            async ({ promotionCode }) => ({
              status: 'ok',
              value:
                promotionCode === undefined
                  ? previewOf({ ...kept, transition_type: 'upgrade' })
                  : { ...LAUNCH20_QUOTE, ...kept, transition_type: 'upgrade' }
            })
          )
        }
      )
      await screen.findByText('Upgrade to Creator Plan · Acme Team')
      if (applied) {
        await enterCode('LAUNCH20')
        await screen.findByText('−$5.60')
      }
      await userEvent.click(
        screen.getByRole('checkbox', {
          name: 'Keep my subscription and renew it'
        })
      )

      await change()

      await waitFor(() =>
        expect(
          screen.getByRole('checkbox', {
            name: 'Keep my subscription and renew it'
          })
        ).not.toBeChecked()
      )
      await userEvent.click(payButton())
      expect(fake.subscribe).not.toHaveBeenCalled()
    }
  )

  it('offers no promo entry on a change that charges nothing today', async () => {
    await renderCheckout({
      preview: {
        status: 'ok',
        value: previewOf({ transition_type: 'downgrade', is_immediate: false })
      }
    })
    await screen.findByText(/Switch to Creator Plan/)

    expect(
      screen.queryByRole('button', { name: 'Add promo code' })
    ).not.toBeInTheDocument()
  })
})

describe('FullPageCheckoutView restoring a code this page applied', () => {
  beforeEach(() => {
    form.mounts = 0
  })

  async function applyThenReload(
    arrangeReload: (fake: FakeBillingClient) => void = quotesByCode,
    reloadPath = CHECKOUT_PATH
  ) {
    await renderCheckout({}, quotesByCode)
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    await enterCode('LAUNCH20')
    await screen.findByText('−$5.60')
    cleanup()
    return renderCheckout({}, arrangeReload, reloadPath)
  }

  it('comes back applied at the discounted price, quoted with the code', async () => {
    const fake = await applyThenReload()

    expect(await screen.findByText('−$5.60')).toBeInTheDocument()
    expect(screen.getAllByText('$22.40')).toHaveLength(2)
    expect(
      screen.getByRole('button', { name: 'Remove LAUNCH20' })
    ).toBeEnabled()
    expect(fake.previewSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ promotionCode: 'LAUNCH20' }),
      expect.anything()
    )
  })

  it('shows the expired card when the server refuses the restored code', async () => {
    await applyThenReload((fake) =>
      quotesByCode(fake, refusedWith('PROMOTION_CODE_INVALID'))
    )

    const card = await screen.findByRole('alert')
    expect(card).toHaveTextContent('Your promo code expired')
    expect(card).toHaveTextContent('The LAUNCH20 code expired')
    expect(screen.getAllByText('$28.00')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Add promo code' })).toBeEnabled()

    cleanup()
    const fake = await renderCheckout({}, quotesByCode)
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    expect(fake.previewSubscribe).toHaveBeenCalledExactlyOnceWith(
      expect.not.objectContaining({ promotionCode: expect.anything() }),
      expect.anything()
    )
  })

  it('restores nothing once the customer removed the code', async () => {
    await renderCheckout({}, quotesByCode)
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    await enterCode('LAUNCH20')
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove LAUNCH20' })
    )
    await screen.findByRole('button', { name: 'Add promo code' })
    cleanup()

    const fake = await renderCheckout({}, quotesByCode)
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    expect(fake.previewSubscribe).toHaveBeenCalledExactlyOnceWith(
      expect.not.objectContaining({ promotionCode: expect.anything() }),
      expect.anything()
    )
  })

  it('gives a checkout for another plan nothing', async () => {
    const fake = await applyThenReload(
      quotesByCode,
      CHECKOUT_PATH.replace('creator_monthly', 'pro_monthly')
    )
    await waitFor(() => expect(fake.previewSubscribe).toHaveBeenCalled())

    expect(fake.previewSubscribe).not.toHaveBeenCalledWith(
      expect.objectContaining({ promotionCode: expect.anything() }),
      expect.anything()
    )
  })

  it('restores nothing after the Pay goes through', async () => {
    await renderCheckout(
      {
        subscribe: {
          status: 'ok',
          value: {
            phase: 'succeeded',
            operation: succeededOperation('op_mine')
          }
        }
      },
      quotesByCode
    )
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    await enterCode('LAUNCH20')
    await screen.findByText('−$5.60')
    await waitFor(() => expect(payButton()).toBeEnabled())
    form.emit('confirm', 'ctoken_1')
    await screen.findByRole('heading', { name: "You're all set" })
    cleanup()

    const fake = await renderCheckout({}, quotesByCode)
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    expect(fake.previewSubscribe).toHaveBeenCalledExactlyOnceWith(
      expect.not.objectContaining({ promotionCode: expect.anything() }),
      expect.anything()
    )
  })

  it('never writes the applied code into the return URL', async () => {
    const fake = await renderCheckout({}, quotesByCode)
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    await enterCode('LAUNCH20')
    await screen.findByText('−$5.60')
    await waitFor(() => expect(payButton()).toBeEnabled())

    form.emit('confirm', 'ctoken_1')

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce())
    const [request] = fake.subscribe.mock.calls[0]
    expect(request.promotion_code).toBe('LAUNCH20')
    expect(request.return_url).not.toMatch(/LAUNCH20/i)
  })
})

/** What the facade sent to the RUM sink for one billing operation, in order. */
function reportedBillingEvents(operation: string) {
  return vi
    .mocked(datadogRum.addAction)
    .mock.calls.filter(([name]) => name.startsWith(`billing.${operation}.`))
    .map(([name, context]) => ({ name, context }))
}

describe('FullPageCheckoutView attempt telemetry', () => {
  const ATTEMPT = {
    operation: 'subscription_checkout',
    tier: 'creator',
    cycle: 'monthly',
    checkout_type: 'new',
    payment_intent_source: 'subscribe_now_button',
    checkout_ui: 'full_page',
    billing_client: 'sdk',
    billing_surface: 'billing_web'
  }

  const SETTLED: FakeBillingClientOptions['subscribe'] = {
    status: 'ok',
    value: {
      phase: 'succeeded',
      operation: succeededOperation('op_1'),
      issuedStatus: 'subscribed'
    }
  }

  const phaseOf = (stage: string, outcome: string) => ({
    ...ATTEMPT,
    stage,
    outcome
  })

  async function readyToPay(options: FakeBillingClientOptions) {
    const fake = await renderCheckout(
      options,
      undefined,
      `${CHECKOUT_PATH}&source=subscribe_now_button`
    )
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    await waitFor(() => expect(payButton()).toBeEnabled())
    return fake
  }

  beforeEach(() => {
    form.mounts = 0
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue({
      clientToken: 'pub',
      applicationId: 'app'
    })
  })

  it.for<{
    name: string
    subscribe: FakeBillingClientOptions['subscribe']
    terminal: Record<string, unknown>
  }>([
    {
      name: 'a payment the server settled',
      subscribe: SETTLED,
      terminal: {
        stage: 'succeeded',
        outcome: 'success',
        billing_op_id: 'op_1'
      }
    },
    {
      name: 'a decline',
      subscribe: {
        status: 'ok',
        value: {
          phase: 'failed',
          operation: failedOperation('insufficient_funds', 'op_declined')
        }
      },
      terminal: {
        stage: 'failed',
        outcome: 'failure',
        failure_category: 'provider_decline',
        decline_reason: 'insufficient_funds',
        billing_op_id: 'op_declined'
      }
    },
    {
      name: 'a server error before any operation exists',
      subscribe: { status: 'error', code: 'REQUEST_FAILED', httpStatus: 503 },
      terminal: {
        stage: 'failed',
        outcome: 'failure',
        failure_category: 'api_rejected'
      }
    }
  ])('reports $name as one intent, one start and one terminal', async (row) => {
    await readyToPay({ subscribe: row.subscribe })

    form.emit('confirm', 'ctoken_1')

    await waitFor(() =>
      expect(reportedBillingEvents('subscription_checkout')).toHaveLength(3)
    )
    expect(reportedBillingEvents('subscription_checkout')).toEqual([
      {
        name: 'billing.subscription_checkout.intent',
        context: phaseOf('intent', 'pending')
      },
      {
        name: 'billing.subscription_checkout.started',
        context: phaseOf('started', 'pending')
      },
      {
        name: `billing.subscription_checkout.${row.terminal.stage}`,
        context: {
          ...ATTEMPT,
          ...row.terminal,
          duration_ms: expect.any(Number)
        }
      }
    ])
  })

  it('reports no attempt for a payment this page only recovers', async () => {
    await renderCheckout({
      recover: { status: 'ok', value: succeededOperation('op_done') },
      preview: { status: 'ok', value: previewOf({ allowed: false }) }
    })

    await screen.findByRole('heading', { name: 'Already completed' })

    expect(reportedBillingEvents('subscription_checkout')).toEqual([])
  })

  it('starts a second attempt only after the first reached its terminal', async () => {
    const fake = await readyToPay({ subscribe: SETTLED })
    fake.subscribe.mockResolvedValueOnce({
      status: 'error',
      code: 'REQUEST_FAILED'
    })

    form.emit('confirm', 'ctoken_1')
    await screen.findByRole('alert')
    await waitFor(() => expect(payButton()).toBeEnabled())
    form.emit('confirm', 'ctoken_2')

    await waitFor(() =>
      expect(
        reportedBillingEvents('subscription_checkout').map(({ name }) => name)
      ).toEqual([
        'billing.subscription_checkout.intent',
        'billing.subscription_checkout.started',
        'billing.subscription_checkout.failed',
        'billing.subscription_checkout.intent',
        'billing.subscription_checkout.started',
        'billing.subscription_checkout.succeeded'
      ])
    )
  })
})
