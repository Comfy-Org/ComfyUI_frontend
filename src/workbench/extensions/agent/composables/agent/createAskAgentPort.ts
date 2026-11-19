import { computed } from 'vue'

import type { AskAgentPort } from '@/platform/workflowErrors/askAgentPort'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { useAskAgentAboutIssues } from './useAskAgentAboutIssues'
/**
 * The port for `App` to provide, resolving the handoff only when it is used.
 *
 * Constructing it eagerly pulls in the consent composable, which creates the
 * composer store, which binds its draft to `getWorkspaceId()` once at creation.
 * At `app.mount()` the workspace gate under `router-view` has not written that
 * yet, so an eager port leaves a team workspace on the `personal` draft key for
 * the whole session. Keep this lazy.
 */
export function createAskAgentPort(): AskAgentPort {
  return {
    canAskAgent: computed(() => useAgentPanelStore().enabled),
    askAgentAboutIssues: (context) =>
      useAskAgentAboutIssues().askAgentAboutIssues(context)
  }
}
