import { render, screen } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { reportError } from '@/platform/telemetry/reportError'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agentPanelStore'

import DockedAgentPanel from './DockedAgentPanel.vue'

const loaderState = vi.hoisted(() => ({ reject: false }))

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: vi.fn()
}))

vi.mock(
  '@/workbench/extensions/agent/components/agent/AgentPanelRoot.vue',
  async () => {
    const { defineComponent, h } = await import('vue')
    return {
      __esModule: true,
      default: defineComponent({
        name: 'AgentPanelRoot',
        setup() {
          if (loaderState.reject) {
            throw new Error('agent panel body failed')
          }
          return () => h('div', { 'data-testid': 'agent-panel-root-stub' })
        }
      })
    }
  }
)

function renderPanel(options: { onAppError?: (error: unknown) => void } = {}) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return render(DockedAgentPanel, {
    global: {
      plugins: [i18n],
      config: options.onAppError ? { errorHandler: options.onAppError } : {}
    }
  })
}

describe('DockedAgentPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    loaderState.reject = false
    vi.mocked(reportError).mockClear()
  })

  it('renders nothing while the feature flag is off, even with a stored open state', () => {
    localStorage.setItem('Comfy.AgentPanel.open', 'true')
    renderPanel()

    expect(screen.queryByTestId('docked-agent-panel')).toBeNull()
  })

  it('renders nothing while the panel is closed', () => {
    const store = useAgentPanelStore()
    store.enabled = true
    renderPanel()

    expect(screen.queryByTestId('docked-agent-panel')).toBeNull()
  })

  it('keeps the landmark named while the panel body is still loading', () => {
    const store = useAgentPanelStore()
    store.enabled = true
    store.isOpen = true
    renderPanel()

    // No awaits: the async panel body has not resolved yet, so the Suspense
    // fallback is what names the complementary landmark.
    expect(screen.queryByTestId('agent-panel-root-stub')).toBeNull()
    screen.getByRole('complementary', { name: 'Comfy Agent' })
    screen.getByRole('heading', { name: 'Comfy Agent' })
  })

  it('retires the fallback title once the panel body resolves', async () => {
    const store = useAgentPanelStore()
    store.enabled = true
    store.isOpen = true
    renderPanel()

    await screen.findByTestId('agent-panel-root-stub')
    // The resolved body owns agent-panel-title (pinned in
    // AgentPanelRoot.test.ts); the fallback title must leave with the fallback
    // so the id never appears twice.
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('docks the panel when enabled and open', async () => {
    const store = useAgentPanelStore()
    store.enabled = true
    store.isOpen = true
    renderPanel()
    await nextTick()

    screen.getByTestId('docked-agent-panel')
    await screen.findByTestId('agent-panel-root-stub')
  })

  it('lets a runtime error inside the resolved panel propagate instead of calling it a load failure', async () => {
    loaderState.reject = true
    const appErrors: unknown[] = []
    const store = useAgentPanelStore()
    store.enabled = true
    store.isOpen = true
    renderPanel({ onAppError: (error) => appErrors.push(error) })

    // The chunk resolved; the failure came from the panel's own setup. It
    // must reach the app-level handler untouched, and must NOT be reported
    // or rendered as a load failure.
    await vi.waitFor(() => expect(appErrors).toHaveLength(1))
    expect(screen.queryByText('The agent panel failed to load.')).toBeNull()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('undocks when the flag turns off while open', async () => {
    const store = useAgentPanelStore()
    store.enabled = true
    store.isOpen = true
    renderPanel()
    await nextTick()
    expect(screen.getByTestId('docked-agent-panel')).toBeInTheDocument()

    store.enabled = false
    await nextTick()
    expect(screen.queryByTestId('docked-agent-panel')).toBeNull()
  })
})
