import type { PageVisibilityMetadata } from '@comfyorg/telemetry/types'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

export function getPageVisibilityMetadata(
  visibility_state: PageVisibilityMetadata['visibility_state']
): PageVisibilityMetadata {
  return {
    visibility_state,
    agent_panel_open: useAgentPanelStore().isVisible
  }
}
