import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import type { TurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type { AgentRestClient } from '@/workbench/extensions/agent/services/agent/agentRestClient'
import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import DockedAgentPanel from './DockedAgentPanel.vue'

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => undefined
}))

const rootLiveness = vi.hoisted(() => ({ live: 0, maxLive: 0 }))

vi.mock('@/workbench/extensions/agent/AgentPanelRoot.vue', async () => {
  const { defineComponent, h, onBeforeUnmount, onUnmounted } =
    await import('vue')
  const { useAgentSession } =
    await import('@/workbench/extensions/agent/composables/agent/useAgentSession')
  const unusedRest = async (): Promise<never> => {
    throw new Error('rest is unused in this harness')
  }
  const rest: AgentRestClient = {
    postMessage: unusedRest,
    getMessages: async () => [],
    listThreads: unusedRest,
    listCloudWorkflows: unusedRest,
    cancelMessage: unusedRest,
    getDraft: unusedRest,
    uploadImage: unusedRest
  }
  return {
    __esModule: true,
    default: defineComponent({
      name: 'AgentPanelRoot',
      setup() {
        rootLiveness.live++
        rootLiveness.maxLive = Math.max(rootLiveness.maxLive, rootLiveness.live)
        const session = useAgentSession({
          rest,
          events: { subscribe: () => () => {} }
        })
        session.start()
        onBeforeUnmount(() => session.stop())
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

describe('DockedAgentPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    rootLiveness.live = 0
    rootLiveness.maxLive = 0
  })

  it('docks the panel at the store width when enabled and open', async () => {
    const store = openPanel()
    render(DockedAgentPanel)

    const container = screen.getByTestId('docked-agent-panel')
    expect(container.style.width).toBe(`${store.width}px`)
    expect(container).toHaveClass('docked-agent-panel')
    expect(
      await screen.findByTestId('agent-panel-root-stub', undefined, {
        timeout: 5000
      })
    ).toBeTruthy()
  })

  it('renders nothing while the panel is closed', () => {
    const store = openPanel()
    store.isOpen = false
    render(DockedAgentPanel)

    expect(screen.queryByTestId('docked-agent-panel')).toBeNull()
  })

  it('renders nothing while the feature is disabled', () => {
    const store = openPanel()
    store.enabled = false
    render(DockedAgentPanel)

    expect(screen.queryByTestId('docked-agent-panel')).toBeNull()
  })

  it('resizes via pointer drag on the handle, clamped to the width bounds', async () => {
    const store = openPanel()
    const user = userEvent.setup()
    render(DockedAgentPanel)

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

    render(DualHostHarness)
    await screen.findByTestId('agent-panel-root-stub')
    expect(screen.getAllByTestId('docked-agent-panel')).toHaveLength(1)

    const conversation = useAgentConversationStore()
    conversation.setThreadId('th-1')
    conversation.startTurn('turn-live' as TurnId)
    expect(conversation.activeTurnId).toBe('turn-live')

    linearMode.value = true
    await nextTick()
    expect(rootLiveness.maxLive).toBe(2)
    expect(rootLiveness.live).toBe(1)
    expect(screen.getAllByTestId('docked-agent-panel')).toHaveLength(1)
    await vi.waitFor(() => expect(conversation.activeTurnId).toBe('turn-live'))
    await Promise.resolve()
    expect(conversation.activeTurnId).toBe('turn-live')

    linearMode.value = false
    await nextTick()
    expect(rootLiveness.live).toBe(1)
    expect(screen.getAllByTestId('docked-agent-panel')).toHaveLength(1)
    await vi.waitFor(() => expect(conversation.activeTurnId).toBe('turn-live'))
    await Promise.resolve()
    expect(conversation.activeTurnId).toBe('turn-live')
  })
})
