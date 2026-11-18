import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import enMessages from '@/locales/en/main.json'
import {
  desktopLoginRedemptionStatus,
  hasPendingDesktopLoginCode
} from '@/platform/cloud/onboarding/desktopLoginRedemption'

import CloudDesktopLoginView from './CloudDesktopLoginView.vue'

vi.mock(
  import('@/platform/cloud/onboarding/desktopLoginRedemption'),
  async () => {
    const { shallowRef } = await import('vue')
    return {
      desktopLoginRedemptionStatus: shallowRef('idle'),
      hasPendingDesktopLoginCode: vi.fn(() => true)
    }
  }
)

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
  afterEach(() => {
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

  it('forgets a settled outcome once the page is left', () => {
    vi.mocked(hasPendingDesktopLoginCode).mockReturnValue(false)
    desktopLoginRedemptionStatus.value = 'redeemed'

    const { unmount } = renderView()
    unmount()

    expect(desktopLoginRedemptionStatus.value).toBe('idle')
  })
})
