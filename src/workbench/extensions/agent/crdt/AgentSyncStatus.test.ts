import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'

import AgentSyncStatus from './AgentSyncStatus.vue'

describe('AgentSyncStatus', () => {
  it('updates a persistent polite live region without adding focusable controls', async () => {
    const { rerender } = render(AgentSyncStatus, {
      props: { status: null },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
      }
    })
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('aria-atomic', 'true')
    expect(region).toBeEmptyDOMElement()

    await rerender({ status: 'checking' })
    expect(region).toHaveTextContent('Checking workflow synchronization…')
    expect(region).not.toHaveTextContent('could not')
    await rerender({ status: 'recovering' })
    expect(region).toHaveTextContent('Restoring workflow synchronization…')
    await rerender({ status: 'failed' })
    expect(region).toHaveTextContent(
      'Workflow synchronization could not be restored. Changes from the agent or other windows may be missing.'
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(region).not.toHaveAttribute('tabindex')
    await rerender({ status: null })
    expect(screen.getByRole('status')).toBe(region)
    expect(region).toBeEmptyDOMElement()
  })
})
