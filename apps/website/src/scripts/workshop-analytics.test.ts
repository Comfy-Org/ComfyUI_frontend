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

  it('reports only error field names declared by the form', () => {
    const failure = new WorkshopRouterError('validation', null, {
      size: 'incompatible',
      'private provider text': 'rejected'
    })
    expect(
      workshopFailureAnalytics(failure, [
        {
          kind: 'select',
          name: 'size',
          label: 'Size',
          options: ['2K']
        }
      ])
    ).toMatchObject({ field_error_names: ['size'] })
    expect(JSON.stringify(workshopFailureAnalytics(failure))).not.toContain(
      'private'
    )
  })

  it('captures the original exception with only application bundle locations', () => {
    const cause = new TypeError('Private prompt, filename.png and token=secret')
    cause.stack = [
      cause.toString(),
      '    at read (https://comfy.org/_website/ModelDetail.abc123.js:12:34)',
      'render@https://preview.example/_astro/run.def456.js?token=secret:56:78',
      '    at https://storage.example/private-image.png?token=secret:1:2',
      '    at /Users/customer/private-image.png:1:2',
      '    at https://third-party.example/sdk.js:1:2'
    ].join('\n')

    expect(
      workshopFailureAnalytics(
        new WorkshopRouterError('client', null, {}, undefined, undefined, {
          cause
        })
      )
    ).toEqual({
      reason: 'client',
      request_id: undefined,
      exception_name: 'TypeError',
      exception_frames: [
        '/_website/ModelDetail.abc123.js:12:34',
        '/_astro/run.def456.js:56:78'
      ]
    })
  })

  it.for(['NotReadableError', 'NotFoundError', 'SecurityError'])(
    'retains the browser exception type %s without its private message',
    (name) => {
      expect(
        workshopFailureAnalytics(
          new WorkshopRouterError('client', null, {}, undefined, undefined, {
            cause: new DOMException('Private filename.png', name)
          })
        )
      ).toEqual({
        reason: 'client',
        request_id: undefined,
        exception_name: name
      })
    }
  )

  it.for([
    { cause: 'private thrown string', name: 'NonError' },
    { cause: { message: 'private payload' }, name: 'NonError' },
    {
      cause: Object.assign(new Error('private'), {
        name: 'private error name'
      }),
      name: 'OtherError'
    }
  ])('bounds unexpected exceptions: $name', ({ cause, name }) => {
    expect(
      workshopFailureAnalytics(
        new WorkshopRouterError('client', null, {}, undefined, undefined, {
          cause
        })
      )
    ).toEqual({ reason: 'client', request_id: undefined, exception_name: name })
  })

  it('bounds the number of captured frames', () => {
    const cause = new Error('Private message')
    cause.stack = [
      cause.toString(),
      ...Array.from(
        { length: 30 },
        (_, i) => `    at https://comfy.org/_astro/run.abc.js:${i + 1}:1`
      )
    ].join('\n')
    expect(
      workshopFailureAnalytics(
        new WorkshopRouterError('client', null, {}, undefined, undefined, {
          cause
        })
      )
    ).toMatchObject({
      exception_frames: [1, 2, 3, 4, 5].map(
        (line) => `/_astro/run.abc.js:${line}:1`
      )
    })
  })

  it.for<{ label: string; properties: PropertyDescriptorMap }>([
    { label: 'missing', properties: {} },
    {
      label: 'non-string',
      properties: { stack: { value: { private: 'customer detail' } } }
    }
  ])(
    'retains exception type without leaking a $label stack',
    ({ properties }) => {
      const cause = new TypeError('Private message')
      delete cause.stack
      Object.defineProperties(cause, properties)

      expect(
        workshopFailureAnalytics(
          new WorkshopRouterError('client', null, {}, undefined, undefined, {
            cause
          })
        )
      ).toEqual({
        reason: 'client',
        request_id: undefined,
        exception_name: 'TypeError'
      })
    }
  )

  it('retains the first Firefox or Safari frame when the stack has no message line', () => {
    const cause = new TypeError('Private message')
    cause.stack =
      'read@https://comfy.org/_astro/run.abc.js:12:34\n@https://comfy.org/_astro/run.abc.js:56:78'
    expect(
      workshopFailureAnalytics(
        new WorkshopRouterError('client', null, {}, undefined, undefined, {
          cause
        })
      )
    ).toMatchObject({
      exception_frames: ['/_astro/run.abc.js:12:34', '/_astro/run.abc.js:56:78']
    })
  })
})
