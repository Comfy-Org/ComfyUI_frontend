import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen, waitFor } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json'

import PlanCreditsPanelContent from './PlanCreditsPanelContent.vue'

const refreshSpy = vi.hoisted(() => vi.fn(() => Promise.resolve()))

const stubs = {
  SubscriptionPanelContentWorkspace: {
    template: '<div data-testid="credits-body" />'
  },
  UsageLogsTable: {
    template: '<div data-testid="usage-logs" />',
    methods: {
      refresh: refreshSpy
    }
  }
}

function renderPanel() {
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
    expect(screen.getByTestId('credits-body')).toBeTruthy()
    expect(screen.queryByTestId('usage-logs')).toBeNull()
  })

  it('loads the usage log on the Activity tab', async () => {
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))
    expect(screen.getByTestId('usage-logs')).toBeTruthy()
    expect(screen.queryByTestId('credits-body')).toBeNull()
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
      expect(consoleError).toHaveBeenCalledWith(
        'Error refreshing usage logs:',
        error
      )
    )
  })
})
