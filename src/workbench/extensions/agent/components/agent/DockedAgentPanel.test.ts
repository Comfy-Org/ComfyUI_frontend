import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import { i18n } from '@/i18n'
import type { TurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useAgentRunModeStore } from '@/workbench/extensions/agent/stores/agent/agentRunModeStore'

import DockedAgentPanel from './DockedAgentPanel.vue'

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => undefined
}))

const fetchApi = vi.hoisted(() => vi.fn())
vi.mock('@/scripts/api', () => ({ api: { fetchApi } }))

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const rootLiveness = vi.hoisted(() => ({ live: 0, maxLive: 0 }))

vi.mock('@/workbench/extensions/agent/AgentPanelRoot.vue', async () => {
  const { defineComponent, h, onUnmounted } = await import('vue')
  return {
    __esModule: true,
    default: defineComponent({
      name: 'AgentPanelRoot',
      setup() {
        rootLiveness.live++
        rootLiveness.maxLive = Math.max(rootLiveness.maxLive, rootLiveness.live)
        onUnmounted(() => {
          rootLiveness.live--
        })
        return () => h('div', { 'data-testid': 'agent-panel-root-stub' })
      }
    })
  }
})

function openPanel() {
  const store = useAgentPanelStore()
  store.enabled = true
  store.isOpen = true
  return store
}

function renderPanel() {
  return render(DockedAgentPanel, { global: { plugins: [i18n] } })
}

describe('DockedAgentPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    fetchApi.mockReset()
    fetchApi.mockResolvedValue(jsonResponse(404, { error: 'not found' }))
    rootLiveness.live = 0
    rootLiveness.maxLive = 0
  })

  it('docks the panel at the store width when enabled and open', async () => {
    const store = openPanel()
    renderPanel()

    const container = screen.getByTestId('docked-agent-panel')
    expect(container.style.width).toBe(`${store.width}px`)
    expect(container).toHaveClass('docked-agent-panel')
    expect(
      await screen.findByTestId('agent-panel-root-stub', undefined, {
        timeout: 5000
      })
    ).toBeTruthy()
  })

  it('restores the server run mode when the panel initializes', async () => {
    fetchApi.mockResolvedValueOnce(
      jsonResponse(200, { mode: 'auto_limited', credit_limit: 25 })
    )
    openPanel()
    renderPanel()

    const runMode = useAgentRunModeStore()
    await vi.waitFor(() => expect(runMode.mode).toBe('auto_limited'))
    expect(runMode.creditLimit).toBe(25)
    expect(fetchApi).toHaveBeenCalledWith('/agent/run-mode', { method: 'GET' })
  })

  it('fills the panel shell and draws the canvas seam border', () => {
    openPanel()
    renderPanel()

    const shell = screen.getByTestId('docked-agent-panel-shell')

    expect(shell).toHaveClass('border-l', 'border-interface-stroke')
  })

  it('renders nothing while the panel is closed', () => {
    const store = openPanel()
    store.isOpen = false
    renderPanel()

    expect(screen.queryByTestId('docked-agent-panel')).toBeNull()
  })

  it('renders nothing while the feature is disabled', () => {
    const store = openPanel()
    store.enabled = false
    renderPanel()

    expect(screen.queryByTestId('docked-agent-panel')).toBeNull()
  })

  it('resizes via pointer drag on the handle, clamped to the width bounds', async () => {
    const store = openPanel()
    const user = userEvent.setup()
    renderPanel()

    const handle = screen.getByTestId('agent-panel-resize-handle')
    handle.setPointerCapture = () => {}

    await user.pointer({
      keys: '[MouseLeft>]',
      target: handle,
      coords: { x: 800, y: 10 }
    })
    await user.pointer({ coords: { x: 750, y: 10 } })
    expect(store.width).toBe(470)

    await user.pointer({ coords: { x: -2000, y: 10 } })
    expect(store.width).toBe(960)

    await user.pointer({ coords: { x: 3000, y: 10 } })
    expect(store.width).toBe(420)

    await fireEvent(handle, new Event('lostpointercapture'))
    await user.pointer({ coords: { x: 800, y: 10 } })
    expect(store.width).toBe(420)
  })

  it('settles to one live root and the live turn survives both mode switches through rehydration', async () => {
    openPanel()
    const linearMode = ref(false)
    const GraphHost = defineComponent({
      components: { DockedAgentPanel },
      setup: () => ({ linearMode }),
      template: `<div v-show="!linearMode"><DockedAgentPanel v-if="!linearMode" /></div>`
    })
    const DualHostHarness = defineComponent({
      components: { GraphHost, DockedAgentPanel },
      setup: () => ({ linearMode }),
      template: `
        <GraphHost />
        <DockedAgentPanel v-if="linearMode" />
      `
    })

    render(DualHostHarness, { global: { plugins: [i18n] } })
    await screen.findByTestId('agent-panel-root-stub')
    expect(screen.getAllByTestId('docked-agent-panel')).toHaveLength(1)

    const conversation = useAgentConversationStore()
    conversation.setThreadId('th-1')
    conversation.startTurn('turn-live' as TurnId)
    expect(conversation.activeTurnId).toBe('turn-live')

    linearMode.value = true
    await nextTick()
    await vi.waitFor(() => expect(rootLiveness.live).toBe(1))
    expect(rootLiveness.maxLive).toBe(1)
    expect(rootLiveness.live).toBe(1)
    expect(screen.getAllByTestId('docked-agent-panel')).toHaveLength(1)
    await vi.waitFor(() => expect(conversation.activeTurnId).toBe('turn-live'))
    await Promise.resolve()
    expect(conversation.activeTurnId).toBe('turn-live')

    linearMode.value = false
    await nextTick()
    await vi.waitFor(() => expect(rootLiveness.live).toBe(1))
    expect(rootLiveness.live).toBe(1)
    expect(screen.getAllByTestId('docked-agent-panel')).toHaveLength(1)
    await vi.waitFor(() => expect(conversation.activeTurnId).toBe('turn-live'))
    await Promise.resolve()
    expect(conversation.activeTurnId).toBe('turn-live')
  })
})
