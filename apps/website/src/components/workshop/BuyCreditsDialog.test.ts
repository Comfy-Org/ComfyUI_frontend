// @vitest-environment jsdom
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'
import { platformTopUpHref } from '../../lib/workshop/buy-credits'
import BuyCreditsDialog from './BuyCreditsDialog.vue'

const hoistedSession = vi.hoisted(() => ({
  session: undefined as { value: unknown } | undefined
}))

const credits = vi.hoisted(() => ({
  watchForTopUp: vi.fn(),
  clearTopUpWatch: vi.fn(),
  topUp: undefined as { value: unknown } | undefined
}))

vi.mock<unknown>(import('../../config/workshop-credits'), async () => {
  const { ref, computed } = await import('vue')
  const topUp = ref<unknown>({ status: 'idle' })
  credits.topUp = topUp
  return {
    watchForTopUp: credits.watchForTopUp,
    clearTopUpWatch: credits.clearTopUpWatch,
    useTopUpWatch: () => computed(() => topUp.value)
  }
})

vi.mock<unknown>(import('../../config/workshop-session-state'), async () => {
  const { ref } = await import('vue')
  const session = ref<unknown>(undefined)
  hoistedSession.session = session
  return { useWorkshopSession: () => ({ session }) }
})

const credential = {
  token: 'workspace-jwt',
  expiresAt: Number.MAX_SAFE_INTEGER,
  uid: 'user-1',
  workspace: { id: 'workspace-1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: []
}

function claimTab() {
  const tab = { location: { assign: vi.fn() }, close: vi.fn() }
  const open = vi
    .spyOn(window, 'open')
    .mockReturnValue(tab as unknown as Window)
  onTestFinished(() => {
    open.mockRestore()
    vi.unstubAllGlobals()
  })
  return tab
}

function renderOpenDialog() {
  return render(
    defineComponent({
      setup: () => () => h(BuyCreditsDialog, { open: true })
    })
  )
}

describe('BuyCreditsDialog', () => {
  beforeEach(() => {
    hoistedSession.session!.value = credential
    credits.topUp!.value = { status: 'idle' }
    credits.watchForTopUp.mockReset()
    credits.clearTopUpWatch.mockReset()
  })

  it('walks waiting to the landed receipt and closes on Done', async () => {
    const user = userEvent.setup()
    renderOpenDialog()

    credits.topUp!.value = { status: 'waiting', previousCredits: 100 }
    expect(await screen.findByTestId('buy-credits-polling')).toBeTruthy()

    credits.topUp!.value = {
      status: 'landed',
      previousCredits: 100,
      newCredits: 5375
    }
    const done = await screen.findByTestId('buy-credits-done')
    expect(done.textContent).toContain('5,275 credits added')
    expect(screen.getByTestId('buy-credits-ledger').textContent).toContain(
      '5,375'
    )

    await user.click(screen.getByTestId('buy-credits-resume'))
    expect(credits.clearTopUpWatch).toHaveBeenCalled()
  })

  it('holds with a support handle when the credits never arrive', async () => {
    renderOpenDialog()

    credits.topUp!.value = { status: 'unresolved', previousCredits: 100 }

    expect(await screen.findByTestId('buy-credits-held')).toBeTruthy()
    expect(
      screen.getByTestId('buy-credits-support').getAttribute('href')
    ).toBeTruthy()
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

  it('creates a checkout session for the picked amount and sends the buyer to it', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    const fetchCheckout = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ checkout_url: 'https://checkout.stripe.com/c/s_1' }),
          { status: 200 }
        )
      )
    vi.stubGlobal('fetch', fetchCheckout)
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-pack-50'))
    await user.click(screen.getByTestId('buy-credits-continue'))

    await vi.waitFor(() =>
      expect(tab.location.assign).toHaveBeenCalledWith(
        'https://checkout.stripe.com/c/s_1'
      )
    )
    const [target, init] = fetchCheckout.mock.calls[0] as [URL, RequestInit]
    expect(String(target)).toBe(
      `${WORKSHOP_CLOUD_BASE_URL}/api/billing/topup/checkout`
    )
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer workspace-jwt'
    })
    expect(JSON.parse(String(init.body))).toEqual({
      amount_cents: 5000,
      return_url: `${window.location.origin}/payment/success`
    })
    expect(credits.watchForTopUp).toHaveBeenCalled()
  })

  it('returns through Cloud while this origin is outside the allowlist', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    const fetchCheckout = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 400 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ checkout_url: 'https://checkout.stripe.com/c/s_2' }),
          { status: 200 }
        )
      )
    vi.stubGlobal('fetch', fetchCheckout)
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))

    await vi.waitFor(() =>
      expect(tab.location.assign).toHaveBeenCalledWith(
        'https://checkout.stripe.com/c/s_2'
      )
    )
    const retry = fetchCheckout.mock.calls[1] as [URL, RequestInit]
    expect(JSON.parse(String(retry[1].body))).toMatchObject({
      return_url: `${WORKSHOP_CLOUD_BASE_URL}/?settings=plan-credits`
    })
  })

  it('still reaches Stripe when the return host is rejected with a 404', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    const fetchCheckout = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ checkout_url: 'https://checkout.stripe.com/c/s_3' }),
          { status: 200 }
        )
      )
    vi.stubGlobal('fetch', fetchCheckout)
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))

    await vi.waitFor(() =>
      expect(tab.location.assign).toHaveBeenCalledWith(
        'https://checkout.stripe.com/c/s_3'
      )
    )
  })

  it('falls back to the platform rail while the checkout flag is dark', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 404 }))
    )
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))

    await vi.waitFor(() =>
      expect(tab.location.assign).toHaveBeenCalledWith(
        platformTopUpHref('workspace-1')
      )
    )
    expect(screen.queryByTestId('checkout-error')).toBeNull()
  })

  it('keeps the dialog open with a retry line when checkout errors', async () => {
    const user = userEvent.setup()
    const tab = claimTab()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 500 }))
    )
    renderOpenDialog()

    await user.click(await screen.findByTestId('buy-credits-continue'))

    await vi.waitFor(() =>
      expect(screen.getByTestId('checkout-error')).toBeTruthy()
    )
    expect(tab.close).toHaveBeenCalled()
  })
})
