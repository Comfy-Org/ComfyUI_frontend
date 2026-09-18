import { describe, expect, it } from 'vitest'

import {
  AGENT_JOURNEY_SCHEMA_VERSION,
  getAgentJourneyEventName,
  serializeAgentJourneyEvent,
  supportsAgentJourneySchemaVersion
} from './agentJourneyEvent'
import type { FrontendSemanticEffectEvent } from './agentJourneyEvent'

const baseEvent: FrontendSemanticEffectEvent = {
  stage: 'frontend_semantic_effect',
  outcome: 'observed',
  observed_at: '2026-09-17T23:30:00.000Z',
  release_channel: 'cloud',
  correlation: {
    operation_ids: ['op-1'],
    target_ref: 'rotating-target-ref'
  },
  effect_kind: 'node',
  recovery_mode: 'live'
}

describe('agent journey effect contract', () => {
  it('maps observed to its stable event name', () => {
    expect(getAgentJourneyEventName(baseEvent)).toBe(
      'agent.journey.frontend_semantic_effect.observed'
    )
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
    expect(serialized?.operation_count).toBe(2)
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

  it.for([
    ['email in target_ref', 'target_ref', 'person@example.com'],
    ['URL in target_ref', 'target_ref', 'https://example.com/workflow/1'],
    ['context in target_ref', 'target_ref', 'workflow with arbitrary context'],
    ['email in session_id', 'session_id', 'person@example.com'],
    ['URL in thread_id', 'thread_id', 'https://example.com/workflow/1'],
    ['context in turn_id', 'turn_id', 'workflow with arbitrary context'],
    ['email in mutation_id', 'mutation_id', 'person@example.com'],
    ['URL in run_id', 'run_id', 'https://example.com/workflow/1']
  ] as const)('rejects %s', ([, key, value]) => {
    const correlation = { ...baseEvent.correlation, [key]: value }

    expect(serializeAgentJourneyEvent({ ...baseEvent, correlation })).toBeNull()
  })

  it.for([
    ['periods', 'agent.op.123'],
    ['namespaces', 'agent:abc'],
    ['leading punctuation', '_leading'],
    ['spaces', 'op 1'],
    ['Unicode', '오퍼레이션']
  ] as const)('accepts host-valid operation IDs with %s', ([, operationId]) => {
    const serialized = serializeAgentJourneyEvent({
      ...baseEvent,
      correlation: { ...baseEvent.correlation, operation_ids: [operationId] }
    })

    expect(serialized?.correlation.operation_ids).toEqual([operationId])
  })

  it.for([
    ['empty', ''],
    ['tab', 'op\t1'],
    ['newline', 'op\n1'],
    ['over 128 UTF-8 bytes', '오'.repeat(43)]
  ] as const)('rejects %s operation IDs', ([, operationId]) => {
    expect(
      serializeAgentJourneyEvent({
        ...baseEvent,
        correlation: { ...baseEvent.correlation, operation_ids: [operationId] }
      })
    ).toBeNull()
  })

  it.for([
    ['email', 'person@example.com'],
    ['URL', 'https://example.com/workflow/1'],
    ['noncanonical timestamp', '2026-09-17T23:30:00Z'],
    ['invalid date', '2026-02-30T23:30:00.000Z']
  ] as const)('rejects %s in observed_at', ([, observedAt]) => {
    expect(
      serializeAgentJourneyEvent({ ...baseEvent, observed_at: observedAt })
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
