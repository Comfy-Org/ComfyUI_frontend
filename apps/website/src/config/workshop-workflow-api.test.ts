import { describe, expect, it, vi } from 'vitest'

import {
  createWorkflowApi,
  WorkshopWorkflowError,
  workflowResponseJson
} from './workshop-workflow-api'
import type {
  WorkflowRun,
  WorkflowRunRequest
} from './workshop-workflow-response'
import {
  WORKFLOW_CONTROL_BYTES,
  workflowOutputs,
  workflowSummarySchema
} from './workshop-workflow-response'

const id = 'bafc696e-e5d4-42f1-9a3d-d01f82a0629b'
const outputId = 'caa84bc4-cd81-50fd-8c0e-ebac0d902a53'
const path = `/v1/workshop/workflow-runs/${id}`
const outputPath = `${path}/outputs/${outputId}/access`
const request: WorkflowRunRequest = {
  workflowId: 'workflows/test',
  definitionVersion: '1',
  appInputs: { prompt: '', seed: 0, enabled: false }
}
const instant = new Date().toISOString()

function observation(): WorkflowRun {
  return {
    run: {
      id,
      workflowId: request.workflowId,
      definitionVersion: '1',
      state: 'succeeded',
      outputState: 'ready',
      statusUrl: path,
      createdAt: instant,
      updatedAt: instant
    },
    runtime: { state: 'unknown' },
    outputs: [
      {
        id: outputId,
        bindingId: 'result',
        fileIndex: 0,
        kind: 'image',
        accessUrl: outputPath,
        delivery: {
          state: 'ready',
          access: {
            url: 'https://storage.googleapis.com/test/image.png?signature=private',
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
            refreshUrl: outputPath,
            mimeType: 'image/png',
            sizeBytes: 16
          }
        }
      }
    ],
    retryOutputDeliveryUrl: `${path}/outputs/retry`
  }
}

