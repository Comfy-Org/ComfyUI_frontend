export const AGENT_JOURNEY_SCHEMA_VERSION = 1 as const

export type AgentJourneyEffectOutcome =
  | 'observed'
  | 'skipped'
  | 'failed'
  | 'superseded'
  | 'reverted'

export type AgentJourneyEffectKind =
  | 'node'
  | 'link'
  | 'widget'
  | 'subgraph'
  | 'mixed'
  | 'unknown'

export type AgentJourneyRecoveryMode =
  | 'live'
  | 'catch_up'
  | 'reconnect'
  | 'unknown'

export type AgentJourneyReleaseChannel =
  | 'cloud'
  | 'desktop'
  | 'local'
  | 'unknown'

export type AgentJourneyCorrelation = Readonly<{
  operation_ids: readonly string[]
  target_ref: string
  session_id?: string
  thread_id?: string
  turn_id?: string
  mutation_id?: string
  run_id?: string
}>

export type FrontendSemanticEffectEvent = Readonly<{
  stage: 'frontend_semantic_effect'
  outcome: AgentJourneyEffectOutcome
  observed_at: string
  release_channel: AgentJourneyReleaseChannel
  correlation: AgentJourneyCorrelation
  operation_count: number
  effect_kind: AgentJourneyEffectKind
  recovery_mode: AgentJourneyRecoveryMode
}>

export type AgentJourneyEvent = FrontendSemanticEffectEvent

export type SerializedAgentJourneyEvent = Readonly<{
  schema_version: typeof AGENT_JOURNEY_SCHEMA_VERSION
  stage: 'frontend_semantic_effect'
  outcome: AgentJourneyEffectOutcome
  observed_at: string
  release_channel: AgentJourneyReleaseChannel
  correlation: {
    operation_ids: string[]
    target_ref: string
    session_id?: string
    thread_id?: string
    turn_id?: string
    mutation_id?: string
    run_id?: string
  }
  operation_count: number
  effect_kind: AgentJourneyEffectKind
  recovery_mode: AgentJourneyRecoveryMode
}>

export type AgentJourneyEventName =
  `agent.journey.frontend_semantic_effect.${AgentJourneyEffectOutcome}`

const EFFECT_EVENT_NAMES = {
  observed: 'agent.journey.frontend_semantic_effect.observed',
  skipped: 'agent.journey.frontend_semantic_effect.skipped',
  failed: 'agent.journey.frontend_semantic_effect.failed',
  superseded: 'agent.journey.frontend_semantic_effect.superseded',
  reverted: 'agent.journey.frontend_semantic_effect.reverted'
} as const satisfies Record<AgentJourneyEffectOutcome, AgentJourneyEventName>

export function getAgentJourneyEventName(
  event: AgentJourneyEvent
): AgentJourneyEventName {
  return EFFECT_EVENT_NAMES[event.outcome]
}

export function serializeAgentJourneyEvent(
  event: AgentJourneyEvent
): SerializedAgentJourneyEvent | null {
  const operationIds = [...new Set(event.correlation.operation_ids)]
  if (operationIds.length === 0) {
    return null
  }

  const correlation: SerializedAgentJourneyEvent['correlation'] = {
    operation_ids: operationIds,
    target_ref: event.correlation.target_ref
  }
  const optionalKeys = [
    'session_id',
    'thread_id',
    'turn_id',
    'mutation_id',
    'run_id'
  ] as const
  for (const key of optionalKeys) {
    const value = event.correlation[key]
    if (value !== undefined) correlation[key] = value
  }

  return {
    schema_version: AGENT_JOURNEY_SCHEMA_VERSION,
    stage: event.stage,
    outcome: event.outcome,
    observed_at: event.observed_at,
    release_channel: event.release_channel,
    correlation,
    operation_count: event.operation_count,
    effect_kind: event.effect_kind,
    recovery_mode: event.recovery_mode
  }
}

export function supportsAgentJourneySchemaVersion(
  value: unknown
): value is typeof AGENT_JOURNEY_SCHEMA_VERSION {
  return value === AGENT_JOURNEY_SCHEMA_VERSION
}
