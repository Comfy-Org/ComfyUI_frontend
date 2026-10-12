import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'

import type { HostedTopupCheckoutResult } from '@comfyorg/account-core/billing'

import {
  WORKSHOP_CLOUD_BASE_URL,
  WORKSHOP_CREDITS_URL,
  WORKSHOP_SUBSCRIPTION_URL
} from '@/config/workshop-env'
import type { WorkshopBuyCreditsTrigger } from '@/config/workshop-buy-credits'
import {
  clearTopUpWatch,
  refreshWorkshopCredits,
  useTopUpWatch,
  useWorkshopCredits,
  watchForTopUp
} from '@/config/workshop-credits'
import { workshopTopupCommand } from '@/config/workshop-billing-sdk'
import { readBillingSdkTopupEnabled } from '@/config/workshop-features'
import { useWorkshopSession } from '@/config/workshop-session-state'
import { captureWorkshopEvent } from '@/scripts/posthog'
import BuyCreditsDialog from './BuyCreditsDialog.vue'

type WorkshopCreditsState = ReturnType<typeof useWorkshopCredits>
type WorkshopSessionState = ReturnType<typeof useWorkshopSession>
type WorkshopBalance = WorkshopCreditsState['balance']['value']
type TopUpWatch = ReturnType<typeof useTopUpWatch>['value']
type ActiveSession = WorkshopSessionState['session']['value']
type WorkshopUser = WorkshopSessionState['user']['value']
type WorkshopSessionFailure = WorkshopSessionState['sessionFailure']['value']

vi.mock(import('@/config/workshop-credits'))
vi.mock(import('@/config/workshop-billing-sdk'))
vi.mock(import('@/config/workshop-features'))
vi.mock(import('@/config/workshop-session-state'))
vi.mock(import('@/scripts/posthog'))

const auth = {
  user: ref<WorkshopUser>(null),
  session: ref<ActiveSession>(),
  sessionFailure: ref<WorkshopSessionFailure>()
}
const credits = {
  balance: ref<WorkshopBalance>({ status: 'unknown' }),
  topUp: ref<TopUpWatch>({ status: 'idle' })
}

const credential = {
  token: 'workspace-jwt',
  expiresAt: Number.MAX_SAFE_INTEGER,
  uid: 'user-1',
  workspace: { id: 'workspace-1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: []
} satisfies Exclude<ActiveSession, undefined>

const CHECKOUT_URL = `${WORKSHOP_CLOUD_BASE_URL}/api/billing/topup/checkout`

const attemptId = '00000000-0000-4000-8000-000000000001'
const topUpScope = {
  uid: 'user-1',
  workspaceId: 'workspace-1',
  workspaceName: 'Personal',
  previousCredits: 100
}

function claimTab() {
  const tab = {
    opener: window,
    location: { assign: vi.fn() },
    close: vi.fn()
  }
  const open = vi
    .spyOn(window, 'open')
    .mockReturnValue(tab as unknown as Window)
  onTestFinished(() => {
    open.mockRestore()
  })
  return tab
}

function returnFromCheckout(id: string = attemptId) {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: window.location.origin,
      data: { type: 'workshop-topup-return', attemptId: id }
    })
  )
}

function stubCheckout(
  body: unknown = {
    checkout_url: 'https://checkout.stripe.com/c/session_1',
    session_id: 'cs_1'
  },
  status = 200
) {
  respondToFetch({ method: 'POST', url: CHECKOUT_URL }, () =>
    Response.json(body, { status })
  )
}

function renderOpenDialog(locale: 'en' | 'zh-CN' = 'en') {
  return render(
    defineComponent({
      setup: () => () => h(BuyCreditsDialog, { open: true, locale })
    })
  )
}

function renderControlledDialog(trigger: WorkshopBuyCreditsTrigger = 'action') {
  const isOpen = ref(true)
  const view = render(
    defineComponent({
      setup: () => () =>
        h(BuyCreditsDialog, {
          open: isOpen.value,
          trigger,
          'onUpdate:open': (value: boolean) => {
            isOpen.value = value
          }
        })
    })
  )
  return { ...view, isOpen }
}

