import { describe, expect, it } from 'vitest'

import {
  WorkshopRouterError,
  workshopResponseDetails,
  workshopRunMayStillSettle
} from './workshop-router-errors'

const timeoutResponse = workshopResponseDetails(
  new Response(null, {
    status: 504,
    headers: { 'X-Comfy-Error-Type': 'deadline_exceeded' }
  })
)

describe('Workshop Router retry safety', () => {
  it.for([
    {
      name: 'an interrupted request',
      failure: new WorkshopRouterError('network'),
      expected: true
    },
    {
      name: 'a response-stage timeout',
      failure: new WorkshopRouterError(
        'timeout',
        'request-id',
        {},
        timeoutResponse,
        'response'
      ),
      expected: true
    },
    {
      name: 'a terminal request-stage timeout',
      failure: new WorkshopRouterError(
        'timeout',
        'request-id',
        {},
        timeoutResponse,
        'request'
      ),
      expected: false
    },
    {
      name: 'an admitted run with an inconclusive polling failure',
      failure: new WorkshopRouterError(
        'provider',
        'request-id',
        {},
        undefined,
        'request',
        { requestSettlement: 'pending' }
      ),
      expected: true
    },
    {
      name: 'a stored cancellation',
      failure: new WorkshopRouterError(
        'conflict',
        'request-id',
        {},
        undefined,
        'request',
        { requestSettlement: 'terminal' }
      ),
      expected: false
    },
    {
      name: 'a provider refusal without an admitted queue run',
      failure: new WorkshopRouterError('provider'),
      expected: false
    }
  ])('$name remains recoverable: $expected', ({ failure, expected }) => {
    expect(workshopRunMayStillSettle(failure)).toBe(expected)
  })
})
