import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import type { ChatSession } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import { useAgentChatHistoryStore } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import { useAgentOpenChatsStore } from '@/workbench/extensions/agent/stores/agent/agentOpenChatsStore'

import { useAgentTabSignals } from './useAgentTabSignals'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

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
    path,
    isTemporary: false,
    unload: vi.fn()
  })
  workflowStore.attachWorkflow(tab, workflowStore.openWorkflows.length)
  return tab
}

function mountSignals(cloudIds: Record<string, string | undefined>) {
  return render(
    {
      setup() {
        useAgentTabSignals({
          cloudIdFor: (workflow) => cloudIds[workflow.path]
        })
        return () => null
      }
    },
    { global: { plugins: [i18n] } }
  )
}

describe('useAgentTabSignals: tabs that have a chat', () => {
  it('marks the open tabs whose workflow has a chat in History', () => {
    const activity = useWorkflowTabActivityStore()
    openTab(tabA)
    openTab(tabB)
    useAgentChatHistoryStore().replaceAll([chatOf('wf-a')])

    mountSignals({ [tabA]: 'wf-a', [tabB]: 'wf-b' })

    expect(activity.chatStatusFor(tabA)).toBe('seen')
    expect(activity.chatStatusFor(tabB)).toBeUndefined()
  })

  it('follows History as chats are listed and deleted', async () => {
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

  it('marks a tab whose chat was shown in this page before History lists it', async () => {
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

  it('leaves a tab alone while it has no cloud workflow to own a chat', () => {
    const activity = useWorkflowTabActivityStore()
    openTab(tabA)
    useAgentChatHistoryStore().replaceAll([chatOf('wf-a')])

    mountSignals({})

    expect(activity.chatStatusFor(tabA)).toBeUndefined()
  })

  it('marks a tab that is opened later and drops one that is closed', async () => {
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

  it('keeps the marks when the panel goes away', async () => {
    const activity = useWorkflowTabActivityStore()
    openTab(tabA)
    useAgentChatHistoryStore().replaceAll([chatOf('wf-a')])
    const { unmount } = mountSignals({ [tabA]: 'wf-a' })

    unmount()
    await nextTick()

    expect(activity.chatStatusFor(tabA)).toBe('seen')
  })
})
