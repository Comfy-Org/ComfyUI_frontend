import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

export interface AgentTurnTab {
  path: string
  awaitingApproval: boolean
}

export type TabChatStatus = 'waiting' | 'in-progress' | 'unseen' | 'seen'

/**
 * Cross-feature workflow-tab activity, keyed by tab path. Feature extensions
 * (the agent panel) write it; the topbar reads it, so the topbar never has to
 * import feature internals.
 */
export const useWorkflowTabActivityStore = defineStore(
  'workflowTabActivity',
  () => {
    const agentTurnTabs = shallowRef<readonly AgentTurnTab[]>([])
    const creatingTab = ref(false)
    const unseenModifiedPaths = ref<Set<string>>(new Set())
    const chatPaths = shallowRef<ReadonlySet<string>>(new Set())

    const editingPaths = computed(
      () => new Set(agentTurnTabs.value.map(({ path }) => path))
    )
    const awaitingApprovalPaths = computed(
      () =>
        new Set(
          agentTurnTabs.value.flatMap(({ path, awaitingApproval }) =>
            awaitingApproval ? [path] : []
          )
        )
    )

    function setAgentTurnTabs(tabs: readonly AgentTurnTab[]): void {
      agentTurnTabs.value = tabs
    }

    function setCreating(creating: boolean): void {
      creatingTab.value = creating
    }

    function setChatPaths(paths: readonly string[]): void {
      const next = new Set(paths)
      const unchanged =
        next.size === chatPaths.value.size &&
        paths.every((path) => chatPaths.value.has(path))
      if (!unchanged) chatPaths.value = next
    }

    function markModified(path: string): void {
      unseenModifiedPaths.value.add(path)
    }

    function markSeen(path: string): void {
      unseenModifiedPaths.value.delete(path)
    }

    function pruneClosed(openPaths: string[]): void {
      const open = new Set(openPaths)
      for (const path of unseenModifiedPaths.value)
        if (!open.has(path)) unseenModifiedPaths.value.delete(path)
      setChatPaths([...chatPaths.value].filter((path) => open.has(path)))
    }

    function clearAgentActivity(): void {
      agentTurnTabs.value = []
      creatingTab.value = false
      unseenModifiedPaths.value.clear()
      chatPaths.value = new Set()
    }

    function chatStatusFor(path: string): TabChatStatus | undefined {
      if (awaitingApprovalPaths.value.has(path)) return 'waiting'
      if (editingPaths.value.has(path)) return 'in-progress'
      if (unseenModifiedPaths.value.has(path)) return 'unseen'
      if (chatPaths.value.has(path)) return 'seen'
      return undefined
    }

    return {
      editingPaths,
      awaitingApprovalPaths,
      creatingTab,
      unseenModifiedPaths,
      setAgentTurnTabs,
      setCreating,
      setChatPaths,
      markModified,
      markSeen,
      pruneClosed,
      clearAgentActivity,
      chatStatusFor
    }
  }
)
