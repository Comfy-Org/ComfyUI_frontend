import { describe, expect, it } from 'vitest'

import type {
  WorkshopAnalyticsEvent,
  WorkshopRunAnalytics
} from './workshop-analytics'
import { workshopHealthLog } from './workshop-health'
import {
  redactWorkshopLog,
  workshopDatadogEnvironment
} from './workshop-datadog'
import type { LogsEvent } from '@datadog/browser-logs'
import { WorkshopRouterError } from '../config/workshop-router-errors'
import { workshopFailureAnalytics } from './workshop-analytics'

const run: WorkshopRunAnalytics = {
  model_slug: 'vertexai--gemini-nano-banana-2--generate-images',
  router_id: 'vertexai/gemini-nano-banana-2',
  provider: 'Google',
  modality: 'image',
  attempt_id: '36a356b0-05f9-4d7b-9c5f-41e06a7c42e4',
  user_id: 'private-user',
  workspace_id: 'private-workspace'
}

type FailedRun = Extract<
  Extract<WorkshopAnalyticsEvent, { name: 'run_finished' }>['properties'],
  { status: 'failed' }
>
type FailureDetails = Pick<FailedRun, 'reason'> &
  Partial<
    Omit<
      FailedRun,
      keyof WorkshopRunAnalytics | 'status' | 'duration_ms' | 'reason'
    >
  >

