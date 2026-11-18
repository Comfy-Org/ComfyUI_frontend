import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { useBrowserTabTitleStore } from '@/stores/browserTabTitleStore'
import type { ChatSession } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import { useAgentChatHistoryStore } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import { useAgentOpenChatsStore } from '@/workbench/extensions/agent/stores/agent/agentOpenChatsStore'

import { useAgentTabSignals } from './useAgentTabSignals'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { agentInputNeededShort: 'Input needed' } } }
})

const tabA = 'workflows/a.json'
const tabB = 'workflows/b.json'

function chatOf(workflowId: string, id = `chat-of-${workflowId}`): ChatSession {
  return {
    id,
    title: id,
    updatedAt: 1,
    titleSource: 'server',
    workflowId
  }
}

function openTab(path: string): ComfyWorkflow {
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
  cloudIds: Record<string, string | undefined>,
  onIdentityChange: (listener: () => void) => () => void = () => () => {}
) {
  let signals!: ReturnType<typeof useAgentTabSignals>
  const view = render(
    {
      setup() {
        signals = useAgentTabSignals({
          onIdentityChange,
          cloudIdFor: (workflow) => cloudIds[workflow.path]
        })
        return () => null
      }
    },
    { global: { plugins: [i18n] } }
  )
  return { ...view, signals }
}

describe('useAgentTabSignals: tabs that have a chat', () => {
  it('TS-15 marks the open tabs whose workflow has a chat in History', () => {
    const activity = useWorkflowTabActivityStore()
    openTab(tabA)
    openTab(tabB)
    useAgentChatHistoryStore().replaceAll([chatOf('wf-a')])

    mountSignals({ [tabA]: 'wf-a', [tabB]: 'wf-b' })

    expect(activity.chatStatusFor(tabA)).toBe('seen')
    expect(activity.chatStatusFor(tabB)).toBeUndefined()
  })

  it('TS-15 follows History as chats are listed and deleted', async () => {
    const activity = useWorkflowTabActivityStore()
    const history = useAgentChatHistoryStore()
    openTab(tabB)
    mountSignals({ [tabB]: 'wf-b' })
    expect(activity.chatStatusFor(tabB)).toBeUndefined()

    history.replaceAll([chatOf('wf-b', 'one'), chatOf('wf-b', 'two')])
    await nextTick()
    expect(activity.chatStatusFor(tabB)).toBe('seen')

    history.remove('one')
    await nextTick()
    expect(activity.chatStatusFor(tabB)).toBe('seen')

    history.remove('two')
    await nextTick()
    expect(activity.chatStatusFor(tabB)).toBeUndefined()
  })

  it('TS-15 marks a tab whose chat was shown in this page before History lists it', async () => {
    const activity = useWorkflowTabActivityStore()
    const openChats = useAgentOpenChatsStore()
    openTab(tabB)
    mountSignals({ [tabB]: 'wf-b' })

    openChats.remember('wf-b', 'th-9')
    await nextTick()
    expect(activity.chatStatusFor(tabB)).toBe('seen')

    openChats.forget('th-9')
    await nextTick()
    expect(activity.chatStatusFor(tabB)).toBeUndefined()
  })

  it('TS-15 leaves a tab alone while it has no cloud workflow to own a chat', () => {
    const activity = useWorkflowTabActivityStore()
    openTab(tabA)
    useAgentChatHistoryStore().replaceAll([chatOf('wf-a')])

    mountSignals({})

    expect(activity.chatStatusFor(tabA)).toBeUndefined()
  })

  it('TS-15 marks a tab that is opened later and drops one that is closed', async () => {
    const activity = useWorkflowTabActivityStore()
    const workflowStore = useWorkflowStore()
    useAgentChatHistoryStore().replaceAll([chatOf('wf-a'), chatOf('wf-b')])
    const first = openTab(tabA)
    mountSignals({ [tabA]: 'wf-a', [tabB]: 'wf-b' })
    expect(activity.chatStatusFor(tabB)).toBeUndefined()

    openTab(tabB)
    await nextTick()
    expect(activity.chatStatusFor(tabB)).toBe('seen')

    await workflowStore.closeWorkflow(first)
    await nextTick()
    expect(activity.chatStatusFor(tabA)).toBeUndefined()
  })

  it('TS-15 keeps the marks when the panel goes away', async () => {
    const activity = useWorkflowTabActivityStore()
    openTab(tabA)
    useAgentChatHistoryStore().replaceAll([chatOf('wf-a')])
    const { unmount } = mountSignals({ [tabA]: 'wf-a' })

    unmount()
    await nextTick()

    expect(activity.chatStatusFor(tabA)).toBe('seen')
  })

  it('TS-05/TS-06 marks unseen only when a turn finishes in the background', async () => {
    const activity = useWorkflowTabActivityStore()
    const workflowStore = useWorkflowStore()
    const a = openTab(tabA)
    const b = openTab(tabB)
    workflowStore.activeWorkflow = a as never
    const conversation = useAgentConversationStore()
    conversation.setTurnTabResolver(() => ({
      status: 'known',
      workflowInstanceId: a.instanceId
    }))
    mountSignals({ [tabA]: 'wf-a', [tabB]: 'wf-b' })

    conversation.setThreadId('th-a')
    conversation.startTurn(toTurnId('m-1'))
    conversation.ingest({
      type: 'agent_message_done',
      data: { thread_id: 'th-a', message_id: 'm-1', usage: null }
    })
    await nextTick()
    expect(activity.unseenModifiedPaths.has(tabA)).toBe(false)

    conversation.startTurn(toTurnId('m-2'))
    workflowStore.activeWorkflow = b as never
    conversation.ingest({
      type: 'agent_message_done',
      data: { thread_id: 'th-a', message_id: 'm-2', usage: null }
    })
    await vi.waitFor(() =>
      expect(activity.unseenModifiedPaths.has(tabA)).toBe(true)
    )
  })

  it('keeps the ask title hold on clearTurnSignals while an approval ask is pending', () => {
    const a = openTab(tabA)
    useWorkflowStore().activeWorkflow = a as never
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
    const { signals } = mountSignals({ [tabA]: 'wf-a' })
    expect(useBrowserTabTitleStore().prefix).toBe('[Input needed] ')

    signals.clearTurnSignals()
    expect(useBrowserTabTitleStore().prefix).toBe('[Input needed] ')
  })
})
