import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentPanelStore } from '../../stores/agent/agentPanelStore'

import CompactAgentComposer from './CompactAgentComposer.vue'

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => undefined
}))

describe('CompactAgentComposer', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createTestingPinia({ stubActions: false }))
    useAgentPanelStore().enabled = true
  })

  it('queues Enter submissions for the official Agent panel', async () => {
    render(CompactAgentComposer, { global: { plugins: [i18n] } })
    const textbox = screen.getByRole('textbox', {
      name: i18n.global.t('agent.compactComposer.label')
    })

    await userEvent.type(textbox, 'Build a portrait workflow{Enter}')

    expect(useAgentComposerStore().pendingSubmission?.text).toBe(
      'Build a portrait workflow'
    )
    expect(useAgentPanelStore().isOpen).toBe(true)
  })

  it('does not submit an in-progress IME composition', async () => {
    render(CompactAgentComposer, { global: { plugins: [i18n] } })
    const textbox = screen.getByRole('textbox')
    await userEvent.type(textbox, '生成图片')

    textbox.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true
      })
    )

    expect(useAgentComposerStore().pendingSubmission).toBeNull()
    expect(useAgentPanelStore().isOpen).toBe(false)
  })

  it('opens the full panel only from its explicit control', async () => {
    render(CompactAgentComposer, {
      global: { plugins: [i18n] }
    })

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.compactComposer.open')
      })
    )

    expect(useAgentPanelStore().isOpen).toBe(true)
  })
})
