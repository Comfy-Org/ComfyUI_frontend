import { describe, expect, it } from 'vitest'

import { routerReportUpdate } from './router-model-report-events'

const model = {
  slug: 'provider--image--generate-images',
  routerId: 'provider/image',
  modality: 'image' as const
}
const source = { revision: '1234567', dirty: true, runId: 'campaign-1' }
const at = '2026-09-11T00:00:00.000Z'

describe('public Router result events', () => {
  it('keeps private requests, URLs and provider bodies out of concurrency results', () => {
    const update = routerReportUpdate(model, 'prod', source, {
      at,
      phase: 'generation',
      status: 'failed',
      reason: 'rateLimit',
      response: {
        status: 429,
        errorType: 'concurrency_limit_exceeded',
        body: 'secret provider body'
      },
      request: { prompt: 'private prompt' },
      url: 'https://example.com/?token=secret'
    })
    expect(update?.live).toMatchObject({
      status: 'blocked',
      failure: 'concurrency-limit',
      httpStatus: 429
    })
    expect(JSON.stringify(update)).not.toMatch(/secret|private prompt|https/)
  })

  it('publishes only decoded artifact metadata for passes', () => {
    const update = routerReportUpdate(model, 'prod', source, {
      at,
      phase: 'generation',
      status: 'passed',
      artifacts: [
        {
          kind: 'image',
          bytes: 100,
          sha256: 'a'.repeat(64),
          width: 64,
          height: 64,
          path: '/private/output.png',
          url: 'https://signed.example.com/token'
        }
      ]
    })
    expect(update?.live).toMatchObject({
      status: 'passed',
      artifacts: [{ kind: 'image', width: 64, height: 64, bytes: 100 }]
    })
    expect(JSON.stringify(update)).not.toMatch(/private|signed/)
  })

  it('marks a pass that Router completed only after its deadline', () => {
    const update = routerReportUpdate(model, 'prod', source, {
      at,
      phase: 'generation',
      status: 'passed',
      completion: 'collected-after-timeout',
      artifacts: [
        {
          kind: 'image',
          bytes: 100,
          sha256: 'a'.repeat(64),
          width: 64,
          height: 64
        }
      ]
    })
    expect(update?.live).toMatchObject({
      status: 'passed',
      completion: 'collected-after-timeout'
    })
  })

  it('does not interpret request preparation or admission as generation success', () => {
    for (const status of ['started', 'prepared', 'response'])
      expect(
        routerReportUpdate(model, 'prod', source, {
          at,
          phase: 'generation',
          status
        })
      ).toBeUndefined()
    expect(
      routerReportUpdate(model, 'prod', source, {
        at,
        phase: 'preflight',
        status: 'failed',
        fieldErrors: { video_id: 'required' }
      })
    ).toMatchObject({ preflight: { status: 'failed', fields: ['video_id'] } })
    expect(
      routerReportUpdate(model, 'prod', source, {
        at,
        phase: 'generation',
        status: 'failed',
        reason: 'validation',
        response: { status: 400, errorType: 'invalid_input' }
      })
    ).toMatchObject({ live: { status: 'failed', failure: 'invalid-input' } })
  })
})