describe('BuyCreditsDialog', () => {
  beforeEach(() => {
    vi.mocked(useTopUpWatch).mockReturnValue(
      computed(() => credits.topUp.value)
    )
    const session = useWorkshopSession()
    session.user = computed(() => auth.user.value)
    session.session = computed(() => auth.session.value)
    session.sessionFailure = computed(() => auth.sessionFailure.value)
    const balance = useWorkshopCredits()
    balance.balance = computed(() => credits.balance.value)
    balance.session = session.session
    auth.user.value = null
    auth.sessionFailure.value = undefined
    auth.session.value = credential
    vi.mocked(useWorkshopSession().ensureFresh).mockResolvedValue({
      status: 'ok',
      session: credential
    })
    credits.balance.value = { status: 'ok', credits: 100 }
    credits.topUp.value = { status: 'idle' }
    vi.mocked(clearTopUpWatch).mockImplementation(() => {
      credits.topUp.value = { status: 'idle' }
    })
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(attemptId)
  })

  it('walks waiting to the landed receipt and closes on Done', async () => {
    const user = userEvent.setup()
    renderOpenDialog()

    credits.topUp.value = { status: 'waiting', ...topUpScope }
    expect(await screen.findByTestId('buy-credits-polling')).toBeTruthy()

    credits.topUp.value = {
      status: 'landed',
      ...topUpScope,
      newCredits: 5_375,
      landedAt: Date.now()
    }
    const done = await screen.findByTestId('buy-credits-done')
    expect(done.textContent).toContain('5,275 credits added')
    expect(screen.getByTestId('buy-credits-ledger').textContent).toContain(
      '5,375'
    )
    expect(screen.getByRole('dialog').textContent).toContain('Personal')

    await user.click(screen.getByTestId('buy-credits-resume'))
    expect(credits.topUp.value).toEqual({ status: 'idle' })
  })

  it('auto-closes an untouched payment receipt after 3.6 seconds', async () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const { isOpen } = renderControlledDialog()

    credits.topUp.value = {
      status: 'landed',
      ...topUpScope,
      newCredits: 5_375,
      landedAt: Date.now()
    }
    await nextTick()
    expect(screen.getByTestId('buy-credits-done')).toBeTruthy()

    await vi.advanceTimersByTimeAsync(3_000)
    expect(isOpen.value).toBe(true)
    await vi.advanceTimersByTimeAsync(600)

    expect(isOpen.value).toBe(false)
    expect(credits.topUp.value).toEqual({ status: 'idle' })
  })

  it('cancels receipt auto-close after dialog interaction', async () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { isOpen } = renderControlledDialog()
    credits.topUp.value = {
      status: 'landed',
      ...topUpScope,
      newCredits: 5_375,
      landedAt: Date.now()
    }
    await nextTick()

    await user.click(screen.getByTestId('buy-credits-ledger'))
    await vi.advanceTimersByTimeAsync(3_600)

    expect(isOpen.value).toBe(true)
    expect(credits.topUp.value.status).toBe('landed')
  })

  it('cancels receipt auto-close after keyboard interaction', async () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const { isOpen } = renderControlledDialog()
    credits.topUp.value = {
      status: 'landed',
      ...topUpScope,
      newCredits: 5_375,
      landedAt: Date.now()
    }
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    await vi.advanceTimersByTimeAsync(3_600)

    expect(isOpen.value).toBe(true)
    expect(credits.topUp.value.status).toBe('landed')
  })

  it('starts receipt auto-close only when the tab becomes visible', async () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    let hidden = true
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    const { isOpen } = renderControlledDialog()
    credits.topUp.value = {
      status: 'landed',
      ...topUpScope,
      newCredits: 5_375,
      landedAt: Date.now()
    }
    await nextTick()
    await vi.advanceTimersByTimeAsync(3_600)

    expect(isOpen.value).toBe(true)

    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(3_600)

    expect(isOpen.value).toBe(false)
  })

  it('acknowledges a displayed receipt when the dialog is dismissed', async () => {
    const user = userEvent.setup()
    const { isOpen } = renderControlledDialog()
    credits.topUp.value = {
      status: 'landed',
      ...topUpScope,
      newCredits: 5_375,
      landedAt: Date.now()
    }
    await screen.findByTestId('buy-credits-done')

    await user.click(screen.getByRole('button', { name: 'Close' }))

    await vi.waitFor(() => expect(isOpen.value).toBe(false))
    expect(credits.topUp.value).toEqual({ status: 'idle' })
    isOpen.value = true
    await nextTick()
    expect(screen.queryByTestId('buy-credits-done')).toBeNull()
    expect(screen.getByTestId('buy-credits-packs')).toBeTruthy()
  })

  it('describes an unresolved return without claiming payment succeeded', async () => {
    renderOpenDialog()

    credits.topUp.value = { status: 'unresolved', ...topUpScope }

    const held = await screen.findByTestId('buy-credits-held')
    expect(held.textContent).toContain('No new credits detected')
    expect(screen.getByRole('dialog').textContent).toContain(
      'The checkout was either cancelled'
    )
    expect(screen.getByRole('dialog').textContent).not.toContain(
      'Payment received'
    )
  })

  it('offers the packs and clamps the custom stepper', async () => {
    const user = userEvent.setup()
    renderOpenDialog()

    const pack25 = await screen.findByTestId('buy-credits-pack-25')
    expect(pack25.textContent).toContain('5,275')
    await user.click(screen.getByTestId('buy-credits-pack-10'))
    expect(screen.getByTestId('buy-credits-custom').textContent).toContain(
      '$10 · 2,110'
    )
    await user.click(screen.getByTestId('buy-credits-less'))
    expect(screen.getByTestId('buy-credits-custom').textContent).toContain(
      '$5 · 1,055'
    )
    expect(
      screen.getByTestId('buy-credits-less').hasAttribute('disabled')
    ).toBe(true)
  })

  it.for([
    {
      change: 'workspace',
      session: {
        ...credential,
        workspace: {
          ...credential.workspace,
          id: 'workspace-2',
          name: 'Team B'
        }
      }
    },
    {
      change: 'owner role',
      session: { ...credential, role: 'member' as const }
    }
  ])('closes before checkout when the $change changes', async ({ session }) => {
    const { isOpen } = renderControlledDialog()

    auth.session.value = session

    await vi.waitFor(() => expect(isOpen.value).toBe(false))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes a visible receipt when the account scope changes', async () => {
    const { isOpen } = renderControlledDialog()
    credits.topUp.value = { status: 'waiting', ...topUpScope }
    await screen.findByTestId('buy-credits-polling')

    auth.session.value = {
      ...credential,
      workspace: { ...credential.workspace, id: 'workspace-2', name: 'Team B' }
    }

    await vi.waitFor(() => expect(isOpen.value).toBe(false))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      credits.topUp.value,
      'the detached receipt watcher may still finish for its captured workspace'
    ).toEqual({ status: 'waiting', ...topUpScope })
  })

  it('closes an automatic request that has no owner session to buy for', async () => {
    auth.session.value = undefined

    const { isOpen } = renderControlledDialog('automatic')

    await vi.waitFor(() => expect(isOpen.value).toBe(false))
  })

  it('keeps an explicit request open until the session can check out', async () => {
    const user = userEvent.setup()
    claimTab()
    stubCheckout()
    auth.session.value = undefined
    const { isOpen } = renderControlledDialog('action')

    await user.click(await screen.findByTestId('buy-credits-continue'))

    expect(await screen.findByTestId('checkout-error')).toBeTruthy()
    expect(isOpen.value).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'checkout_failed',
      properties: { stage: 'no_owner_scope' }
    })

    auth.session.value = credential
    await nextTick()
    await user.click(screen.getByTestId('buy-credits-continue'))

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
  })

  it('keeps checkout running through a brief session gap', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    stubCheckout()
    let resolveCredential!: (
      value: Awaited<ReturnType<WorkshopSessionState['ensureFresh']>>
    ) => void
    vi.mocked(useWorkshopSession().ensureFresh).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCredential = resolve
        })
    )
    const { isOpen } = renderControlledDialog()
    await user.click(await screen.findByTestId('buy-credits-continue'))
    await vi.waitFor(() =>
      expect(useWorkshopSession().ensureFresh).toHaveBeenCalled()
    )

    auth.session.value = undefined
    await nextTick()

    expect(isOpen.value).toBe(true)
    expect(tab.close).not.toHaveBeenCalled()

    auth.session.value = credential
    resolveCredential({ status: 'ok', session: credential })

    await vi.waitFor(() => expect(tab.location.assign).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('closes when the session ends in a failure', async () => {
    const { isOpen } = renderControlledDialog()

    auth.session.value = undefined
    auth.sessionFailure.value = { status: 'error', code: 'ACCESS_DENIED' }

    await vi.waitFor(() => expect(isOpen.value).toBe(false))
  })

  it('links to the Cloud subscription plans', async () => {
    renderOpenDialog()

    const link = await screen.findByTestId('buy-credits-subscription')

    expect(link.getAttribute('href')).toBe(WORKSHOP_SUBSCRIPTION_URL)
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('locks and snapshots the selected amount while checkout is prepared', async () => {
    const user = userEvent.setup()
    claimTab()
    stubCheckout()
    let releaseRefresh: (() => void) | undefined
    vi.mocked(refreshWorkshopCredits).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseRefresh = resolve
        })
    )
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-pack-50'))
    await user.click(screen.getByTestId('buy-credits-continue'))
    await vi.waitFor(() =>
      expect(refreshWorkshopCredits).toHaveBeenCalledOnce()
    )

    const pack10 = screen.getByTestId('buy-credits-pack-10')
    expect(pack10).toBeDisabled()
    expect(screen.getByTestId('buy-credits-less')).toBeDisabled()
    expect(screen.getByTestId('buy-credits-more')).toBeDisabled()
    const fieldset = screen.getByTestId('buy-credits-controls')
    if (!(fieldset instanceof HTMLFieldSetElement))
      throw new Error('Expected amount controls inside a fieldset')
    // Bypass the UI lock to prove the request still uses the amount captured
    // before the asynchronous balance/session refresh.
    fieldset.disabled = false
    await user.click(pack10)
    expect(screen.getByTestId('buy-credits-custom').textContent).toContain(
      '$10 · 2,110'
    )
    releaseRefresh?.()

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    expect(
      JSON.parse(String(fetchRequests(CHECKOUT_URL)[0].body))
    ).toMatchObject({
      amount_cents: 5_000
    })
  })

  it('creates checkout with a fresh scoped token and a known balance baseline', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    stubCheckout()
    const rotated = {
      ...credential,
      token: 'fresh-workspace-jwt'
    }
    vi.mocked(refreshWorkshopCredits).mockImplementation(async () => {
      auth.session.value = rotated
    })
    vi.mocked(useWorkshopSession().ensureFresh).mockResolvedValue({
      status: 'ok',
      session: rotated
    })
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-pack-50'))
    await user.click(screen.getByTestId('buy-credits-continue'))

    expect(window.open).toHaveBeenCalledWith('/checkout-opening', '_blank')
    await vi.waitFor(() =>
      expect(tab.location.assign).toHaveBeenCalledWith(
        'https://checkout.stripe.com/c/session_1'
      )
    )
    expect(useWorkshopSession().ensureFresh).toHaveBeenCalledWith(undefined, {
      workspaceId: 'workspace-1',
      signal: expect.any(AbortSignal),
      timeoutMs: 15_000
    })
    expect(refreshWorkshopCredits).toHaveBeenCalledWith({
      force: true
    })
    expect(
      vi.mocked(refreshWorkshopCredits).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(useWorkshopSession().ensureFresh).mock.invocationCallOrder[0]
    )
    const [checkout] = fetchRequests(CHECKOUT_URL)
    expect(checkout.headers.get('Authorization')).toBe(
      'Bearer fresh-workspace-jwt'
    )
    const request = JSON.parse(String(checkout.body)) as Record<string, unknown>
    const returnUrl = new URL(String(request.return_url))
    expect(request).toMatchObject({
      amount_cents: 5_000,
      idempotency_key: attemptId
    })
    expect(returnUrl.toString()).toBe(
      new URL(
        `/checkout-return?workshopTopUpReturn=${attemptId}`,
        window.location.origin
      ).toString()
    )
    expect(watchForTopUp).not.toHaveBeenCalled()
    expect(await screen.findByTestId('buy-credits-open-checkout')).toBeTruthy()
  })

  it('starts confirmation only after the matching checkout returns', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    stubCheckout()
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))
    await vi.waitFor(() => expect(tab.location.assign).toHaveBeenCalledOnce())
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })

    await vi.advanceTimersByTimeAsync(120_000)
    returnFromCheckout('another-attempt')
    expect(watchForTopUp).not.toHaveBeenCalled()

    returnFromCheckout()
    expect(watchForTopUp).toHaveBeenCalledWith(topUpScope)
  })

  it('restores an outstanding checkout when the dialog reopens', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    stubCheckout()
    const { isOpen } = renderControlledDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))
    await vi.waitFor(() => expect(tab.location.assign).toHaveBeenCalledOnce())
    await user.click(screen.getByTestId('buy-credits-checkout-close'))
    await vi.waitFor(() => expect(isOpen.value).toBe(false))

    isOpen.value = true
    await nextTick()

    expect(await screen.findByTestId('buy-credits-open-checkout')).toBeTruthy()
    expect(screen.queryByTestId('buy-credits-packs')).toBeNull()
    expect(fetch).toHaveBeenCalledOnce()

    returnFromCheckout()
    expect(watchForTopUp).toHaveBeenCalledWith(topUpScope)
  })

  it('discards an outstanding checkout when the dialog reopens in another workspace', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    stubCheckout()
    const { isOpen } = renderControlledDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))
    await vi.waitFor(() => expect(tab.location.assign).toHaveBeenCalledOnce())
    await user.click(screen.getByTestId('buy-credits-checkout-close'))
    await vi.waitFor(() => expect(isOpen.value).toBe(false))

    const nextCredential = {
      ...credential,
      token: 'next-workspace-jwt',
      workspace: {
        ...credential.workspace,
        id: 'workspace-2',
        name: 'Team B'
      }
    }
    auth.session.value = nextCredential
    vi.mocked(useWorkshopSession().ensureFresh).mockResolvedValue({
      status: 'ok',
      session: nextCredential
    })
    await nextTick()
    isOpen.value = true
    await nextTick()

    expect(await screen.findByTestId('buy-credits-packs')).toBeTruthy()
    expect(screen.queryByTestId('buy-credits-open-checkout')).toBeNull()

    await user.click(screen.getByTestId('buy-credits-continue'))
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  })

  it('confirms a checkout that returns from another workspace once its workspace is current again', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    stubCheckout()
    const { isOpen } = renderControlledDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))
    await vi.waitFor(() => expect(tab.location.assign).toHaveBeenCalledOnce())
    await user.click(screen.getByTestId('buy-credits-checkout-close'))
    await vi.waitFor(() => expect(isOpen.value).toBe(false))

    auth.session.value = {
      ...credential,
      workspace: { ...credential.workspace, id: 'workspace-2', name: 'Team B' }
    }
    await nextTick()
    isOpen.value = true
    await nextTick()
    expect(await screen.findByTestId('buy-credits-packs')).toBeTruthy()

    returnFromCheckout()
    expect(watchForTopUp).not.toHaveBeenCalled()

    auth.session.value = credential
    await nextTick()

    expect(watchForTopUp).toHaveBeenCalledExactlyOnceWith(topUpScope)
  })

  it('opens the localized checkout handoff for Chinese', async () => {
    const user = userEvent.setup()
    claimTab()
    stubCheckout()
    renderOpenDialog('zh-CN')

    await user.click(await screen.findByTestId('buy-credits-continue'))

    expect(window.open).toHaveBeenCalledWith(
      '/zh-CN/checkout-opening',
      '_blank'
    )
  })

  it('keeps an explicit checkout link when the popup is blocked', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'open').mockReturnValue(null)
    stubCheckout()
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))

    const link = await screen.findByTestId('buy-credits-open-checkout')
    expect(link.getAttribute('href')).toBe(
      'https://checkout.stripe.com/c/session_1'
    )
    expect(link.getAttribute('rel')).toBe('opener')
    expect(watchForTopUp).not.toHaveBeenCalled()
  })

  it('uses the Cloud credits page only for an explicit rollout miss', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    stubCheckout({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))

    await vi.waitFor(() =>
      expect(tab.location.assign).toHaveBeenCalledWith(WORKSHOP_CREDITS_URL)
    )
    expect(screen.queryByTestId('checkout-error')).toBeNull()
    expect(watchForTopUp).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
  })

  it('keeps the rollout fallback link when the claimed tab cannot navigate', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    tab.location.assign.mockImplementation(() => {
      throw new Error('tab closed')
    })
    stubCheckout({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))

    const link = await screen.findByTestId('buy-credits-open-checkout')
    expect(link.getAttribute('href')).toBe(WORKSHOP_CREDITS_URL)
    expect(screen.queryByTestId('checkout-error')).toBeNull()
    expect(tab.close).toHaveBeenCalled()
  })

  it('does not treat an untyped 404 as a rollout miss', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    vi.mocked(fetch).mockImplementation(
      async () => new Response('', { status: 404 })
    )
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))

    expect(await screen.findByTestId('checkout-error')).toBeTruthy()
    expect(tab.close).toHaveBeenCalled()
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'checkout_failed',
      properties: {
        attempt_id: attemptId,
        user_id: credential.uid,
        workspace_id: credential.workspace.id,
        stage: 'checkout',
        http_status: 404
      }
    })
  })

  it('omits an HTTP status when the billing SDK received no response', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    vi.mocked(readBillingSdkTopupEnabled).mockResolvedValue(true)
    vi.mocked(
      workshopTopupCommand().createHostedTopupCheckout
    ).mockResolvedValue({
      status: 'error',
      code: 'REQUEST_FAILED'
    } satisfies HostedTopupCheckoutResult)
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))

    expect(await screen.findByTestId('checkout-error')).toBeTruthy()
    expect(tab.close).toHaveBeenCalled()
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'checkout_failed',
      properties: {
        attempt_id: attemptId,
        user_id: credential.uid,
        workspace_id: credential.workspace.id,
        stage: 'checkout',
        error_code: 'REQUEST_FAILED'
      }
    })
  })

  it('omits an unrecognized checkout error code from analytics', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    stubCheckout(
      { code: 'PRIVATE_CUSTOMER_STATE', message: 'Private account detail' },
      500
    )
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))

    expect(await screen.findByTestId('checkout-error')).toBeTruthy()
    expect(tab.close).toHaveBeenCalled()
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'checkout_failed',
      properties: {
        attempt_id: attemptId,
        user_id: credential.uid,
        workspace_id: credential.workspace.id,
        stage: 'checkout',
        http_status: 500
      }
    })
    expect(
      JSON.stringify(vi.mocked(captureWorkshopEvent).mock.calls)
    ).not.toContain('PRIVATE_CUSTOMER_STATE')
  })

  it('refuses checkout when the scoped balance is unavailable', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    stubCheckout()
    credits.balance.value = { status: 'error' }
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))

    expect(await screen.findByTestId('checkout-error')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
    expect(tab.close).toHaveBeenCalled()
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'checkout_failed',
      properties: {
        user_id: credential.uid,
        workspace_id: credential.workspace.id,
        stage: 'balance'
      }
    })
  })

  it('closes checkout if refreshing changes the signed-in identity', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    stubCheckout()
    vi.mocked(refreshWorkshopCredits).mockImplementation(async () => {
      auth.session.value = {
        ...credential,
        uid: 'user-2',
        token: 'other-token'
      }
    })
    const { isOpen } = renderControlledDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))

    await vi.waitFor(() => expect(isOpen.value).toBe(false))
    expect(screen.queryByTestId('checkout-error')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(tab.close).toHaveBeenCalled()
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
  })

  it('closes without reporting failure if the session changes while credentials are pending', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    stubCheckout()
    let resolveCredential!: (value: {
      status: 'ok'
      session: typeof credential
    }) => void
    vi.mocked(useWorkshopSession().ensureFresh).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCredential = resolve
        })
    )
    const { isOpen } = renderControlledDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))
    await vi.waitFor(() =>
      expect(useWorkshopSession().ensureFresh).toHaveBeenCalledOnce()
    )
    auth.session.value = {
      ...credential,
      workspace: { ...credential.workspace, id: 'workspace-2', name: 'Team B' }
    }
    resolveCredential({ status: 'ok', session: credential })

    await vi.waitFor(() => expect(isOpen.value).toBe(false))
    expect(screen.queryByTestId('checkout-error')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(tab.close).toHaveBeenCalled()
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
  })

  it('refuses checkout when the fresh credential belongs to another workspace', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    stubCheckout()
    vi.mocked(useWorkshopSession().ensureFresh).mockResolvedValue({
      status: 'ok',
      session: {
        ...credential,
        workspace: {
          ...credential.workspace,
          id: 'workspace-2',
          name: 'Team B'
        }
      }
    })
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))

    expect(await screen.findByTestId('checkout-error')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
    expect(tab.location.assign).not.toHaveBeenCalled()
    expect(tab.close).toHaveBeenCalled()
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'checkout_failed',
      properties: {
        user_id: credential.uid,
        workspace_id: credential.workspace.id,
        stage: 'credential'
      }
    })
  })

  it('closes without opening checkout if the session changes while checkout is pending', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    let resolveCheckout!: (response: Response) => void
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveCheckout = resolve
        })
    )
    const { isOpen } = renderControlledDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    auth.session.value = {
      ...credential,
      workspace: {
        ...credential.workspace,
        id: 'workspace-2',
        name: 'Team B'
      }
    }
    resolveCheckout(
      new Response(
        JSON.stringify({
          checkout_url: 'https://checkout.stripe.com/c/session_1',
          session_id: 'cs_1'
        }),
        { status: 200 }
      )
    )

    await vi.waitFor(() => expect(isOpen.value).toBe(false))
    expect(screen.queryByTestId('checkout-error')).toBeNull()
    expect(tab.location.assign).not.toHaveBeenCalled()
    expect(tab.close).toHaveBeenCalled()
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
  })

  it('aborts an in-flight checkout when the dialog unmounts', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    vi.mocked(useWorkshopSession().ensureFresh).mockImplementation(
      () => new Promise(() => {})
    )
    const view = renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))
    await vi.waitFor(() =>
      expect(useWorkshopSession().ensureFresh).toHaveBeenCalled()
    )

    view.unmount()

    expect(useWorkshopSession().ensureFresh).toHaveBeenCalledWith(undefined, {
      workspaceId: 'workspace-1',
      signal: expect.objectContaining({ aborted: true }),
      timeoutMs: 15_000
    })
    expect(tab.close).toHaveBeenCalled()
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
  })
})
