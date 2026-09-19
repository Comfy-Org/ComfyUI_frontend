import { describe, expect, it } from 'vitest'

import {
  WorkshopRouterError,
  workshopResponseDetails
} from '../config/workshop-router-errors'
import {
  workshopFailureAnalytics,
  workshopRouterErrorType
} from './workshop-analytics'

describe('Workshop failure analytics', () => {
  it.for([
    'concurrency_limit_exceeded',
    'rate_limit_exceeded',
    'invalid_input',
    'content_policy_violation',
    'deadline_exceeded',
    'forbidden',
    'insufficient_credits',
    'not_enabled',
    'provider_error',
    'provider_timeout'
  ])('retains the known Router error %s', (errorType) => {
    expect(workshopRouterErrorType(errorType)).toBe(errorType)
  })

  it.for([undefined, null, '', 'constructor', '__proto__', 'private detail'])(
    'omits unknown Router error %s',
    (errorType) => {
      expect(workshopRouterErrorType(errorType)).toBeUndefined()
    }
  )

  it('publishes bounded failure details without field names or response bodies', () => {
    const failure = new WorkshopRouterError(
      'upload',
      'request-id',
      { private_field: 'uploadFailed', another_private_field: 'uploadFailed' },
      workshopResponseDetails(
        new Response(null, {
          status: 403,
          headers: { 'X-Comfy-Error-Type': 'forbidden' }
        }),
        'private provider response'
      ),
      'upload_put'
    )

    expect(workshopFailureAnalytics(failure)).toEqual({
      reason: 'upload',
      request_id: 'request-id',
      http_status: 403,
      router_error_type: 'forbidden',
      failure_stage: 'upload_put',
      field_error_codes: ['uploadFailed']
    })
  })

  it('omits unavailable optional diagnostics', () => {
    expect(workshopFailureAnalytics(new WorkshopRouterError('client'))).toEqual(
      {
        reason: 'client',
        request_id: undefined
      }
    )
  })
})
