import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import {
  AGENT_PANEL_FLAG,
  createPostHogFlagSource
} from '@/workbench/extensions/agent/composables/agent/useAgentFeatureGate'
import { useExtensionService } from '@/services/extensionService'

export const FLAG_RETRY_INTERVAL_MS = 500
export const FLAG_RETRY_LIMIT = 10

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
        let flagsDelivered = false
        const deliver = (): void => {
          flagsDelivered = true
          sync()
        }
        let unsubscribe = source.onChange?.(deliver)
        sync()

        // Telemetry inits posthog from its own non-awaited import; if this
        // setup wins that race, the subscription above landed on an
        // uninitialized singleton whose unsubscribe is dead and which never
        // delivers flags. Readiness cannot be inferred from the flag's own
        // value (posthog drops false-valued bootstrap flags and returns
        // undefined for an absent key), so: settle as soon as a flags
        // delivery is observed or the flag reads a definite value; otherwise
        // poll briefly - the budget only covers telemetry's init window -
        // and on exhaustion RE-TAKE the subscription against the by-now
        // likely live instance, so a flag arriving later in the session
        // still propagates, then settle fail-closed.
        const retakeSubscription = (): void => {
          unsubscribe?.()
          unsubscribe = source.onChange?.(deliver)
        }
        let retries = 0
        const retry = (): void => {
          const resolved =
            flagsDelivered ||
            posthog.isFeatureEnabled(AGENT_PANEL_FLAG) !== undefined
          if (resolved || retries >= FLAG_RETRY_LIMIT) {
            if (!flagsDelivered) retakeSubscription()
            sync()
            markGateSettled()
            return
          }
          retries++
          setTimeout(retry, FLAG_RETRY_INTERVAL_MS)
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
