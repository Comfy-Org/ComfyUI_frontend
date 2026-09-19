import { defineStore } from 'pinia'
import { toRaw } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

/**
 * Which open tabs workflow persistence recreated from persisted drafts on
 * this load. Scratch tabs share one default path, so a path alone cannot
 * tell a restored draft from a blank tab that landed on the same name;
 * consumers that reconnect per-tab state across a reload key off this mark.
 */
export const useRestoredWorkflowTabStore = defineStore(
  'restoredWorkflowTab',
  () => {
    const restored = new WeakSet<ComfyWorkflow>()

    function markRestored(workflow: ComfyWorkflow): void {
      restored.add(toRaw(workflow))
    }

    function wasRestored(workflow: ComfyWorkflow): boolean {
      return restored.has(toRaw(workflow))
    }

    return { markRestored, wasRestored }
  }
)
