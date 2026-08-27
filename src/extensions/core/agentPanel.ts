import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import {
  AGENT_PANEL_FLAG,
  createPostHogFlagSource
} from '@/workbench/extensions/agent/composables/agent/useAgentFeatureGate'
import { useExtensionService } from '@/services/extensionService'

const FLAG_RETRY_INTERVAL_MS = 2000
const FLAG_RETRY_LIMIT = 15

function markGateSettled(): void {
  document.body.dataset.agentGateSettled = 'true'
}

useExtensionService().registerExtension({
  name: 'Comfy.AgentPanel',
  setup() {
    const agentPanelStore = useAgentPanelStore()

    // Dev builds force-enable BEFORE any posthog work so a blocked SDK load
    // cannot take local development down with it.
    if (import.meta.env.MODE === 'development') {
      agentPanelStore.enabled = true
    }

    async function setupFlagGate(): Promise<void> {
      // posthog-js is a lazy chunk and is commonly blocked by ad blockers; a failed
      // load must leave the panel gated off rather than surface as an unhandled rejection.
      try {
        const posthog = (await import('posthog-js')).default
        const source = createPostHogFlagSource(posthog)
        const sync = (): void => {
          const forceInDev = import.meta.env.MODE === 'development'
          agentPanelStore.enabled = forceInDev || source.isEnabled()
        }
        source.onChange?.(sync)
        sync()

        // Telemetry inits posthog from its own non-awaited import; if this
        // setup wins that race, the subscription above landed on an
        // uninitialized singleton whose unsubscribe is dead and which never
        // delivers flags. `isFeatureEnabled` stays undefined until flags
        // actually resolve, so poll boundedly and re-take the subscription
        // once they have.
        let retries = 0
        const retry = (): void => {
          if (posthog.isFeatureEnabled(AGENT_PANEL_FLAG) !== undefined) {
            source.onChange?.(sync)
            sync()
            markGateSettled()
            return
          }
          if (retries++ < FLAG_RETRY_LIMIT) {
            setTimeout(retry, FLAG_RETRY_INTERVAL_MS)
          } else {
            markGateSettled()
          }
        }
        retry()
      } catch (error) {
        console.error(
          '[Comfy.AgentPanel] feature-flag gate failed to load',
          error
        )
        markGateSettled()
      }
    }

    void setupFlagGate()
  }
})
