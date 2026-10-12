import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

interface AgentTabChat {
  id: string
  title: string
  updatedAt: number
}

/** Opens a listed chat, or a new chat on the tab when `chatId` is null. */
type AgentTabChatOpener = (tabPath: string, chatId: string | null) => void

/**
 * Cross-feature workflow-tab activity, keyed by tab path. Feature extensions
 * (the agent panel) write it; the topbar reads it, so the topbar never has to
 * import feature internals.
 */
export const useWorkflowTabActivityStore = defineStore(
  'workflowTabActivity',
  () => {
    const editingTabPath = ref<string | null>(null)
    const creatingTab = ref(false)
    const unseenModifiedPaths = ref<Set<string>>(new Set())
    const agentChatsByPath = shallowRef<
      ReadonlyMap<string, readonly AgentTabChat[]>
    >(new Map())
    let agentChatOpener: AgentTabChatOpener | null = null

    function setAgentChats(
      chats: ReadonlyMap<string, readonly AgentTabChat[]>,
      opener: AgentTabChatOpener
    ): void {
      agentChatsByPath.value = chats
      agentChatOpener = opener
    }

    function clearAgentChats(): void {
      agentChatsByPath.value = new Map()
      agentChatOpener = null
    }

    function openAgentChat(tabPath: string, chatId: string | null): void {
      agentChatOpener?.(tabPath, chatId)
    }

    function setEditing(path: string | null): void {
      editingTabPath.value = path
    }

    function setCreating(creating: boolean): void {
      creatingTab.value = creating
    }

    function markModified(path: string): void {
      unseenModifiedPaths.value.add(path)
    }

    function markSeen(path: string): void {
      unseenModifiedPaths.value.delete(path)
    }

    function pruneClosed(openPaths: string[]): void {
      const open = new Set(openPaths)
      if (editingTabPath.value !== null && !open.has(editingTabPath.value))
        editingTabPath.value = null
      for (const path of unseenModifiedPaths.value)
        if (!open.has(path)) unseenModifiedPaths.value.delete(path)
    }

    function clearAgentActivity(): void {
      editingTabPath.value = null
      creatingTab.value = false
      unseenModifiedPaths.value.clear()
    }

    return {
      editingTabPath,
      creatingTab,
      unseenModifiedPaths,
      agentChatsByPath,
      setAgentChats,
      clearAgentChats,
      openAgentChat,
      setEditing,
      setCreating,
      markModified,
      markSeen,
      pruneClosed,
      clearAgentActivity
    }
  }
)
