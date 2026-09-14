// @vitest-environment happy-dom
import { render, screen, waitFor, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { requestWorkshopBuyCredits } from '../../../config/workshop-buy-credits'
import HeaderMain from './HeaderMain.vue'

const hoisted = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  announceReturn: vi.fn()
}))

vi.mock(import('../../../scripts/posthog.ts'), async () => {
  const { ref } = await import('vue')
  const flag = ref(false)
  hoisted.flag = flag
  return { useWorkshopAuthFlag: () => flag }
})

vi.mock(import('../../../lib/workshop/topup-return.ts'), () => ({
  announceTopUpReturnFromLocation: hoisted.announceReturn
}))

vi.mock<unknown>(import('../../workshop/HeaderAccount.vue'), async () => {
  const { defineComponent, h } = await import('vue')
  return {
    __esModule: true,
    default: defineComponent({
      name: 'HeaderAccountStub',
      render: () => h('div', { 'data-testid': 'header-account' })
    })
  }
})

vi.mock<unknown>(import('../../workshop/BuyCreditsDialog.vue'), async () => {
  const { defineComponent, h } = await import('vue')
  return {
    __esModule: true,
    default: defineComponent({
      name: 'BuyCreditsDialogStub',
      props: { open: { type: Boolean, required: true } },
      setup: (props) => () =>
        props.open ? h('div', { 'data-testid': 'buy-credits-dialog' }) : null
    })
  }
})

beforeEach(() => {
  hoisted.flag!.value = false
  hoisted.announceReturn.mockReset()
})

describe('HeaderMain workshop gating', () => {
  it.for([
    { workshopInBuild: false, modelsAvailable: false },
    { workshopInBuild: true, modelsAvailable: true }
  ])(
    'renders Models availability as $modelsAvailable when workshopInBuild is $workshopInBuild',
    ({ workshopInBuild, modelsAvailable }) => {
      render(HeaderMain, { props: { workshopInBuild } })

      expect(screen.queryByRole('link', { name: /^Models\b/i }) !== null).toBe(
        modelsAvailable
      )
    }
  )

  it('mounts no account island while the flag is off', () => {
    render(HeaderMain)

    expect(screen.queryByTestId('header-account')).toBeNull()
  })

  it('relays a top-up return before the auth flag settles', () => {
    render(HeaderMain)

    expect(hoisted.announceReturn).toHaveBeenCalledOnce()
    expect(screen.queryByTestId('buy-credits-dialog')).toBeNull()
  })

  it('mounts the account island when the flag turns on after mount', async () => {
    render(HeaderMain)
    expect(screen.queryByTestId('header-account')).toBeNull()

    hoisted.flag!.value = true

    await waitFor(() => {
      expect(
        screen.getAllByTestId('header-account').length,
        'a one-shot flag read at the header layer would strand every flag-on visitor signed out'
      ).toBeGreaterThan(0)
    })
  })

  it('mounts the account island in the mobile row as well as the desktop row', async () => {
    hoisted.flag!.value = true
    render(HeaderMain)

    await waitFor(() => {
      expect(
        within(screen.getByTestId('mobile-nav-cta')).getByTestId(
          'header-account'
        ),
        'the desktop row is hidden below lg, so a phone would have no sign-in, account, or sign-out'
      ).toBeTruthy()
    })
    expect(
      within(screen.getByTestId('desktop-nav-cta')).getByTestId(
        'header-account'
      )
    ).toBeTruthy()
  })

  it('owns one credits dialog for both account placements and page requests', async () => {
    hoisted.flag!.value = true
    render(HeaderMain)
    await waitFor(() =>
      expect(screen.getAllByTestId('header-account')).toHaveLength(2)
    )

    requestWorkshopBuyCredits()

    await waitFor(() =>
      expect(screen.getAllByTestId('buy-credits-dialog')).toHaveLength(1)
    )
  })

  it('replays a request made before the header island mounts', async () => {
    hoisted.flag!.value = true
    requestWorkshopBuyCredits()

    render(HeaderMain)

    expect(await screen.findByTestId('buy-credits-dialog')).toBeTruthy()
  })

  it('does not latch requests while auth is disabled', async () => {
    render(HeaderMain)

    requestWorkshopBuyCredits()
    hoisted.flag!.value = true

    await waitFor(() =>
      expect(screen.getAllByTestId('header-account')).toHaveLength(2)
    )
    expect(screen.queryByTestId('buy-credits-dialog')).toBeNull()
  })

  it('keeps an active checkout mounted through a flag refresh', async () => {
    hoisted.flag!.value = true
    render(HeaderMain)
    requestWorkshopBuyCredits()
    expect(await screen.findByTestId('buy-credits-dialog')).toBeTruthy()

    hoisted.flag!.value = false
    await waitFor(() =>
      expect(screen.queryByTestId('header-account')).toBeNull()
    )
    expect(screen.getByTestId('buy-credits-dialog')).toBeTruthy()
    hoisted.flag!.value = true
    await waitFor(() =>
      expect(screen.getAllByTestId('header-account')).toHaveLength(2)
    )

    expect(screen.getByTestId('buy-credits-dialog')).toBeTruthy()
  })
})