describe('Workshop workflow HTTP client', () => {
  it('renews authentication once with the identical admission body and key', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: 'not_authenticated', message: 'expired' } },
          { status: 401 }
        )
      )
      .mockResolvedValueOnce(Response.json(observation().run, { status: 202 }))
    const token = vi
      .fn<(refresh?: boolean) => Promise<string>>()
      .mockResolvedValueOnce('before')
      .mockResolvedValueOnce('after')
    const run = await createWorkflowApi({ fetch, token }).submit(
      request,
      'same-key',
      new AbortController().signal
    )
    expect(run.id).toBe(id)
    expect(token.mock.calls).toEqual([[false], [true]])
    expect(
      fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))
    ).toEqual([request, request])
    expect(
      fetch.mock.calls.map(([, init]) =>
        new Headers(init?.headers).get('Idempotency-Key')
      )
    ).toEqual(['same-key', 'same-key'])
    expect(
      fetch.mock.calls.map(([, init]) =>
        new Headers(init?.headers).get('Authorization')
      )
    ).toEqual(['Bearer before', 'Bearer after'])
    expect(fetch.mock.calls[0][1]).toMatchObject({
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store'
    })
  })

  it('discards authentication renewed after caller cancellation', async () => {
    const renewed = Promise.withResolvers<string>()
    const renewing = Promise.withResolvers<void>()
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }))
    const token = vi
      .fn<(refresh?: boolean) => Promise<string>>()
      .mockResolvedValueOnce('before')
      .mockImplementationOnce(() => {
        renewing.resolve()
        return renewed.promise
      })
    const controller = new AbortController()
    const run = createWorkflowApi({ fetch, token }).submit(
      request,
      'same-key',
      controller.signal
    )
    await renewing.promise
    controller.abort()
    renewed.resolve('after')
    await expect(run).rejects.toBe(controller.signal.reason)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('discards a response that arrives after caller cancellation', async () => {
    const response = Promise.withResolvers<Response>()
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockReturnValue(response.promise)
    const controller = new AbortController()
    const run = createWorkflowApi({ fetch, token: 'caller' }).read(
      id,
      controller.signal
    )
    controller.abort()
    response.resolve(Response.json(observation()))
    await expect(run).rejects.toBe(controller.signal.reason)
  })

  it.for([
    'v1/workshop/workflow-runs',
    '//attacker.example/workflow-runs',
    '/\\attacker.example/workflow-runs'
  ])(
    'rejects an unsafe API path %s before sending credentials',
    async (url) => {
      const fetch = vi.fn<typeof globalThis.fetch>()
      const api = createWorkflowApi({ fetch, token: 'caller' })
      await expect(
        api.request(url, workflowSummarySchema, new AbortController().signal)
      ).rejects.toMatchObject({ code: 'invalid_request' })
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it('bounds admission bodies by encoded bytes before dispatch', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    const api = createWorkflowApi({ fetch, token: 'caller' })
    await expect(
      api.submit(
        {
          ...request,
          appInputs: { prompt: 'é'.repeat(WORKFLOW_CONTROL_BYTES / 2) }
        },
        'same-key',
        new AbortController().signal
      )
    ).rejects.toMatchObject({ code: 'payload_too_large' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns URL outputs and refreshes only the selected output', async () => {
    const result = observation()
    const output = result.outputs[0]
    if (output.delivery.state !== 'ready') throw new Error('fixture')
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json(result))
      .mockResolvedValueOnce(Response.json(output.delivery.access))
    const api = createWorkflowApi({ fetch, token: 'caller' })
    const signal = new AbortController().signal
    expect(workflowOutputs(await api.read(id, signal))).toEqual([
      {
        id: outputId,
        kind: 'image',
        url: output.delivery.access.url,
        download: {
          url: output.delivery.access.url,
          expiresAt: Date.parse(output.delivery.access.expiresAt)
        },
        byteLength: 16,
        fileName: `${id}-${outputId}`
      }
    ])
    expect(await api.access(id, outputId, signal)).toEqual(
      output.delivery.access
    )
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining(path),
      expect.stringContaining(outputPath)
    ])
    expect(fetch.mock.calls.map(([, init]) => init?.method)).toEqual([
      'GET',
      'GET'
    ])
  })

  it.for([
    'data:image/png;base64,private',
    'blob:https://comfy.org/private',
    'http://storage.example/file',
    'https://user:secret@storage.example/file'
  ])('rejects unsafe media URL %s without reflecting it', async (url) => {
    const result = observation()
    const output = result.outputs[0]
    if (output.delivery.state !== 'ready') throw new Error('fixture')
    output.delivery.access.url = url
    const api = createWorkflowApi({
      token: 'caller',
      fetch: vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(Response.json(result))
    })
    await expect(api.read(id, new AbortController().signal)).rejects.toEqual(
      new WorkshopWorkflowError('response')
    )
  })

  it('rejects output bytes, mismatched run identity and off-origin refresh links', async () => {
    for (const result of [
      { ...observation(), preview: 'data:image/png;base64,private' },
      { ...observation(), run: { ...observation().run, id: outputId } },
      { ...observation(), retryOutputDeliveryUrl: 'https://attacker.example' }
    ]) {
      const api = createWorkflowApi({
        token: 'caller',
        fetch: vi
          .fn<typeof globalThis.fetch>()
          .mockResolvedValue(Response.json(result))
      })
      await expect(
        api.read(id, new AbortController().signal)
      ).rejects.toMatchObject({ code: 'response' })
    }
  })

  it.for([403, 409, 503])(
    'contains raw error bodies for HTTP %s',
    async (status) => {
      const api = createWorkflowApi({
        token: 'caller',
        fetch: vi
          .fn<typeof globalThis.fetch>()
          .mockResolvedValue(
            Response.json(
              { private_url: 'https://storage.example/secret', bytes: [1, 2] },
              { status }
            )
          )
      })
      await expect(api.read(id, new AbortController().signal)).rejects.toEqual(
        new WorkshopWorkflowError('response', {}, status)
      )
    }
  )

  it('cancels oversized chunked responses before consuming the remaining stream', async () => {
    let reads = 0
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          reads++
          controller.enqueue(new Uint8Array(WORKFLOW_CONTROL_BYTES))
        },
        cancel
      },
      { highWaterMark: 0 }
    )
    await expect(
      workflowResponseJson(new Response(body))
    ).rejects.toMatchObject({ code: 'response' })
    expect(reads).toBe(2)
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('keeps cancellation pending and includes the same history filter on subsequent pages', async () => {
    const pending = observation()
    pending.run.state = 'queued'
    pending.run.cancelRequestedAt = instant
    pending.run.outputState = 'pending'
    pending.outputs = []
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json(pending, { status: 202 }))
      .mockResolvedValueOnce(
        Response.json({ items: [pending.run], nextCursor: 'next' })
      )
      .mockResolvedValueOnce(Response.json({ items: [] }))
    const api = createWorkflowApi({ fetch, token: 'caller' })
    const signal = new AbortController().signal
    expect((await api.cancel(id, signal)).run.state).toBe('queued')
    const page = await api.history(signal, request.workflowId)
    await api.history(signal, request.workflowId, page.nextCursor)
    expect(String(fetch.mock.calls[2][0])).toContain(
      'workflowId=workflows%2Ftest&cursor=next'
    )
  })
})
