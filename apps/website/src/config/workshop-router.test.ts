import { describe, expect, it, vi } from 'vitest'

import { runWorkshopRouter } from './workshop-router'
import { prepareWorkshopRouterInput } from './workshop-request'
import { WorkshopRouterError } from './workshop-router-errors'
import { workshopContract } from './workshop-contract-catalog'
import { workshopContractSchema } from './workshop-contract'
import { z } from 'astro/zod'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import {
  defaultValues,
  schemaForModel,
  validateForm
} from './workshop-playground'
import contracts from '../content/workshop-router-contracts.json'
import bindings from '../data/workshop-router-bindings.json'
import { validateWorkshopInput } from './workshop-json-schema'

function contractFor(id: string) {
  const contract = workshopContract(id)
  if (!contract) throw new Error('Missing test contract')
  return contract
}

describe('native Router requests', () => {
  it.for(['wavespeed/seedvr2', 'wavespeed/ultimate-image-upscaler'])(
    'preserves an image URL and rejects local/base64 placeholders for %s',
    async (id) => {
      const contract = contractFor(id)
      const signal = new AbortController().signal
      const url = 'https://example.com/image.png?token=abc%2F123'
      expect(
        await prepareWorkshopRouterInput(contract, { image: url }, signal)
      ).toEqual({ image: url })
      for (const image of [
        'image.png',
        'blob:local-image',
        'data:image/png;base64,AAAA',
        'https://',
        'https://example.com/a b.png',
        'https://example.com\\image.png',
        'https://user:password@example.com/image.png',
        'javascript:alert(1)'
      ]) {
        await expect(
          prepareWorkshopRouterInput(contract, { image }, signal)
        ).rejects.toMatchObject({ reason: 'validation' })
        await expect(
          prepareWorkshopRouterInput(
            contract,
            { request_body: JSON.stringify({ image }) },
            signal
          )
        ).rejects.toMatchObject({ reason: 'validation' })
      }
    }
  )
  it.for(
    contracts.filter((contract) =>
      bindings.some((binding) => binding.id === contract.catalogId)
    )
  )(
    'validates every enabled model against its authored native contract: $id',
    async (raw) => {
      const contract = workshopContractSchema.parse(raw)
      const detail = getRouterWorkshopModelDetail(
        raw.catalogId.replace('/', '--')
      )
      if (!detail) throw new Error('Missing catalog model')
      const schema = schemaForModel(detail)
      expect(validateForm(schema, defaultValues(schema))).toMatchObject(
        contract.media.some((binding) => binding.required)
          ? { media_image: 'required' }
          : { prompt: 'required' }
      )
      const example = z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .parse(contract.inputSchema.example)
      const values = {
        ...defaultValues(schema, example),
        ...Object.fromEntries(
          contract.media.flatMap((binding) => {
            const target = binding.targets[0].slice(1)
            if (!Object.hasOwn(example, target)) return []
            const encoded = example[target]
            expect(binding).toMatchObject({
              encoding: 'base64',
              accept: 'image'
            })
            if (typeof encoded !== 'string')
              throw new Error('Expected Base64 fixture')
            const file = new File(
              [Buffer.from(encoded, 'base64')],
              `${target}.png`,
              { type: 'image/png' }
            )
            return [
              [
                binding.name,
                { file, name: file.name, type: file.type, size: file.size }
              ]
            ]
          })
        ),
        prompt: 'A watercolor fox',
        seed: 123456
      }
      expect(validateForm(schema, values)).toEqual({})
      const body = await prepareWorkshopRouterInput(
        contract,
        values,
        new AbortController().signal
      )
      expect(validateWorkshopInput(body, contract.inputSchema)).toBe(true)
      expect(body).toMatchObject({ prompt: 'A watercolor fox', seed: 123456 })
      expect(body).not.toHaveProperty('model')
      expect(body).not.toHaveProperty('medias')
      if (contract.output.format !== 'json')
        throw new Error('Expected JSON output')
      const fetch = vi
        .fn()
        .mockResolvedValue(Response.json(contract.output.schema.example))
      vi.stubGlobal('fetch', fetch)
      const result = await runWorkshopRouter({
        contract,
        body,
        token: 'test-token',
        idempotencyKey: 'test-key',
        signal: new AbortController().signal
      })
      expect(fetch).toHaveBeenCalledOnce()
      expect(result.outputs.length).toBeGreaterThan(0)
      expect(result.outputs[0].url).toMatch(/^https:\/\//)
    }
  )

  it('preserves native Advanced fields and rejects unsupported or mis-sized inputs', async () => {
    const signal = new AbortController().signal
    expect(
      await prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-max'),
        {
          prompt: 'Test',
          output_format: 'png',
          safety_tolerance: 3,
          prompt_upsampling: false
        },
        signal
      )
    ).toEqual({
      prompt: 'Test',
      output_format: 'png',
      safety_tolerance: 3,
      prompt_upsampling: false
    })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-pro'),
        { prompt: 'Test', safety_tolerance: 3 },
        signal
      )
    ).rejects.toMatchObject({ reason: 'validation' })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-pro'),
        {
          request_body: JSON.stringify({ prompt: 'Test', safety_tolerance: 3 })
        },
        signal
      )
    ).rejects.toMatchObject({ reason: 'validation' })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-pro-1.1'),
        { prompt: 'Test', width: 1023 },
        signal
      )
    ).rejects.toMatchObject({ fieldErrors: { width: 'rejected' } })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-kontext-max'),
        { prompt: 'Test', guidance: 7 },
        signal
      )
    ).rejects.toMatchObject({ fieldErrors: { guidance: 'rejected' } })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-pro-1.1-ultra'),
        { prompt: 'Test', image_prompt_strength: 1.1 },
        signal
      )
    ).rejects.toMatchObject({
      fieldErrors: { image_prompt_strength: 'rejected' }
    })
  })

  it('preserves optional and Advanced scalar values and encodes the actual selected images', async () => {
    const first = new File(['image bytes'], 'one.png', { type: 'image/png' })
    const second = new File(['different bytes'], 'two.png', {
      type: 'image/png'
    })
    const body = await prepareWorkshopRouterInput(
      workshopContract('bfl/flux-2-pro'),
      {
        prompt: ' A prompt ',
        seed: 100001,
        width: 1024,
        height: 768,
        prompt_upsampling: false,
        media_image: [first, second].map((file) => ({
          file,
          name: file.name,
          size: file.size,
          type: file.type
        }))
      },
      new AbortController().signal
    )
    expect(body).toEqual({
      prompt: ' A prompt ',
      seed: 100001,
      width: 1024,
      height: 768,
      prompt_upsampling: false,
      input_image: btoa('image bytes'),
      input_image_2: btoa('different bytes')
    })
    expect(body).not.toHaveProperty('medias')
    expect(body).not.toHaveProperty('model')
  })

  it('does not invent defaults and refuses unknown mappings, invalid inputs, or fake uploads', async () => {
    const signal = new AbortController().signal
    expect(
      await prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-pro'),
        { prompt: 'Test', seed: undefined },
        signal
      )
    ).toEqual({ prompt: 'Test' })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('missing/model'),
        { prompt: 'Test' },
        signal
      )
    ).rejects.toMatchObject({ reason: 'unavailable' })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-pro'),
        { prompt: 'Test', width: 0 },
        signal
      )
    ).rejects.toMatchObject({
      reason: 'validation',
      fieldErrors: { width: 'rejected' }
    })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-pro'),
        {
          prompt: 'Test',
          media_image: { name: 'example.png', size: 1, type: 'image/png' }
        },
        signal
      )
    ).rejects.toMatchObject({
      reason: 'validation',
      fieldErrors: { media_image: 'required' }
    })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-pro'),
        { prompt: 'Test', unknown_knob: 1 },
        signal
      )
    ).rejects.toBeInstanceOf(WorkshopRouterError)
  })

  it('calls /v2/models with the workspace bearer, keeps the request ID and reads native output', async () => {
    const requests: Request[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      requests.push(new Request(url, init))
      return Response.json(
        {
          id: 'provider-job',
          status: 'Ready',
          result: { sample: 'https://assets.example/result.jpg' }
        },
        { headers: { 'X-Comfy-Request-Id': 'request-123' } }
      )
    })
    const result = await runWorkshopRouter({
      contract: contractFor('bfl/flux-2-pro'),
      body: { prompt: 'Test', seed: 42 },
      token: 'test-workspace-token',
      idempotencyKey: 'same-logical-run',
      signal: new AbortController().signal
    })
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe(
      'https://stagingapi.comfy.org/v2/models/bfl/flux-2-pro'
    )
    expect(requests[0].headers.get('Authorization')).toBe(
      'Bearer test-workspace-token'
    )
    expect(requests[0].headers.get('X-API-Key')).toBeNull()
    expect(requests[0].headers.get('Idempotency-Key')).toBe('same-logical-run')
    expect(await requests[0].json()).toEqual({ prompt: 'Test', seed: 42 })
    expect(result.requestId).toBe('request-123')
    expect(result.outputs[0].url).toBe('https://assets.example/result.jpg')
  })

  it('preserves caller cancellation while a Router request is pending', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(init.signal?.reason),
              { once: true }
            )
          })
      )
    )
    const request = runWorkshopRouter({
      contract: contractFor('bfl/flux-2-pro'),
      body: { prompt: 'Test' },
      token: 'test-token',
      idempotencyKey: 'one-key',
      signal: controller.signal
    })
    const reason = new DOMException('Cancelled by the caller', 'AbortError')

    controller.abort(reason)

    await expect(request).rejects.toBe(reason)
  })

  it('stops a Router request after the run timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(init.signal?.reason),
              { once: true }
            )
          })
      )
    )
    await Promise.all([
      expect(
        runWorkshopRouter({
          contract: contractFor('bfl/flux-2-pro'),
          body: { prompt: 'Test' },
          token: 'test-token',
          idempotencyKey: 'one-key',
          signal: new AbortController().signal
        })
      ).rejects.toMatchObject({ reason: 'timeout' }),
      vi.advanceTimersByTimeAsync(660_000)
    ])
  })

  it('checks the total base64 request size before reading files or sending a request', async () => {
    const file = new File([new Uint8Array(4 * 1024 * 1024)], 'large.png', {
      type: 'image/png'
    })
    const read = vi.spyOn(file, 'arrayBuffer')
    const selected = { file, name: file.name, type: file.type, size: file.size }
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-pro'),
        {
          prompt: 'Test',
          media_image: [selected, selected]
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      reason: 'validation',
      fieldErrors: { media_image: 'requestTooLarge' }
    })
    expect(read).not.toHaveBeenCalled()

    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(
      runWorkshopRouter({
        contract: contractFor('bfl/flux-2-pro'),
        body: { prompt: '汉'.repeat(4 * 1024 * 1024) },
        token: 'test-token',
        idempotencyKey: 'one-key',
        signal: new AbortController().signal
      })
    ).rejects.toMatchObject({
      reason: 'validation',
      fieldErrors: { request_body: 'requestTooLarge' }
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.for([
    { status: 400, bucket: 'content_policy_violation', reason: 'policy' },
    { status: 403, bucket: 'not_enabled', reason: 'unavailable' },
    { status: 403, bucket: 'forbidden', reason: 'unavailable' },
    { status: 403, bucket: '', reason: 'unavailable' },
    { status: 402, bucket: 'not_enabled', reason: 'unavailable' },
    { status: 400, bucket: 'insufficient_credits', reason: 'noCredits' }
  ])(
    'classifies $status / $bucket by the Router error bucket',
    async ({ status, bucket, reason }) => {
      const requests = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(null, {
          status,
          headers: {
            'X-Comfy-Error-Type': bucket,
            'X-Comfy-Request-Id': 'rejected'
          }
        })
      )
      vi.stubGlobal('fetch', requests)
      await expect(
        runWorkshopRouter({
          contract: contractFor('bfl/flux-2-pro'),
          body: { prompt: 'Test' },
          token: 'test-token',
          idempotencyKey: 'one-key',
          signal: new AbortController().signal
        })
      ).rejects.toMatchObject({ reason, requestId: 'rejected' })
      expect(requests).toHaveBeenCalledTimes(1)
    }
  )

  it('reports errors without silently retrying a paid request', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 402,
        headers: { 'X-Comfy-Request-Id': 'failed-request' }
      })
    )
    vi.stubGlobal('fetch', fetch)
    await expect(
      runWorkshopRouter({
        contract: contractFor('bfl/flux-2-pro'),
        body: { prompt: 'Test' },
        token: 'test-token',
        idempotencyKey: 'one-key',
        signal: new AbortController().signal
      })
    ).rejects.toMatchObject({
      reason: 'noCredits',
      requestId: 'failed-request'
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('collects a generation Router parked at its deadline with the same key and body', async () => {
    const requests: Request[] = []
    const responses = [
      new Response('{"error_type":"deadline_exceeded"}', {
        status: 504,
        headers: {
          'X-Comfy-Error-Type': 'deadline_exceeded',
          'X-Comfy-Request-Id': 'parked'
        }
      }),
      Response.json(
        {
          id: 'provider-job',
          status: 'Ready',
          result: { sample: 'https://assets.example/a.jpg' }
        },
        { headers: { 'X-Comfy-Request-Id': 'collected' } }
      )
    ]
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      requests.push(new Request(url, init))
      const response = responses.shift()
      if (!response) throw new Error('Unexpected Router request')
      return response
    })
    const result = await runWorkshopRouter({
      contract: contractFor('bfl/flux-2-pro'),
      body: { prompt: 'Test', seed: 42 },
      token: 'test-token',
      idempotencyKey: 'parked-run',
      signal: new AbortController().signal
    })
    expect(requests).toHaveLength(2)
    expect(
      requests.map((request) => request.headers.get('Idempotency-Key'))
    ).toEqual(['parked-run', 'parked-run'])
    const [first, second] = await Promise.all(
      requests.map((request) => request.text())
    )
    expect(second).toBe(first)
    expect(result).toMatchObject({
      requestId: 'collected',
      deadlineCollections: 1,
      outputs: [{ url: 'https://assets.example/a.jpg' }]
    })
  })

  it('stops collecting after the deadline budget and reports a timeout', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(null, {
          status: 504,
          headers: {
            'X-Comfy-Error-Type': 'deadline_exceeded',
            'X-Comfy-Request-Id': 'still-parked'
          }
        })
    )
    vi.stubGlobal('fetch', fetch)
    await expect(
      runWorkshopRouter({
        contract: contractFor('bfl/flux-2-pro'),
        body: { prompt: 'Test' },
        token: 'test-token',
        idempotencyKey: 'one-key',
        signal: new AbortController().signal
      })
    ).rejects.toMatchObject({ reason: 'timeout', requestId: 'still-parked' })
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('does not resend a provider timeout, which Router does not park', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(null, {
          status: 504,
          headers: { 'X-Comfy-Error-Type': 'provider_timeout' }
        })
    )
    vi.stubGlobal('fetch', fetch)
    await expect(
      runWorkshopRouter({
        contract: contractFor('bfl/flux-2-pro'),
        body: { prompt: 'Test' },
        token: 'test-token',
        idempotencyKey: 'one-key',
        signal: new AbortController().signal
      })
    ).rejects.toMatchObject({ reason: 'timeout' })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('waits out an in-flight conflict before asking for the same generation again', async () => {
    vi.useFakeTimers()
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(null, { status: 409, headers: { 'Retry-After': '2' } })
      )
      .mockResolvedValueOnce(
        Response.json({
          id: 'provider-job',
          status: 'Ready',
          result: { sample: 'https://assets.example/b.jpg' }
        })
      )
    vi.stubGlobal('fetch', fetch)
    const request = runWorkshopRouter({
      contract: contractFor('bfl/flux-2-pro'),
      body: { prompt: 'Test' },
      token: 'test-token',
      idempotencyKey: 'one-key',
      signal: new AbortController().signal
    })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(fetch).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1_000)
    await expect(request).resolves.toMatchObject({
      outputs: [{ url: 'https://assets.example/b.jpg' }]
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('finishes a Retry-After wait after a slow request exhausts its attempt window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) =>
            setTimeout(
              () =>
                resolve(
                  new Response(null, {
                    status: 409,
                    headers: { 'Retry-After': '2' }
                  })
                ),
              659_000
            )
          )
      )
      .mockResolvedValueOnce(
        Response.json({
          id: 'provider-job',
          status: 'Ready',
          result: { sample: 'https://assets.example/late.jpg' }
        })
      )
    vi.stubGlobal('fetch', fetch)
    const request = runWorkshopRouter({
      contract: contractFor('bfl/flux-2-pro'),
      body: { prompt: 'Test' },
      token: 'token',
      idempotencyKey: 'same-key',
      signal: new AbortController().signal
    })
    await Promise.all([
      expect(request).resolves.toMatchObject({
        outputs: [{ url: 'https://assets.example/late.jpg' }]
      }),
      (async () => {
        await vi.advanceTimersByTimeAsync(660_999)
        expect(fetch).toHaveBeenCalledOnce()
        expect(fetch.mock.lastCall?.[1]?.signal?.aborted).toBe(false)
        await vi.advanceTimersByTimeAsync(1)
      })()
    ])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1]).toEqual(fetch.mock.calls[0])
  })

  it('still stops a Retry-After wait at the total run deadline', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const responses = [
      { delay: 659_000, status: 504 },
      { delay: 659_000, status: 504 },
      { delay: 659_000, status: 504 },
      { delay: 659_000, status: 409 },
      { delay: 53_000, status: 409 }
    ]
    const fetch = vi.fn<typeof globalThis.fetch>(() => {
      const response = responses.shift()
      if (!response) throw new Error('Unexpected Router request')
      return new Promise<Response>((resolve) =>
        setTimeout(
          () =>
            resolve(
              new Response(null, {
                status: response.status,
                headers: {
                  'Retry-After': '10',
                  'X-Comfy-Error-Type':
                    response.status === 504 ? 'deadline_exceeded' : 'in_flight'
                }
              })
            ),
          response.delay
        )
      )
    })
    vi.stubGlobal('fetch', fetch)
    const request = runWorkshopRouter({
      contract: contractFor('bfl/flux-2-pro'),
      body: { prompt: 'Test' },
      token: 'token',
      idempotencyKey: 'same-key',
      signal: new AbortController().signal
    })
    await Promise.all([
      expect(request).rejects.toMatchObject({ reason: 'timeout' }),
      (async () => {
        await vi.advanceTimersByTimeAsync(2_699_999)
        expect(fetch).toHaveBeenCalledTimes(5)
        expect(fetch.mock.lastCall?.[1]?.signal?.aborted).toBe(false)
        await vi.advanceTimersByTimeAsync(1)
      })()
    ])
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetch).toHaveBeenCalledTimes(5)
  })

  it.for([
    { advice: 'Wed, 21 Oct 2026 07:28:02 GMT', wait: 2_000 },
    { advice: 'Wed, 21 Oct 2026 07:29:00 GMT', wait: 10_000 }
  ])(
    'honors and bounds an HTTP-date Retry-After: $advice',
    async ({ advice, wait }) => {
      vi.useFakeTimers({ shouldAdvanceTime: false })
      vi.setSystemTime(new Date('2026-10-21T07:28:00Z'))
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(
          new Response(null, {
            status: 409,
            headers: { 'Retry-After': advice }
          })
        )
        .mockResolvedValueOnce(
          Response.json({
            id: 'provider-job',
            status: 'Ready',
            result: { sample: 'https://assets.example/b.jpg' }
          })
        )
      vi.stubGlobal('fetch', fetch)
      const request = runWorkshopRouter({
        contract: contractFor('bfl/flux-2-pro'),
        body: { prompt: 'Test' },
        token: 'token',
        idempotencyKey: 'same-key',
        signal: new AbortController().signal
      })
      await Promise.all([
        expect(request).resolves.toMatchObject({
          outputs: [{ url: 'https://assets.example/b.jpg' }]
        }),
        (async () => {
          await vi.advanceTimersByTimeAsync(wait - 1)
          expect(fetch).toHaveBeenCalledOnce()
          await vi.advanceTimersByTimeAsync(1)
        })()
      ])
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(fetch.mock.calls[1]).toEqual(fetch.mock.calls[0])
    }
  )

  it.for(['', '-1', 'not-a-date', 'Wed, 21 Oct 2020 07:28:00 GMT'])(
    'does not retry invalid or expired retry advice: %s',
    async (advice) => {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(null, {
          status: 409,
          headers: { 'Retry-After': advice }
        })
      )
      vi.stubGlobal('fetch', fetch)
      await expect(
        runWorkshopRouter({
          contract: contractFor('bfl/flux-2-pro'),
          body: { prompt: 'Test' },
          token: 'token',
          idempotencyKey: 'same-key',
          signal: new AbortController().signal
        })
      ).rejects.toMatchObject({ reason: 'provider' })
      expect(fetch).toHaveBeenCalledOnce()
    }
  )

  it('cancels during a retry wait without submitting again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response(null, { status: 409, headers: { 'Retry-After': '10' } })
      )
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    const request = runWorkshopRouter({
      contract: contractFor('bfl/flux-2-pro'),
      body: { prompt: 'Test' },
      token: 'token',
      idempotencyKey: 'same-key',
      signal: controller.signal
    })
    const reason = new DOMException('Stopped', 'AbortError')
    await Promise.all([
      expect(request).rejects.toBe(reason),
      (async () => {
        await vi.advanceTimersByTimeAsync(1)
        controller.abort(reason)
      })()
    ])
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('bounds slow collections and in-flight waits by one total deadline', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const responses = [504, 409, 504, 409, 504]
    const fetch = vi.fn<typeof globalThis.fetch>(
      (_url, init) =>
        new Promise<Response>((resolve, reject) => {
          const status = responses.shift() ?? 409
          const timer = setTimeout(() => {
            init?.signal?.removeEventListener('abort', abort)
            resolve(
              new Response(null, {
                status,
                headers: {
                  'Retry-After': '10',
                  'X-Comfy-Error-Type':
                    status === 504 ? 'deadline_exceeded' : 'in_flight'
                }
              })
            )
          }, 600_000)
          function abort() {
            clearTimeout(timer)
            reject(init?.signal?.reason)
          }
          init?.signal?.addEventListener('abort', abort, { once: true })
        })
    )
    vi.stubGlobal('fetch', fetch)
    const request = runWorkshopRouter({
      contract: contractFor('bfl/flux-2-pro'),
      body: { prompt: 'Test' },
      token: 'token',
      idempotencyKey: 'same-key',
      signal: new AbortController().signal
    })
    await Promise.all([
      expect(request).rejects.toMatchObject({ reason: 'timeout' }),
      (async () => {
        await vi.advanceTimersByTimeAsync(2_699_999)
        expect(fetch).toHaveBeenCalledTimes(5)
        expect(fetch.mock.lastCall?.[1]?.signal?.aborted).toBe(false)
        await vi.advanceTimersByTimeAsync(1)
      })()
    ])
    expect(
      fetch.mock.calls.every(
        ([, init]) =>
          init?.body === '{"prompt":"Test"}' &&
          new Headers(init.headers).get('Idempotency-Key') === 'same-key'
      )
    ).toBe(true)
    await vi.advanceTimersByTimeAsync(600_000)
    expect(fetch).toHaveBeenCalledTimes(5)
  })

  it('does not resend a conflict that carries no retry advice', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 409 }))
    vi.stubGlobal('fetch', fetch)
    await expect(
      runWorkshopRouter({
        contract: contractFor('bfl/flux-2-pro'),
        body: { prompt: 'Test' },
        token: 'test-token',
        idempotencyKey: 'one-key',
        signal: new AbortController().signal
      })
    ).rejects.toMatchObject({ reason: 'provider' })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('does not treat a provider error document or an unsafe output URL as a successful result', async () => {
    for (const data of [
      { status: 'Error' },
      { status: 'Ready', result: { sample: 'javascript:alert(1)' } }
    ]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(data)))
      await expect(
        runWorkshopRouter({
          contract: contractFor('bfl/flux-2-pro'),
          body: { prompt: 'Test' },
          token: 'test-token',
          idempotencyKey: 'one-key',
          signal: new AbortController().signal
        })
      ).rejects.toMatchObject({ reason: 'provider' })
    }
  })
})
