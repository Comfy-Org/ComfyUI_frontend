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
      return_url: `${WORKSHOP_CLOUD_BASE_URL}/?settings=plan-credits`
    })
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
