import { computed } from 'vue'

import type { AskAgentPort } from '@/platform/workflowErrors/askAgentPort'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { useAskAgentAboutIssues } from './useAskAgentAboutIssues'
export function createAskAgentPort(): AskAgentPort {
  return {
    canAskAgent: computed(() => useAgentPanelStore().enabled),
    askAgentAboutIssues: (context) =>
      useAskAgentAboutIssues().askAgentAboutIssues(context)
  }
}
