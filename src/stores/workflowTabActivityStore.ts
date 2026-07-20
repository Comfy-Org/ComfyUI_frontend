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

    return {
      editingTabPath,
      creatingTab,
      unseenModifiedPaths,
      setEditing,
      setCreating,
      markModified,
      markSeen,
      pruneClosed
    }
  }
)
