import type { Component, ComputedRef } from 'vue'
import { computed, defineAsyncComponent } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'

interface AgentDockMount {
  mounted: ComputedRef<boolean>
  DockedAgentPanel: Component | null
}

/**
 * The one distribution seam for the Agent runtime mount. A compact canvas
 * turn mounts the same runtime as the full dock, but DockedAgentPanel keeps
 * its visual shell hidden until the user explicitly opens it.
 *
 * The literal comparison is
 * what dead-code-eliminates the store and both panel component chunks from
 * OSS builds. Development keeps the mounts available for local Agent UI
 * testing; production only requests the async chunks in the cloud build.
 */
export function useAgentDockMount(): AgentDockMount {
  if (__DISTRIBUTION__ !== 'cloud' && import.meta.env.MODE !== 'development') {
    return { mounted: computed(() => false), DockedAgentPanel: null }
  }
  const agentPanelStore = useAgentPanelStore()
  const agentComposerStore = useAgentComposerStore()
  return {
    mounted: computed(
      () =>
        agentPanelStore.enabled &&
        (agentPanelStore.isOpen ||
          agentComposerStore.compactSessionPhase !== 'idle' ||
          agentComposerStore.hasPendingAttachmentWork)
    ),
    DockedAgentPanel: defineAsyncComponent(
      () => import('../components/agent/DockedAgentPanel.vue')
    )
  }
}
