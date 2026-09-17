import { describe, expect, it } from 'vitest'

import {
  AGENT_JOURNEY_SCHEMA_VERSION,
  getAgentJourneyEventName,
  serializeAgentJourneyEvent,
  supportsAgentJourneySchemaVersion
} from './agentJourneyEvent'
import type {
  AgentJourneyEffectOutcome,
  FrontendSemanticEffectEvent
} from './agentJourneyEvent'

const baseEvent: FrontendSemanticEffectEvent = {
  stage: 'frontend_semantic_effect',
  outcome: 'observed',
  observed_at: '2026-09-17T23:30:00.000Z',
  release_channel: 'cloud',
  correlation: {
    operation_ids: ['op-1'],
    target_ref: 'rotating-target-ref'
  },
  operation_count: 1,
  effect_kind: 'node',
  recovery_mode: 'live'
}

describe('agent journey effect contract', () => {
  it.for<readonly [string, AgentJourneyEffectOutcome, string]>([
    [
      'maps observed to its stable event name',
      'observed',
      'agent.journey.frontend_semantic_effect.observed'
    ],
    [
      'maps skipped to its stable event name',
      'skipped',
      'agent.journey.frontend_semantic_effect.skipped'
    ],
    [
      'maps failed to its stable event name',
      'failed',
      'agent.journey.frontend_semantic_effect.failed'
    ],
    [
      'maps superseded to its stable event name',
      'superseded',
      'agent.journey.frontend_semantic_effect.superseded'
    ],
    [
      'maps reverted to its stable event name',
      'reverted',
      'agent.journey.frontend_semantic_effect.reverted'
    ]
  ])('%s', ([, outcome, expected]) => {
    expect(getAgentJourneyEventName({ ...baseEvent, outcome })).toBe(expected)
  })

  it('serializes the allowlisted version-one golden vector', () => {
    expect(serializeAgentJourneyEvent(baseEvent)).toEqual({
      schema_version: 1,
      stage: 'frontend_semantic_effect',
      outcome: 'observed',
      observed_at: '2026-09-17T23:30:00.000Z',
      release_channel: 'cloud',
      correlation: {
        operation_ids: ['op-1'],
        target_ref: 'rotating-target-ref'
      },
      operation_count: 1,
      effect_kind: 'node',
      recovery_mode: 'live'
    })
  })

  it('deduplicates operation IDs without mutating the input', () => {
    const operationIds = ['op-2', 'op-1', 'op-2']
    const serialized = serializeAgentJourneyEvent({
      ...baseEvent,
      correlation: { ...baseEvent.correlation, operation_ids: operationIds }
    })

    expect(serialized?.correlation.operation_ids).toEqual(['op-2', 'op-1'])
    expect(operationIds).toEqual(['op-2', 'op-1', 'op-2'])
  })

  it('fails closed without a creator-provided operation ID', () => {
    expect(
      serializeAgentJourneyEvent({
        ...baseEvent,
        correlation: { ...baseEvent.correlation, operation_ids: [] }
      })
    ).toBeNull()
  })

  it('omits unavailable optional correlation instead of fabricating it', () => {
    const serialized = serializeAgentJourneyEvent(baseEvent)

    expect(serialized?.correlation).not.toHaveProperty('turn_id')
    expect(serialized?.correlation).not.toHaveProperty('thread_id')
  })

  it('copies only allowlisted fields from structurally wider input', () => {
    const event = {
      ...baseEvent,
      prompt: 'forbidden',
      workflow_json: { forbidden: true },
      email: 'forbidden@example.com',
      raw_error: new Error('forbidden')
    }

    expect(JSON.stringify(serializeAgentJourneyEvent(event))).not.toMatch(
      /prompt|workflow_json|email|raw_error|forbidden/
    )
  })

  it('fails closed on unsupported schema versions', () => {
    expect(
      supportsAgentJourneySchemaVersion(AGENT_JOURNEY_SCHEMA_VERSION)
    ).toBe(true)
    expect(supportsAgentJourneySchemaVersion(2)).toBe(false)
    expect(supportsAgentJourneySchemaVersion('1')).toBe(false)
  })
})
