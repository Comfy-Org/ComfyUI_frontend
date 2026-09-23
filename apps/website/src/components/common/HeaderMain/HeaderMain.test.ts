import { render, screen, waitFor, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, readonly, ref } from 'vue'

import { requestWorkshopBuyCredits } from '../../../config/workshop-buy-credits'
import {
  useWorkshopAuthFlag,
  useWorkshopEnabled
} from '../../../scripts/posthog'
import HeaderMain from './HeaderMain.vue'

vi.mock(import('../../../scripts/posthog'))

let flag = ref(false)
let visibility = ref(false)

function renderHeader(workshopInBuild = false) {
  return render(HeaderMain, {
    props: { workshopInBuild },
    global: {
      stubs: {
        HeaderAccount: defineComponent({
          render: () => h('div', { 'data-testid': 'header-account' })
        }),
        BuyCreditsDialog: defineComponent({
          props: { open: { type: Boolean, required: true } },
          setup: (props) => () =>
            props.open
              ? h('div', { 'data-testid': 'buy-credits-dialog' })
              : null
        })
      }
    }
  })
}

beforeEach(() => {
  flag = ref(false)
  visibility = ref(false)
  vi.mocked(useWorkshopAuthFlag).mockReturnValue(readonly(flag))
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(visibility))
})

describe('HeaderMain workshop gating', () => {
  it.for([
    { workshopInBuild: false, enabled: true, modelsAvailable: false },
    { workshopInBuild: true, enabled: false, modelsAvailable: false },
    { workshopInBuild: true, enabled: true, modelsAvailable: true }
  ])(
    'renders Models availability as $modelsAvailable when workshopInBuild is $workshopInBuild',
    async ({ workshopInBuild, enabled, modelsAvailable }) => {
      visibility.value = enabled
      renderHeader(workshopInBuild)
      await nextTick()

      expect(screen.queryByRole('link', { name: /^Models\b/i }) !== null).toBe(
        modelsAvailable
      )
    }
  )

  it('mounts no account island while the flag is off', () => {
    renderHeader()

    expect(screen.queryByTestId('header-account')).toBeNull()
  })

  it('mounts the account island when the flag turns on after mount', async () => {
    visibility.value = true
    renderHeader(true)
    expect(screen.queryByTestId('header-account')).toBeNull()

    flag.value = true

    await waitFor(() => {
      expect(
        screen.getAllByTestId('header-account').length,
        'a one-shot flag read at the header layer would strand every flag-on visitor signed out'
      ).toBeGreaterThan(0)
    })
  })

  it('mounts the account island in the mobile row as well as the desktop row', async () => {
    flag.value = true
    visibility.value = true
    renderHeader(true)

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
    flag.value = true
    visibility.value = true
    renderHeader(true)
    await waitFor(() =>
      expect(screen.getAllByTestId('header-account')).toHaveLength(2)
    )

    requestWorkshopBuyCredits()

    await waitFor(() =>
      expect(screen.getAllByTestId('buy-credits-dialog')).toHaveLength(1)
    )
  })

  it('replays a request made before the header island mounts', async () => {
    flag.value = true
    visibility.value = true
    requestWorkshopBuyCredits()

    renderHeader(true)

    expect(await screen.findByTestId('buy-credits-dialog')).toBeTruthy()
  })

  it('does not latch requests while auth is disabled', async () => {
    visibility.value = true
    renderHeader(true)

    requestWorkshopBuyCredits()
    flag.value = true

    await waitFor(() =>
      expect(screen.getAllByTestId('header-account')).toHaveLength(2)
    )
    expect(screen.queryByTestId('buy-credits-dialog')).toBeNull()
  })

  it('keeps an active checkout mounted through a flag refresh', async () => {
    flag.value = true
    visibility.value = true
    renderHeader(true)
    requestWorkshopBuyCredits()
    expect(await screen.findByTestId('buy-credits-dialog')).toBeTruthy()

    flag.value = false
    await waitFor(() =>
      expect(screen.queryByTestId('header-account')).toBeNull()
    )
    expect(screen.getByTestId('buy-credits-dialog')).toBeTruthy()
    flag.value = true
    await waitFor(() =>
      expect(screen.getAllByTestId('header-account')).toHaveLength(2)
    )

    expect(screen.getByTestId('buy-credits-dialog')).toBeTruthy()
  })

  it('ignores credits requests while Models is hidden', async () => {
    flag.value = true
    renderHeader(true)
    await nextTick()

    requestWorkshopBuyCredits()
    await nextTick()
    expect(screen.queryByTestId('buy-credits-dialog')).toBeNull()

    visibility.value = true
    await waitFor(() =>
      expect(screen.getAllByTestId('header-account')).toHaveLength(2)
    )
    expect(screen.queryByTestId('buy-credits-dialog')).toBeNull()

    requestWorkshopBuyCredits()
    expect(await screen.findByTestId('buy-credits-dialog')).toBeTruthy()
  })

  it('updates navigation and removes the account controls when access is revoked', async () => {
    flag.value = true
    renderHeader(true)
    expect(screen.queryByRole('link', { name: /^Models\b/i })).toBeNull()
    expect(screen.queryByTestId('header-account')).toBeNull()

    visibility.value = true
    await screen.findByRole('link', { name: /^Models\b/i })
    visibility.value = false
    await nextTick()
    expect(screen.queryByRole('link', { name: /^Models\b/i })).toBeNull()
    expect(screen.queryByTestId('header-account')).toBeNull()
  })
})
