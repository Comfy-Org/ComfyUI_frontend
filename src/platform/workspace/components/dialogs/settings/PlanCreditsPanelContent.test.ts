import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen, waitFor } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json'

import PlanCreditsPanelContent from './PlanCreditsPanelContent.vue'

const mockDistribution = vi.hoisted(() => ({ cloud: true }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockDistribution.cloud
  }
}))

const refreshSpy = vi.hoisted(() => vi.fn(() => Promise.resolve()))

const stubs = {
  SubscriptionPanelContentWorkspace: {
    template: '<section aria-label="Plan and credits overview" />'
  },
  CreditsPanel: {
    props: ['embedded'],
    template: '<section aria-label="Local credits overview" />'
  },
  SettingsPlansSection: {
    template: '<section aria-label="Plans section" />'
  },
  SubscriptionFooterLinks: {
    template: '<footer aria-label="Subscription links" />'
  },
  UsageLogsTable: {
    template: '<section aria-label="Usage logs" />',
    methods: {
      refresh: refreshSpy
    }
  }
}

function renderPanel({ cloud = true } = {}) {
  mockDistribution.cloud = cloud
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return render(PlanCreditsPanelContent, { global: { plugins: [i18n], stubs } })
}

describe('PlanCreditsPanelContent', () => {
  it('shows Credits and Activity tabs with Credits active by default', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'Credits' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Activity' })).toBeTruthy()
    expect(
      screen.getByRole('region', { name: 'Plan and credits overview' })
    ).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Usage logs' })).toBeNull()
  })

  it('shows the credits card first and the plans section below it on local', () => {
    renderPanel({ cloud: false })

    const creditsCard = screen.getByRole('region', {
      name: 'Local credits overview'
    })
    const plansSection = screen.getByRole('region', { name: 'Plans section' })
    expect(
      creditsCard.compareDocumentPosition(plansSection) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      screen.getByRole('contentinfo', { name: 'Subscription links' })
    ).toBeTruthy()
    expect(
      screen.queryByRole('region', { name: 'Plan and credits overview' })
    ).toBeNull()
  })

  it('never shows the plans section on cloud', () => {
    renderPanel({ cloud: true })

    expect(screen.queryByRole('region', { name: 'Plans section' })).toBeNull()
    expect(
      screen.getByRole('region', { name: 'Plan and credits overview' })
    ).toBeTruthy()
  })

  it('opens the platform usage page from the Activity tab', async () => {
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))
    await userEvent.click(screen.getByRole('button', { name: 'Full activity' }))

    expect(windowOpen).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/\/profile\/usage$/),
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('loads the usage log on the Activity tab', async () => {
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))
    expect(screen.getByRole('region', { name: 'Usage logs' })).toBeTruthy()
    expect(
      screen.queryByRole('region', { name: 'Plan and credits overview' })
    ).toBeNull()
    await waitFor(() => expect(refreshSpy).toHaveBeenCalledOnce())
  })

  it('reports usage-log refresh failures', async () => {
    const error = new Error('refresh failed')
    refreshSpy.mockRejectedValueOnce(error)
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledExactlyOnceWith(
        'Error refreshing usage logs:',
        error
      )
    )
  })
})
