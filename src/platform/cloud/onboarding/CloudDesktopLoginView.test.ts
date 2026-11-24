import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import enMessages from '@/locales/en/main.json'
import {
  claimDesktopLoginRedemptionStatus,
  desktopLoginRedemptionStatus,
  hasPendingDesktopLoginCode,
  restoreShownDesktopLoginRedemptionStatus
} from '@/platform/cloud/onboarding/desktopLoginRedemption'

import CloudDesktopLoginView from './CloudDesktopLoginView.vue'

vi.mock(import('@/platform/cloud/onboarding/desktopLoginRedemption'), {
  spy: true
})

function renderView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }]
  })
  const replace = vi.spyOn(router, 'replace')
  const { unmount } = render(CloudDesktopLoginView, {
    global: {
      plugins: [
        router,
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    }
  })
  return { replace, unmount }
}

describe('CloudDesktopLoginView', () => {
  beforeEach(() => {
    claimDesktopLoginRedemptionStatus()
    desktopLoginRedemptionStatus.value = 'idle'
  })

  it('redirects to the workspace when there is nothing to approve', () => {
    vi.mocked(hasPendingDesktopLoginCode).mockReturnValue(false)
    desktopLoginRedemptionStatus.value = 'idle'

    const { replace } = renderView()

    expect(replace).toHaveBeenCalledWith(expect.objectContaining({ path: '/' }))
  })

  it('explains the pending approval without a continue link', () => {
    vi.mocked(hasPendingDesktopLoginCode).mockReturnValue(true)
    desktopLoginRedemptionStatus.value = 'awaiting_approval'

    const { replace } = renderView()

    expect(
      screen.getByText(enMessages.desktopLogin.approvalPendingSummary)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', {
        name: enMessages.desktopLogin.continueToCloud
      })
    ).toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })

  it('shows progress without a continue link while redeeming', () => {
    vi.mocked(hasPendingDesktopLoginCode).mockReturnValue(false)
    desktopLoginRedemptionStatus.value = 'redeeming'

    renderView()

    expect(
      screen.getByText(enMessages.desktopLogin.redeemingSummary)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', {
        name: enMessages.desktopLogin.continueToCloud
      })
    ).toBeNull()
  })

  it.for([
    ['redeemed', enMessages.desktopLogin.successSummary],
    ['declined', enMessages.desktopLogin.declinedSummary],
    ['sso_unavailable', enMessages.desktopLogin.ssoUnavailableSummary]
  ] as const)(
    'shows the %s outcome with a continue link',
    ([status, heading]) => {
      vi.mocked(hasPendingDesktopLoginCode).mockReturnValue(false)
      desktopLoginRedemptionStatus.value = status

      const { replace } = renderView()

      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
      expect(
        screen.getByRole('link', {
          name: enMessages.desktopLogin.continueToCloud
        })
      ).toBeInTheDocument()
      expect(replace).not.toHaveBeenCalled()
    }
  )

  it('announces a dismissed approval, which no toast reports', async () => {
    vi.mocked(hasPendingDesktopLoginCode).mockReturnValue(true)
    desktopLoginRedemptionStatus.value = 'awaiting_approval'

    renderView()
    expect(screen.getByRole('status')).toHaveTextContent('')

    desktopLoginRedemptionStatus.value = 'declined'

    await vi.waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        enMessages.desktopLogin.declinedDetail
      )
    )
  })

  function expectSentToWorkspace(
    replace: ReturnType<typeof renderView>['replace']
  ) {
    expect(replace).toHaveBeenCalledWith(expect.objectContaining({ path: '/' }))
    expect(
      screen.queryByRole('heading', {
        name: enMessages.desktopLogin.successSummary
      })
    ).toBeNull()
  }

  it('sends a later visit with nothing to approve to the workspace after leaving a finished sign-in', () => {
    vi.mocked(hasPendingDesktopLoginCode).mockReturnValue(false)
    desktopLoginRedemptionStatus.value = 'redeemed'

    renderView().unmount()
    const { replace } = renderView()

    expectSentToWorkspace(replace)
  })

  it('sends a later visit with nothing to approve to the workspace after leaving before the sign-in finished', () => {
    vi.mocked(hasPendingDesktopLoginCode).mockReturnValue(false)
    desktopLoginRedemptionStatus.value = 'redeeming'

    renderView().unmount()
    desktopLoginRedemptionStatus.value = 'redeemed'
    const { replace } = renderView()

    expectSentToWorkspace(replace)
  })

  it('shows the finished sign-in again instead of leaving when the page is reloaded', () => {
    vi.mocked(hasPendingDesktopLoginCode).mockReturnValue(false)
    vi.mocked(restoreShownDesktopLoginRedemptionStatus).mockImplementationOnce(
      () => {
        desktopLoginRedemptionStatus.value = 'redeemed'
        return true
      }
    )

    const { replace } = renderView()

    expect(
      screen.getByRole('heading', {
        name: enMessages.desktopLogin.successSummary
      })
    ).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('keeps showing a redemption that is still running when the page is revisited', async () => {
    vi.mocked(hasPendingDesktopLoginCode).mockReturnValue(false)
    desktopLoginRedemptionStatus.value = 'redeeming'

    renderView().unmount()
    const { replace } = renderView()
    desktopLoginRedemptionStatus.value = 'redeemed'

    expect(
      await screen.findByRole('heading', {
        name: enMessages.desktopLogin.successSummary
      })
    ).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })
})