describe('Workshop health', () => {
  it('preserves declared field names for validation diagnostics', () => {
    expect(
      workshopHealthLog({
        name: 'run_validation_failed',
        properties: {
          model_slug: run.model_slug,
          field_error_names: ['first_frame'],
          field_error_codes: ['required']
        }
      })
    ).toMatchObject({
      field_error_names: ['first_frame'],
      field_error_codes: ['required'],
      failure_type: 'validation'
    })
  })
  it.for([
    { reason: 'response' as const, expected: 'failure' },
    { reason: 'upload' as const, expected: 'failure' },
    { reason: 'provider' as const, expected: 'failure' },
    { reason: 'validation' as const, expected: 'failure' },
    { reason: 'policy' as const, expected: 'excluded' },
    { reason: 'noCredits' as const, expected: 'excluded' },
    { reason: 'concurrency' as const, expected: 'excluded' }
  ])(
    'classifies $reason separately for service paging',
    ({ reason, expected }) => {
      expect(
        workshopHealthLog({
          name: 'run_finished',
          properties: { ...run, status: 'failed', reason, duration_ms: 10 }
        })
      ).toMatchObject({ service_health: expected, failure_type: reason })
    }
  )

  it.for([
    {
      name: 'local credential refusal without a Router request',
      failure: { reason: 'unavailable', failure_stage: 'credential' },
      expected: 'excluded'
    },
    {
      name: 'Router HTTP 401',
      failure: { reason: 'unavailable', http_status: 401 },
      expected: 'excluded'
    },
    {
      name: 'Router HTTP 403',
      failure: { reason: 'unavailable', http_status: 403 },
      expected: 'excluded'
    },
    {
      name: 'Router forbidden',
      failure: { reason: 'unavailable', router_error_type: 'forbidden' },
      expected: 'excluded'
    },
    {
      name: 'Router not enabled',
      failure: { reason: 'unavailable', router_error_type: 'not_enabled' },
      expected: 'excluded'
    },
    {
      name: 'missing Router endpoint',
      failure: { reason: 'unavailable', http_status: 404 },
      expected: 'failure'
    },
    {
      name: 'unavailability without account-refusal metadata',
      failure: { reason: 'unavailable' },
      expected: 'failure'
    },
    {
      name: 'storage upload forbidden',
      failure: {
        reason: 'upload',
        http_status: 403,
        failure_stage: 'upload_put'
      },
      expected: 'failure'
    }
  ] as const)('classifies $name for paging', ({ failure, expected }) => {
    expect(
      workshopHealthLog({
        name: 'run_finished',
        properties: {
          ...run,
          status: 'failed',
          duration_ms: 10,
          ...failure
        }
      })?.service_health
    ).toBe(expected)
  })

  it('does not call an HTTP 200 a delivered image', () => {
    const event: WorkshopAnalyticsEvent = {
      name: 'run_finished',
      properties: {
        ...run,
        status: 'succeeded',
        duration_ms: 20,
        output_count: 1,
        request_id: 'router-request'
      }
    }
    const record = workshopHealthLog(event)
    expect(record).toMatchObject({
      service_health: 'pending',
      client_attempt_id: run.attempt_id,
      request_id: 'router-request'
    })
    expect(record).not.toHaveProperty('failure_type')
    expect(record).not.toHaveProperty('reason')
    expect(JSON.stringify(record)).not.toMatch(/private-user|private-workspace/)
  })

  it('excludes a cancelled run without assigning a failure type', () => {
    const record = workshopHealthLog({
      name: 'run_finished',
      properties: {
        ...run,
        status: 'cancelled',
        duration_ms: 10
      }
    })

    expect(record).toMatchObject({ service_health: 'excluded' })
    expect(record).not.toHaveProperty('failure_type')
  })

  it('retains sanitized client diagnostics without private exception text', () => {
    const cause = new DOMException('private filename.png', 'NotReadableError')
    Object.defineProperty(cause, 'stack', {
      value: [
        cause.toString(),
        '    at read (https://comfy.org/_website/ModelDetail.abc.js?token=private:12:34)',
        '    at https://storage.example/private.png:1:2'
      ].join('\n')
    })
    const failure = new WorkshopRouterError(
      'client',
      null,
      { source_file: 'fileUnreadable' },
      undefined,
      'file_read',
      { cause }
    )
    const record = workshopHealthLog({
      name: 'run_finished',
      properties: {
        ...run,
        status: 'failed',
        duration_ms: 10,
        ...workshopFailureAnalytics(failure, [
          {
            kind: 'file',
            name: 'source_file',
            label: 'File',
            accept: [],
            maxBytes: 1,
            required: true
          }
        ])
      }
    })

    expect(record).toMatchObject({
      service_health: 'excluded',
      failure_stage: 'file_read',
      field_error_names: ['source_file'],
      field_error_codes: ['fileUnreadable'],
      failure_type: 'NotReadableError',
      exception_name: 'NotReadableError',
      exception_frames: ['/_website/ModelDetail.abc.js:12:34']
    })
    expect(JSON.stringify(record)).not.toContain('private')
  })

  it.for([
    {
      name: 'client-side video duration validation',
      failure: {
        reason: 'validation',
        failure_stage: 'input_preparation',
        field_error_names: ['video_url'],
        field_error_codes: ['videoTooLong']
      }
    },
    {
      name: 'unreadable selected video',
      failure: {
        reason: 'client',
        failure_stage: 'input_preparation',
        field_error_names: ['video_url'],
        field_error_codes: ['videoUnreadable']
      }
    }
  ] satisfies Array<{ name: string; failure: FailureDetails }>)(
    'excludes $name from service failures',
    ({ failure }) => {
      expect(
        workshopHealthLog({
          name: 'run_finished',
          properties: {
            ...run,
            status: 'failed',
            duration_ms: 10,
            ...failure
          }
        })
      ).toMatchObject({ service_health: 'excluded' })
    }
  )

  it.for([
    {
      name: 'validation without a visible field',
      failure: {
        reason: 'validation',
        field_error_codes: ['videoTooLong']
      }
    },
    {
      name: 'Router validation response',
      failure: {
        reason: 'validation',
        request_id: 'router-request',
        http_status: 422,
        router_error_type: 'invalid_input',
        field_error_names: ['video_url'],
        field_error_codes: ['videoTooLong']
      }
    },
    {
      name: 'failed file upload',
      failure: {
        reason: 'upload',
        failure_stage: 'upload_put',
        field_error_names: ['image'],
        field_error_codes: ['uploadFailed']
      }
    }
  ] satisfies Array<{ name: string; failure: FailureDetails }>)(
    'retains $name as a service failure',
    ({ failure }) => {
      expect(
        workshopHealthLog({
          name: 'run_finished',
          properties: {
            ...run,
            status: 'failed',
            duration_ms: 10,
            ...failure
          }
        })?.service_health
      ).toBe('failure')
    }
  )

  it.for([
    { status: 'succeeded' as const, expected: 'success' },
    { status: 'failed' as const, expected: 'failure' },
    { status: 'cancelled' as const, expected: 'excluded' },
    { status: 'unverified' as const, expected: 'excluded' }
  ])('counts delivered outcome $status', ({ status, expected }) => {
    expect(
      workshopHealthLog({
        name: 'delivery_finished',
        properties: { ...run, duration_ms: 1, output_kind: 'image', status }
      })?.service_health
    ).toBe(expected)
  })

  it('uses Router attribution before a captured response exception', () => {
    expect(
      workshopHealthLog({
        name: 'run_finished',
        properties: {
          ...run,
          status: 'failed',
          reason: 'provider',
          duration_ms: 10,
          router_error_type: 'provider_error',
          exception_name: 'TypeError'
        }
      })
    ).toMatchObject({ failure_type: 'provider_error' })
  })

  it.for([
    { reason: 'media_timeout' as const, expected: 'media_timeout' },
    { reason: undefined, expected: 'delivery_error' }
  ])(
    'classifies a delivery failure as $expected without Router metadata',
    ({ reason, expected }) => {
      const record = workshopHealthLog({
        name: 'delivery_finished',
        properties: {
          ...run,
          duration_ms: 1,
          output_kind: 'image',
          status: 'failed',
          reason
        }
      })

      expect(record).toMatchObject({ failure_type: expected })
      if (reason === undefined) expect(record).not.toHaveProperty('reason')
    }
  )

  it.for([
    ['comfy.org', 'prod-v2'],
    ['www.comfy.org', 'prod-v2'],
    ['comfy-website-preview.vercel.app', 'preview'],
    ['localhost', undefined],
    ['comfy.org.attacker.example', undefined]
  ])('isolates environment %s', ([host, expected]) => {
    expect(workshopDatadogEnvironment(host ?? '')).toBe(expected)
  })

  it('removes page query, referrer, identity and SDK error context', () => {
    const event: LogsEvent = {
      date: 0,
      message: 'workshop run',
      status: 'info',
      origin: 'logger',
      view: {
        url: 'https://comfy.org/?token=private',
        referrer: 'https://example.com/private'
      },
      usr: { email: 'private@example.com' },
      account: { id: 'private-workspace' },
      session_id: 'private-session',
      session: { id: 'private-session' },
      error: { stack: 'private input' },
      http: {
        url: 'https://example.com/?signed=private',
        method: 'GET',
        status_code: 200
      }
    }
    expect(redactWorkshopLog(event)).toBe(true)
    expect(event).not.toHaveProperty('session_id')
    expect(event).not.toHaveProperty('session')
    expect(JSON.stringify(event)).not.toContain('private')
  })
})
