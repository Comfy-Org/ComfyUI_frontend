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
  const { useAgentPanelStore } =
    await import('@/workbench/extensions/agent/stores/agentPanelStore')
  const agentPanelStore = useAgentPanelStore()
  const settle = (): void => {
    agentPanelStore.gateSettled = true
  }

  // Every remaining chunk loads inside the guard (ad blockers eat these):
  // any failure settles fail-closed instead of leaving the gate hanging.
  try {
    const [
      { AGENT_PANEL_FLAG, FLAG_SETTLE_TIMEOUT_MS, createPostHogFlagSource },
      { getDevOverride }
    ] = await Promise.all([
      import('@/workbench/extensions/agent/utils/postHogFlagSource'),
      import('@/utils/devFeatureFlagOverride')
    ])

    // Force-enable BEFORE any posthog work (a blocked SDK load must not
    // take local dev down); the ff: override wins in both directions.
    if (import.meta.env.MODE === 'development') {
      agentPanelStore.enabled =
        getDevOverride<boolean>(AGENT_PANEL_FLAG) ?? true
    }

    const posthog = (await import('posthog-js')).default
    const source = createPostHogFlagSource(posthog)
    const sync = (): void => {
      const devOverride =
        import.meta.env.MODE === 'development'
          ? getDevOverride<boolean>(AGENT_PANEL_FLAG)
          : undefined
      const forceInDev = import.meta.env.MODE === 'development'
      agentPanelStore.enabled =
        devOverride ?? (forceInDev || source.isEnabled())
    }
    // Production waits for the first non-error delivery (the source drops
    // errorsLoading callbacks): posthog persists flags in localStorage, so
    // reading before delivery would let a stale true mount the panel and
    // fetch agent chunks across a flag-off boundary. Dev stays immediate.
    source.onChange?.(() => {
      sync()
      settle()
    })
    if (import.meta.env.MODE === 'development') sync()
    setTimeout(settle, FLAG_SETTLE_TIMEOUT_MS)
  } catch (error) {
    console.error('[Comfy.AgentPanel] feature-flag gate failed to load', error)
    settle()
    try {
      const { reportError } = await import('@/platform/telemetry/reportError')
      reportError(error, { errorType: 'agent_flag_gate_load_failure' })
    } catch {
      // Telemetry chunk unavailable; the console line above already records it.
    }
  }
}
