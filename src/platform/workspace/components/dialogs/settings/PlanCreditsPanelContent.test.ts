import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { ActivityEvent } from '@/platform/workspace/composables/useWorkspaceActivity'

import PlanCreditsPanelContent from './PlanCreditsPanelContent.vue'

const {
  mockActivityEvents,
  mockActivityLoading,
  mockActivityError,
  mockRefreshActivity
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')
  return {
    mockActivityEvents: ref<ActivityEvent[]>([]),
    mockActivityLoading: ref(false),
    mockActivityError: ref<unknown>(null),
    mockRefreshActivity: vi.fn()
  }
})

vi.mock('@/platform/workspace/composables/useWorkspaceActivitySource', () => ({
  useWorkspaceActivitySource: () => ({
    events: mockActivityEvents,
    isLoading: mockActivityLoading,
    error: mockActivityError,
    refresh: mockRefreshActivity
  })
}))

const stubs = {
  SubscriptionPanelContentWorkspace: {
    template: '<div data-testid="credits-body" />'
  },
  WorkspaceActivityContent: {
    props: ['search', 'events'],
    template:
      '<div data-testid="activity-body">{{ search }} {{ events.length }}</div>'
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
  beforeEach(() => {
    mockActivityEvents.value = []
    mockActivityLoading.value = false
    mockActivityError.value = null
    mockRefreshActivity.mockReset()
  })

  it('shows Credits and Activity tabs with Credits active by default', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'Credits' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Activity' })).toBeTruthy()
    expect(screen.getByTestId('credits-body')).toBeTruthy()
    expect(screen.queryByTestId('activity-body')).toBeNull()
  })

  it('shows the search box only on the Activity tab', async () => {
    renderPanel()
    expect(screen.queryByPlaceholderText('Search')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))
    expect(screen.getByTestId('activity-body')).toBeTruthy()
    expect(screen.queryByTestId('credits-body')).toBeNull()
    expect(screen.getByPlaceholderText('Search')).toBeTruthy()
  })

  it('passes the search query to the Activity tab and clears it on tab change', async () => {
    renderPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))
    await userEvent.type(screen.getByPlaceholderText('Search'), 'flux')
    expect(screen.getByTestId('activity-body').textContent).toContain('flux')

    await userEvent.click(screen.getByRole('button', { name: 'Credits' }))
    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))
    expect(screen.getByTestId('activity-body').textContent).not.toContain(
      'flux'
    )
    expect(
      (screen.getByPlaceholderText('Search') as HTMLInputElement).value
    ).toBe('')
  })

  it('shows loading while activity is being fetched', async () => {
    mockActivityLoading.value = true
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))

    expect(screen.getByRole('status').textContent).toContain('Loading')
    expect(screen.queryByTestId('activity-body')).toBeNull()
  })

  it('shows an activity error and retries the request', async () => {
    mockActivityError.value = new Error('request failed')
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(mockRefreshActivity).toHaveBeenCalledOnce()
  })

  it('passes loaded activity events to the activity table', async () => {
    mockActivityEvents.value = [
      {
        id: 'event-1',
        date: new Date('2026-07-14T12:00:00Z'),
        userId: 'cloud-user-1',
        userName: 'Ada Lovelace',
        eventType: 'Cloud workflow run',
        detail: '',
        credits: 0
      }
    ]
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))

    expect(screen.getByTestId('activity-body').textContent).toContain('1')
  })
})
