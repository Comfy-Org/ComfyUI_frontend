import { render } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useBrowserTabTitleStore } from '@/stores/browserTabTitleStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { setAgentTabTitlePrefix } from '@/workbench/extensions/agent/services/agent/agentTabTitlePrefix'
import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'

import { useAgentTabSignals } from './useAgentTabSignals'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { agentInputNeededShort: 'Input needed' } } }
})

const tabA = 'workflows/a.json'
const tabB = 'workflows/b.json'

function openTab(path: string) {
  const workflowStore = useWorkflowStore()
  const tab = createMockLoadedWorkflow({
    instanceId: path,
    path,
    isTemporary: false,
    unload: vi.fn()
  })
  workflowStore.attachWorkflow(tab, workflowStore.openWorkflows.length)
  return tab
}

function mountSignals(
  onIdentityChange: (listener: () => void) => () => void = () => () => {}
) {
  let signals!: ReturnType<typeof useAgentTabSignals>
  const view = render(
    {
      setup() {
        signals = useAgentTabSignals({ onIdentityChange })
        return () => null
      }
    },
    { global: { plugins: [i18n] } }
  )
  return { ...view, signals }
}

describe('useAgentTabSignals', () => {
  afterEach(() => {
    setAgentTabTitlePrefix(null)
  })

  it('marks unseen only when a turn finishes in the background', async () => {
    const activity = useWorkflowTabActivityStore()
    const workflowStore = useWorkflowStore()
    const a = openTab(tabA)
    const b = openTab(tabB)
    workflowStore.activeWorkflow = a
    const conversation = useAgentConversationStore()
    conversation.setTurnTabResolver(() => ({
      status: 'known',
      workflowInstanceId: a.instanceId
    }))
    mountSignals()

    conversation.setThreadId('th-a')
    conversation.startTurn(toTurnId('m-1'))
    conversation.ingest({
      type: 'agent_message_done',
      data: { thread_id: 'th-a', message_id: 'm-1', usage: null }
    })
    await nextTick()
    expect(activity.unseenModifiedPaths.has(tabA)).toBe(false)

    conversation.startTurn(toTurnId('m-2'))
    workflowStore.activeWorkflow = b
    conversation.ingest({
      type: 'agent_message_done',
      data: { thread_id: 'th-a', message_id: 'm-2', usage: null }
    })
    await vi.waitFor(() =>
      expect(activity.unseenModifiedPaths.has(tabA)).toBe(true)
    )
  })

  it('keeps the ask title hold on clearTurnSignals while an approval ask is pending and clears it when identity changes', () => {
    const a = openTab(tabA)
    useWorkflowStore().activeWorkflow = a
    const conversation = useAgentConversationStore()
    conversation.setThreadId('th-a')
    conversation.startTurn(toTurnId('m-1'))
    conversation.ingest({
      type: 'agent_ask',
      data: {
        thread_id: 'th-a',
        message_id: 'm-1',
        ask_id: 'ask-1',
        kind: 'run_approval',
        prompt: 'Run?',
        options: [{ id: 'run', label: 'Run' }],
        min_selections: 1,
        max_selections: 1,
        allow_other: false
      }
    })
    let identityListener: (() => void) | undefined
    const unsubscribe = vi.fn()
    const { signals } = mountSignals((listener) => {
      identityListener = listener
      return unsubscribe
    })
    expect(useBrowserTabTitleStore().prefix).toBe('[Input needed] ')

    signals.clearTurnSignals()
    expect(useBrowserTabTitleStore().prefix).toBe('[Input needed] ')
    expect(identityListener).toBeTypeOf('function')

    identityListener?.()
    expect(useBrowserTabTitleStore().prefix).toBe('')
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
