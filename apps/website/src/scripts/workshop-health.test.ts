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

const run: WorkshopRunAnalytics = {
  model_slug: 'vertexai--gemini-nano-banana-2--generate-images',
  router_id: 'vertexai/gemini-nano-banana-2',
  provider: 'Google',
  modality: 'image',
  attempt_id: '36a356b0-05f9-4d7b-9c5f-41e06a7c42e4',
  user_id: 'private-user',
  workspace_id: 'private-workspace'
}

describe('Workshop health', () => {
  it.for([
    { reason: 'response' as const, expected: 'failure' },
    { reason: 'upload' as const, expected: 'failure' },
    { reason: 'provider' as const, expected: 'failure' },
    { reason: 'validation' as const, expected: 'excluded' },
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
        })?.service_health
      ).toBe(expected)
    }
  )

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
    expect(JSON.stringify(record)).not.toMatch(/private-user|private-workspace/)
  })

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
      error: { stack: 'private input' },
      http: {
        url: 'https://example.com/?signed=private',
        method: 'GET',
        status_code: 200
      }
    }
    expect(redactWorkshopLog(event)).toBe(true)
    expect(JSON.stringify(event)).not.toContain('private')
  })
})
