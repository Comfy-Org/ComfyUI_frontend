import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import PlanCreditsPanelContent from './PlanCreditsPanelContent.vue'

const stubs = {
  SubscriptionPanelContentWorkspace: {
    template: '<div data-testid="credits-body" />'
  },
  WorkspaceActivityContent: {
    props: ['search'],
    template: '<div data-testid="activity-body">{{ search }}</div>'
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
})
