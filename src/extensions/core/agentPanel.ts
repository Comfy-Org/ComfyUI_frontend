import { watchEffect } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useExtensionService } from '@/services/extensionService'

// The initTelemetry.ts idiom: the guard lives INSIDE the unconditionally
// retained function, and every agent-specific module is imported dynamically
// past it. OSS builds fold the guard, drop the dead remainder with its
// import() edges, and emit no agent code; cloud builds keep the shell inline
// in the core graph so a flag-off session fetches no separate gate chunk.
const IS_CLOUD_BUILD = __DISTRIBUTION__ === 'cloud'

export function registerAgentPanelExtension(): void {
  if (!IS_CLOUD_BUILD) return
  useExtensionService().registerExtension({
    name: 'Comfy.AgentPanel',
    setup() {
      // The service's per-extension catch owns a rejection here, so a
      // failed gate can never surface as an unhandled rejection.
      return setupFlagGate()
    }
  })
}

async function setupFlagGate(): Promise<void> {
  // The store chunk loads inside the guard (ad blockers eat these): any
  // failure fails closed instead of leaving the gate hanging.
  try {
    const { useAgentPanelStore } =
      await import('@/workbench/extensions/agent/stores/agentPanelStore')
    const agentPanelStore = useAgentPanelStore()
    const { flags } = useFeatureFlags()
    // Server-evaluated flag through the shared resolver: overrides win,
    // anonymous config fails closed, and only the authenticated /features
    // refresh can turn the panel on.
    watchEffect(() => {
      agentPanelStore.enabled = flags.agentPanelEnabled
    })
  } catch (error) {
    console.error('[Comfy.AgentPanel] feature-flag gate failed to load', error)
    try {
      const { reportError } = await import('@/platform/telemetry/reportError')
      reportError(error, { errorType: 'agent_flag_gate_load_failure' })
    } catch {
      // Telemetry chunk unavailable; the console line above already records it.
    }
  }
}
