import { describe, expect, it } from 'vitest'

import { getBillingTelemetryEventPayload } from './types'

describe('the web handoff event payload', () => {
  it.for([
    {
      name: 'an opened tab with a click-time source',
      result: 'opened',
      source: 'agent_paywall',
      reported: { payment_intent_source: 'agent_paywall' }
    },
    {
      name: 'a blocked tab with no source',
      result: 'blocked',
      source: undefined,
      reported: {}
    }
  ] as const)(
    "keeps the handoff's intent, result, journey and source for $name",
    ({ result, source, reported }) => {
      expect(
        getBillingTelemetryEventPayload({
          operation: 'web_handoff',
          stage: 'opened',
          outcome: 'pending',
          intent: 'checkout',
          result,
          payment_intent_source: source,
          correlation_id: 'journey-1'
        })
      ).toStrictEqual({
        operation: 'web_handoff',
        stage: 'opened',
        outcome: 'pending',
        intent: 'checkout',
        result,
        correlation_id: 'journey-1',
        ...reported
      })
    }
  )
})
