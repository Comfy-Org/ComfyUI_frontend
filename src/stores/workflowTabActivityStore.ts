import { defineStore } from 'pinia'
import { ref } from 'vue'

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
    /**
     * Whether a turn is live, regardless of which tab it can be attributed to.
     * `editingTabPath` drives the per-tab spinner and stays null for a turn the
     * panel cannot pin to a tab, so the canvas cannot read activity from it.
     */
    const agentRunning = ref(false)

    function setEditing(path: string | null): void {
      editingTabPath.value = path
    }

    function setAgentRunning(running: boolean): void {
      agentRunning.value = running
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
      agentRunning.value = false
      creatingTab.value = false
      unseenModifiedPaths.value.clear()
    }

    return {
      editingTabPath,
      creatingTab,
      unseenModifiedPaths,
      agentRunning,
      setEditing,
      setAgentRunning,
      setCreating,
      markModified,
      markSeen,
      pruneClosed,
      clearAgentActivity
    }
  }
)
