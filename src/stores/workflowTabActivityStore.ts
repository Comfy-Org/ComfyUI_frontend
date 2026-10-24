import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

export interface AgentTurnTab {
  path: string
  awaitingApproval: boolean
}

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
    }

    function clearAgentActivity(): void {
      agentTurnTabs.value = []
      creatingTab.value = false
      unseenModifiedPaths.value.clear()
    }

    return {
      editingPaths,
      awaitingApprovalPaths,
      creatingTab,
      unseenModifiedPaths,
      setAgentTurnTabs,
      setCreating,
      markModified,
      markSeen,
      pruneClosed,
      clearAgentActivity
    }
  }
)
