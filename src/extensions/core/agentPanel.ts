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
      void setupFlagGate()
    }
  })
}

async function setupFlagGate(): Promise<void> {
  const [
    { useAgentPanelStore },
    { AGENT_PANEL_FLAG, FLAG_SETTLE_TIMEOUT_MS, createPostHogFlagSource },
    { getDevOverride },
    { reportError }
  ] = await Promise.all([
    import('@/workbench/extensions/agent/stores/agentPanelStore'),
    import('@/workbench/extensions/agent/utils/postHogFlagSource'),
    import('@/utils/devFeatureFlagOverride'),
    import('@/platform/telemetry/reportError')
  ])

  const agentPanelStore = useAgentPanelStore()

  // Force-enable BEFORE any posthog work (a blocked SDK load must not
  // take local dev down); the ff: override wins in both directions.
  if (import.meta.env.MODE === 'development') {
    agentPanelStore.enabled = getDevOverride<boolean>(AGENT_PANEL_FLAG) ?? true
  }

  const settle = (): void => {
    agentPanelStore.gateSettled = true
  }
  // Ad blockers eat this chunk: a failed load gates off, never rejects unhandled.
  try {
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
    // featureFlags exists from the PostHog constructor, so this survives
    // init() even when setup wins the race against telemetry's bootstrap;
    // the settle timeout covers a token-less config where init never runs.
    source.onChange?.(() => {
      sync()
      settle()
    })
    sync()
    setTimeout(settle, FLAG_SETTLE_TIMEOUT_MS)
  } catch (error) {
    console.error('[Comfy.AgentPanel] feature-flag gate failed to load', error)
    reportError(error, { errorType: 'agent_flag_gate_load_failure' })
    settle()
  }
}
