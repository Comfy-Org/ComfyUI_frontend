import type { PageVisibilityMetadata } from '@/platform/telemetry/types'

import { useAgentPanelStore } from '../stores/agent/agentPanelStore'

export function getPageVisibilityMetadata(
  visibility_state: PageVisibilityMetadata['visibility_state']
): PageVisibilityMetadata {
  return {
    visibility_state,
    agent_panel_open: useAgentPanelStore().isVisible
  }
}
