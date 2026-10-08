import { assert, describe, expect, it, vi } from 'vitest'

import { workshopContract } from './workshop-contract-catalog'
import { runSynchronousWorkshopRouter } from './workshop-router'

function options() {
  const contract = workshopContract('bfl/flux-2-pro')
  assert.exists(contract)
  return {
    contract,
    body: { prompt: 'Private prompt' },
    token: 'test-token',
    idempotencyKey: 'original-logical-run',
    signal: new AbortController().signal
  }
}

function result() {
  return Response.json(
    {
      id: 'original-generation',
      status: 'Ready',
      result: { sample: 'https://media.example/result.png' }
    },
    { headers: { 'X-Comfy-Request-Id': 'replay-request' } }
  )
}

describe('Router delivery failures', () => {
  it('does not resubmit a known HTTP failure even if its error body is interrupted', async () => {
    const cause = new TypeError('Connection lost')
    const calls = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(cause)
          }
        }),
        { status: 402, headers: { 'X-Comfy-Request-Id': 'rejected-request' } }
      )
    )
    vi.stubGlobal('fetch', calls)
    await expect(runSynchronousWorkshopRouter(options())).rejects.toMatchObject(
      {
        reason: 'noCredits',
        requestId: 'rejected-request',
        response: { status: 402, body: '' },
        cause
      }
    )
    expect(calls).toHaveBeenCalledOnce()
  })

  it.for(['request', 'response'] as const)(
    'recovers an interrupted %s using the identical request and key',
    async (stage) => {
      const calls = vi.fn<typeof fetch>()
      if (stage === 'request')
        calls.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      else
        calls.mockResolvedValueOnce(
          new Response(
            new ReadableStream({
              start(controller) {
                controller.error(new TypeError('Connection lost'))
              }
            }),
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Comfy-Request-Id': 'original-request'
              }
            }
          )
        )
      calls.mockResolvedValueOnce(result())
      vi.stubGlobal('fetch', calls)
      const rendered = await runSynchronousWorkshopRouter(options())
      expect(rendered.outputs[0].url).toBe('https://media.example/result.png')
      expect(rendered.requestId).toBe('replay-request')
      expect(calls).toHaveBeenCalledTimes(2)
      for (const [, init] of calls.mock.calls) {
        expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(
          'original-logical-run'
        )
        expect(init?.body).toBe('{"prompt":"Private prompt"}')
      }
    }
  )

  it('bounds network recovery without falling back to a new generation key', async () => {
    const calls = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', calls)
    await expect(runSynchronousWorkshopRouter(options())).rejects.toMatchObject(
      {
        reason: 'network',
        stage: 'request'
      }
    )
    expect(calls).toHaveBeenCalledTimes(2)
  })

  it('retains HTTP 200 and the request ID when a result cannot be parsed', async () => {
    const calls = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{', {
        headers: {
          'Content-Type': 'application/json',
          'X-Comfy-Request-Id': 'completed-request'
        }
      })
    )
    vi.stubGlobal('fetch', calls)
    await expect(runSynchronousWorkshopRouter(options())).rejects.toMatchObject(
      {
        reason: 'response',
        stage: 'response',
        requestId: 'completed-request',
        response: { status: 200 }
      }
    )
    expect(calls).toHaveBeenCalledOnce()
  })

  it.for([
    {
      status: 429,
      bucket: 'concurrency_limit_exceeded',
      reason: 'concurrency'
    },
    { status: 429, bucket: 'rate_limit_exceeded', reason: 'rateLimit' },
    { status: 409, bucket: '', reason: 'conflict' },
    { status: 503, bucket: 'provider_error', reason: 'provider' }
  ])(
    'distinguishes $bucket / $status without automatically retrying',
    async ({ status, bucket, reason }) => {
      const calls = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(null, {
          status,
          headers: {
            'X-Comfy-Error-Type': bucket,
            'X-Comfy-Request-Id': 'rejected-request'
          }
        })
      )
      vi.stubGlobal('fetch', calls)
      await expect(
        runSynchronousWorkshopRouter(options())
      ).rejects.toMatchObject({
        reason,
        stage: 'request',
        requestId: 'rejected-request',
        response: { status, errorType: bucket }
      })
      expect(calls).toHaveBeenCalledOnce()
    }
  )
})
