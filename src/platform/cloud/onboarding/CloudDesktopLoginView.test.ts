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
  render(CloudDesktopLoginView, {
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
  return { replace }
}

describe('CloudDesktopLoginView', () => {
  afterEach(() => {
    desktopLoginRedemptionStatus.value = 'idle'
  })

  it('redirects to the workspace when there is nothing to approve', () => {
    vi.mocked(hasPendingDesktopLoginCode).mockReturnValue(false)
    desktopLoginRedemptionStatus.value = 'idle'

    const { replace } = renderView()

    expect(replace).toHaveBeenCalledWith({ path: '/' })
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

  it('shows the success summary and a continue link once redeemed', () => {
    vi.mocked(hasPendingDesktopLoginCode).mockReturnValue(false)
    desktopLoginRedemptionStatus.value = 'redeemed'

    const { replace } = renderView()

    expect(
      screen.getByText(enMessages.desktopLogin.successSummary)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: enMessages.desktopLogin.continueToCloud
      })
    ).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })
})
