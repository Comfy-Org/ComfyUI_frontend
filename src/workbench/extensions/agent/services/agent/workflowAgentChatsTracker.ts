import { useEventListener } from '@vueuse/core'
import { computed, effectScope, watch } from 'vue'
import type { Ref } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import type { ChatSession } from '../../stores/agent/agentChatHistoryStore'
import { useAgentChatHistoryStore } from '../../stores/agent/agentChatHistoryStore'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentPanelStore } from '../../stores/agent/agentPanelStore'
import { useAgentWorkflowChatsStore } from '../../stores/agent/agentWorkflowChatsStore'

export const FOCUS_REFRESH_INTERVAL_MS = 30_000

/**
 * Keeps each workflow's agent chats current for workflow tabs and Workflows
 * sidebar rows, whether or not the panel is open. Registered once from the
 * extension setup; makes no requests while `available` is false.
 */
export function registerWorkflowAgentChatsTracker(
  available: Readonly<Ref<boolean>>
): () => void {
  const scope = effectScope(true)
  scope.run(() => {
    const workflowChats = useAgentWorkflowChatsStore()
    const { resolver } = workflowChats
    const history = useAgentChatHistoryStore()
    const conversation = useAgentConversationStore()
    const panel = useAgentPanelStore()
    const workflowStore = useWorkflowStore()
    const tabActivity = useWorkflowTabActivityStore()

    let loadingChats = false
    let chatReadsRequested = 0

    // One background read at a time; a trigger during it reads once more after.
    async function refreshChats(): Promise<void> {
      chatReadsRequested++
      if (loadingChats) return
      loadingChats = true
      try {
        let readsHandled: number
        do {
          readsHandled = chatReadsRequested
          const result = await workflowChats.loadChats()
          if (!result.ok)
            reportError(result.error, {
              surface: 'agent',
              errorType: 'agent_thread_list_load_failed'
            })
        } while (readsHandled !== chatReadsRequested && available.value)
      } finally {
        loadingChats = false
      }
    }

    let lastFullRefreshAt = -Infinity
    function refreshAll(): void {
      lastFullRefreshAt = Date.now()
      void resolver.refreshCloudWorkflowIds()
      void refreshChats()
    }

    watch(
      available,
      (isAvailable) => {
        if (isAvailable) refreshAll()
      },
      { immediate: true }
    )

    useEventListener(window, 'focus', () => {
      if (
        available.value &&
        Date.now() - lastFullRefreshAt >= FOCUS_REFRESH_INTERVAL_MS
      )
        refreshAll()
    })

    // A chat being opened reads the list itself once it has loaded.
    watch(
      [() => workflowStore.activeWorkflow?.path, () => conversation.threadId],
      () => {
        const viewed = workflowStore.activeWorkflow
        if (
          !available.value ||
          !viewed ||
          resolver.cloudIdFor(viewed) === undefined ||
          panel.selectingChat
        )
          return
        void refreshChats()
      }
    )

    // Names match chats to saved workflows, so a new or changed name needs a
    // fresh Cloud index.
    workflowStore.$onAction(({ name, args, after }) => {
      if (name !== 'renameWorkflow' && name !== 'saveWorkflow') return
      if (name === 'saveWorkflow' && !args[0].isTemporary) return
      after(() => {
        if (available.value) void resolver.refreshCloudWorkflowIds()
      })
    })

    const chatsByPath = computed(() => {
      const chats = new Map<string, ChatSession[]>()
      if (!available.value) return chats
      const currentChatId = conversation.threadId
      for (const [path, workflowId] of resolver.cloudIdsByPath.value) {
        const listed = (
          history.sessionsByWorkflow.get(workflowId) ?? []
        ).filter(({ id }) => id !== currentChatId)
        if (listed.length) chats.set(path, listed)
      }
      return chats
    })

    watch(
      chatsByPath,
      (chats) => tabActivity.setAgentChats(chats, workflowChats.openChat),
      { immediate: true }
    )
  })
  return () => scope.stop()
}
