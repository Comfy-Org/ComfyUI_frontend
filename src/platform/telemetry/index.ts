import type { TelemetryDispatcher } from './types'

export {
  AGENT_JOURNEY_SCHEMA_VERSION,
  getAgentJourneyEventName,
  serializeAgentJourneyEvent,
  supportsAgentJourneySchemaVersion
} from './agentJourneyEvent'
export type {
  AgentJourneyCorrelation,
  AgentJourneyEffectKind,
  AgentJourneyEffectOutcome,
  AgentJourneyEvent,
  AgentJourneyEventName,
  AgentJourneyRecoveryMode,
  AgentJourneyReleaseChannel,
  FrontendSemanticEffectEvent,
  SerializedAgentJourneyEvent
} from './agentJourneyEvent'

let _telemetryRegistry: TelemetryDispatcher | null = null

/**
 * Get the telemetry dispatcher for tracking events.
 * Returns null in OSS builds - all tracking calls become no-ops.
 *
 * Usage: useTelemetry()?.trackAuth({ method: 'google' })
 */
export function useTelemetry(): TelemetryDispatcher | null {
  return _telemetryRegistry
}

export function setTelemetryRegistry(
  registry: TelemetryDispatcher | null
): void {
  _telemetryRegistry = registry
}
