import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useTelemetry } from '@/platform/telemetry'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import AgentEntryOrb from './AgentEntryOrb.vue'

vi.mock(import('@/platform/telemetry'))

const consentChecking = await vi.hoisted(async () =>
  (await import('vue')).ref(false)
)

const withConsent = vi.hoisted(() =>
  vi.fn<(onAccept: () => void) => Promise<void>>()
)

const telemetry = {
  trackAgentEntryButtonClicked: vi.fn(),
  trackAgentPanelOpened: vi.fn(),
  trackAgentPanelClosed: vi.fn()
}

vi.mock(
  import('@/workbench/extensions/agent/composables/agent/useAgentConsent'),
  () => ({
    useAgentConsent: () => ({
      accepted: computed(() => useAgentPanelStore().consentAccepted),
      isChecking: computed(() => consentChecking.value),
      withConsent
    })
  })
)

function renderOrb() {
  const user = userEvent.setup()
  const result = render(AgentEntryOrb, {
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ],
      directives: { tooltip: {} }
    }
  })
  return { user, ...result }
}

const orb = () =>
  screen.queryByRole('button', { name: enMessages.agent.entryButton })

beforeEach(() => {
  vi.mocked(useTelemetry).mockReturnValue(fromPartial(telemetry))
  consentChecking.value = false
  withConsent.mockImplementation(async (onAccept) => {
    useAgentPanelStore().consentAccepted = true
    onAccept()
  })
  useAgentPanelStore().enabled = true
  useAgentPanelStore().consentAccepted = false
  useAgentPanelStore().isOpen = false
})

describe('AgentEntryOrb', () => {
  it('offers the orb while the panel is closed', () => {
    renderOrb()

    expect(orb()).toBeInTheDocument()
  })

  it('withdraws the orb once the panel is visible', async () => {
    const { user } = renderOrb()

    await user.click(orb()!)

    expect(useAgentPanelStore().isVisible).toBe(true)
    expect(orb()).not.toBeInTheDocument()
  })

  it('stays away while the feature flag is off', () => {
    useAgentPanelStore().enabled = false
    renderOrb()

    expect(orb()).not.toBeInTheDocument()
  })

  it('opens the panel through the consent gate', async () => {
    const { user } = renderOrb()

    await user.click(orb()!)

    expect(withConsent).toHaveBeenCalledOnce()
    expect(useAgentPanelStore().isVisible).toBe(true)
  })

  it('offers the entry again when the restored consent check ends unaccepted', async () => {
    useAgentPanelStore().isOpen = true
    consentChecking.value = true
    renderOrb()
    expect(orb()).not.toBeInTheDocument()

    consentChecking.value = false
    await nextTick()

    expect(orb()).toBeInTheDocument()
  })

  it('leaves the panel closed when the flag turns off during consent', async () => {
    const store = useAgentPanelStore()
    withConsent.mockImplementationOnce(async (onAccept) => {
      store.enabled = false
      onAccept()
    })
    const { user } = renderOrb()

    await user.click(orb()!)

    expect(store.isVisible).toBe(false)
    expect(telemetry.trackAgentEntryButtonClicked).not.toHaveBeenCalled()
  })
})
