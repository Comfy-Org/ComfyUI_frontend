export const AGENT_JOURNEY_SCHEMA_VERSION = 1 as const

export type AgentJourneyEffectOutcome = 'observed'

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
  correlation: Readonly<{
    operation_ids: readonly string[]
    target_ref: string
    session_id?: string
    thread_id?: string
    turn_id?: string
    mutation_id?: string
    run_id?: string
  }>
  operation_count: number
  effect_kind: AgentJourneyEffectKind
  recovery_mode: AgentJourneyRecoveryMode
}>

export type AgentJourneyEventName =
  `agent.journey.frontend_semantic_effect.${AgentJourneyEffectOutcome}`

type MutableAgentJourneyCorrelation = {
  operation_ids: string[]
  target_ref: string
  session_id?: string
  thread_id?: string
  turn_id?: string
  mutation_id?: string
  run_id?: string
}

const EFFECT_EVENT_NAMES = {
  observed: 'agent.journey.frontend_semantic_effect.observed'
} as const satisfies Record<AgentJourneyEffectOutcome, AgentJourneyEventName>

const OPAQUE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/
const MAX_OPERATION_ID_BYTES = 128
const CANONICAL_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function isOpaqueIdentifier(value: string): boolean {
  return OPAQUE_IDENTIFIER_PATTERN.test(value)
}

function isValidOperationId(value: string): boolean {
  return (
    value.length > 0 &&
    new TextEncoder().encode(value).length <= MAX_OPERATION_ID_BYTES &&
    !/[\0\n\r\t]/.test(value)
  )
}

function isCanonicalTimestamp(value: string): boolean {
  if (!CANONICAL_TIMESTAMP_PATTERN.test(value)) return false
  const timestamp = Date.parse(value)
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  )
}

export function getAgentJourneyEventName(
  event: Readonly<{ outcome: unknown }>
): AgentJourneyEventName | null {
  if (event.outcome !== 'observed') return null
  return EFFECT_EVENT_NAMES[event.outcome]
}

export function serializeAgentJourneyEvent(
  event: AgentJourneyEvent
): SerializedAgentJourneyEvent | null {
  const operationIds = [...new Set(event.correlation.operation_ids)]
  if (
    operationIds.length === 0 ||
    !operationIds.every(isValidOperationId) ||
    !isOpaqueIdentifier(event.correlation.target_ref) ||
    !isCanonicalTimestamp(event.observed_at)
  ) {
    return null
  }

  const correlation: MutableAgentJourneyCorrelation = {
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
    if (value === undefined) continue
    if (!isOpaqueIdentifier(value)) return null
    correlation[key] = value
  }

  return {
    schema_version: AGENT_JOURNEY_SCHEMA_VERSION,
    stage: event.stage,
    outcome: event.outcome,
    observed_at: event.observed_at,
    release_channel: event.release_channel,
    correlation,
    operation_count: operationIds.length,
    effect_kind: event.effect_kind,
    recovery_mode: event.recovery_mode
  }
}

export function supportsAgentJourneySchemaVersion(
  value: unknown
): value is typeof AGENT_JOURNEY_SCHEMA_VERSION {
  return value === AGENT_JOURNEY_SCHEMA_VERSION
}
