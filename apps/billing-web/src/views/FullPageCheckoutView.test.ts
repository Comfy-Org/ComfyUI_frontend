import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { nextTick, ref } from 'vue'

import type { PreviewSubscribeResult } from '@comfyorg/account-core/billing'
import type { AccountCredential } from '@comfyorg/account-core/session'
import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import type { StripePaymentPhase } from '@comfyorg/account-ui/billing/stripe'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import type {
  FakeBillingClient,
  FakeBillingClientOptions
} from '@/test/fakeBillingClient'
import {
  createFakeBillingClient,
  pendingOperation,
  previewOf
} from '@/test/fakeBillingClient'
import FullPageCheckoutView from '@/views/FullPageCheckoutView.vue'

const CHECKOUT_PATH =
  '/v1/checkout?product=comfyui&return_to=comfyui_workspace&plan=creator_monthly'

vi.mock<unknown>(import('@/config/env'), () => ({
  BILLING_WEB_ENV: 'test',
  CLOUD_BASE_URL: 'https://testcloud.comfy.org'
}))

vi.mock(import('@/config/stripeKey'), () => ({
  awaitBillingWebStripeKey: () => Promise.resolve('pk_test_example'),
  useBillingWebStripeKey: () => ref('pk_test_example')
}))

vi.mock(import('@/session/stripeChallengePort'), () => ({
  createDeferredStripeChallengePort: () => ({
    handleNextAction: async () => ({})
  })
}))

vi.mock(import('@/entry/workspaceBinding'), () => ({
  boundWorkspaceId: () => undefined,
  bindEntryWorkspace: () => false
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
  emit: (() => {}) as (event: string, payload: unknown) => void
}))

vi.mock<unknown>(import('@comfyorg/account-ui/billing/stripe'), () => ({
  StripePaymentForm: {
    name: 'StripePaymentForm',
    props: {
      canSubmit: { type: Boolean, default: true },
      isLoading: { type: Boolean, default: false }
    },
    emits: ['confirm', 'phase'],
    setup(
      props: { canSubmit: boolean; isLoading: boolean },
      {
        emit,
        slots
      }: {
        emit: (event: string, payload: unknown) => void
        slots: { submit?: (slotProps: Record<string, unknown>) => unknown }
      }
    ) {
      form.mounts += 1
      form.emit = emit
      return () =>
        slots.submit?.({ disabled: !props.canSubmit, loading: props.isLoading })
    }
  }
}))

function reportPhase(phase: StripePaymentPhase) {
  form.emit('phase', phase)
}

async function renderCheckout(
  options: FakeBillingClientOptions = {},
  arrange: (fake: FakeBillingClient) => void = () => {}
) {
  recordBillingEntry(parseBillingEntry(CHECKOUT_PATH))
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
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    expect(form.mounts).toBe(0)
    await userEvent.click(payButton())

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce())
    expect(fake.subscribe.mock.calls[0][0]).not.toHaveProperty(
      'confirmation_token'
    )
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

  it('keeps Pay disabled for a quote the server does not allow', async () => {
    await renderCheckout({
      preview: { status: 'ok', value: previewOf({ allowed: false }) }
    })
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    await nextTick()

    expect(payButton()).toBeDisabled()
  })

  it('locks Pay once an operation is in flight, so a second click cannot charge twice', async () => {
    const fake = await renderCheckout({
      preview: {
        status: 'ok',
        value: previewOf({ transition_type: 'upgrade' })
      }
    })
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    expect(payButton()).toBeEnabled()

    fake.publishOperation(pendingOperation())

    await waitFor(() => expect(payButton()).toBeDisabled())
  })

  it.for<{
    name: string
    options: FakeBillingClientOptions
    arrange: (fake: FakeBillingClient) => void
  }>([
    {
      name: 'the capabilities read',
      options: {},
      arrange: (fake) =>
        fake.readCapabilities.mockResolvedValue({
          status: 'error',
          code: 'REQUEST_FAILED'
        })
    },
    {
      name: 'the quote',
      options: { preview: { status: 'error', code: 'REQUEST_FAILED' } },
      arrange: () => {}
    }
  ])(
    'says so instead of capture when $name fails',
    async ({ options, arrange }) => {
      await renderCheckout(options, arrange)

      expect(
        await screen.findByText(
          "We couldn't reach the billing service. Please try again."
        )
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Pay and subscribe' })
      ).not.toBeInTheDocument()
    }
  )

  it('renders the refusal instead of capture when the capability is denied', async () => {
    await renderCheckout({ capabilities: {} })

    expect(
      await screen.findByRole('heading', {
        name: "You can't subscribe from this account"
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Pay and subscribe' })
    ).not.toBeInTheDocument()
    expect(form.mounts).toBe(0)
  })
})
