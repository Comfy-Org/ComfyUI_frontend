import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen, waitFor } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json'

import PlanCreditsPanelContent from './PlanCreditsPanelContent.vue'

const mockWorkspaceState = vi.hoisted(() => ({ personal: true }))
vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get isInPersonalWorkspace() {
      return mockWorkspaceState.personal
    }
  })
}))

const refreshSpy = vi.hoisted(() => vi.fn())

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

function renderPanel({ personal = true } = {}) {
  mockWorkspaceState.personal = personal
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

  it('shows the usage-log table on the Activity tab and loads it', async () => {
    refreshSpy.mockClear()
    renderPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))
    expect(screen.getByTestId('usage-logs')).toBeTruthy()
    expect(screen.queryByTestId('credits-body')).toBeNull()
    await waitFor(() => expect(refreshSpy).toHaveBeenCalledTimes(1))
  })

  it('hides the Activity tab for team workspaces', () => {
    renderPanel({ personal: false })
    expect(screen.getByRole('button', { name: 'Credits' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Activity' })).toBeNull()
    expect(screen.getByTestId('credits-body')).toBeTruthy()
  })
})
