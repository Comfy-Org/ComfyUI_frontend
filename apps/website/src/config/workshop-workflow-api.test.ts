import type { JobDetailResponse } from '@comfyorg/ingest-types'
import { z } from 'astro/zod'
import { assert, describe, expect, it, vi } from 'vitest'

import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'
import {
  createWorkflowApi,
  WorkshopWorkflowError,
  workflowCloudRequest,
  workflowResponseJson
} from './workshop-workflow-api'
import { workflowCatalog } from './workshop-workflow-catalog'
import type {
  WorkflowRunRequest,
  WorkflowRunSummary
} from './workshop-workflow-response'
import {
  WORKFLOW_CONTROL_BYTES,
  workflowOutputs
} from './workshop-workflow-response'

const id = 'bafc696e-e5d4-42f1-9a3d-d01f82a0629b'
const otherId = 'caa84bc4-cd81-50fd-8c0e-ebac0d902a53'
const path = `/api/jobs/${id}?short_link=ephemeral_tool_chain`
const instant = Date.parse('2026-09-23T19:00:00Z')
const request: WorkflowRunRequest = {
  workflowId: 'workflows/change-material',
  definitionVersion: '1',
  appInputs: { image1: 'original-hash', image2: 'material-hash', prompt: '' }
}

function definition() {
  const entry = workflowCatalog.find(({ id }) => id === request.workflowId)
  assert(entry)
  return { ...structuredClone(entry), inputs: {} }
}

function observation(
  overrides: Partial<JobDetailResponse> = {}
): JobDetailResponse {
  return {
    id,
    status: 'completed',
    create_time: instant,
    update_time: instant + 7_000,
    outputs: {
      '9': {
        images: [{ filename: 'result.png', short_url: '/api/s/first-grant' }]
      }
    },
    ...overrides
  }
}

describe('Workshop workflow HTTP client', () => {
  it('renews authentication once with the identical materialized graph', async () => {
    const source = definition()
    const original = structuredClone(source.cloud.workflow)
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ prompt_id: id, node_errors: {} }))
    const token = vi
      .fn<(refresh?: boolean) => Promise<string>>()
      .mockResolvedValueOnce('before')
      .mockResolvedValueOnce('after')
    const beforeSend = vi.fn(() => {
      expect(fetch).not.toHaveBeenCalled()
    })

    const run = await createWorkflowApi({
      definition: source,
      fetch,
      token
    }).submit(request, new AbortController().signal, beforeSend)

    expect(run).toMatchObject({ id, state: 'queued', outputState: 'pending' })
    expect(token.mock.calls).toEqual([[false], [true]])
    expect(beforeSend).toHaveBeenCalledOnce()
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      `${WORKSHOP_CLOUD_BASE_URL}/api/prompt`,
      `${WORKSHOP_CLOUD_BASE_URL}/api/prompt`
    ])
    const bodies: unknown[] = fetch.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body))
    )
    expect(bodies[0]).toMatchObject({
      prompt: {
        '41': { class_type: 'LoadImage', inputs: { image: 'original-hash' } },
        '83': { class_type: 'LoadImage', inputs: { image: 'material-hash' } },
        '170:151': { inputs: { prompt: '', image2: ['83', 0] } },
        '170:169': { inputs: { seed: 677909188488042 } }
      }
    })
    expect(bodies[1]).toEqual(bodies[0])
    expect(source.cloud.workflow).toEqual(original)
    expect(
      fetch.mock.calls.map(([, init]) =>
        new Headers(init?.headers).get('Authorization')
      )
    ).toEqual(['Bearer before', 'Bearer after'])
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store'
    })
  })

  it('applies false, zero and empty values to every declared nested target', () => {
    const source = definition()
    source.cloud.inputBindings = {
      prompt: {
        encoding: 'scalar',
        targets: [
          { nodeId: '170:149', inputName: 'prompt' },
          { nodeId: '170:151', inputName: 'prompt' }
        ]
      },
      seed: {
        encoding: 'scalar',
        targets: [{ nodeId: '170:169', inputName: 'seed' }]
      },
      enabled: {
        encoding: 'scalar',
        targets: [{ nodeId: '170:168', inputName: 'value' }]
      }
    }

    const result = workflowCloudRequest(source, {
      ...request,
      appInputs: { prompt: '', seed: 0, enabled: false }
    })

    expect(result.prompt).toMatchObject({
      '170:149': { inputs: { prompt: '', image1: ['170:160', 0] } },
      '170:151': { inputs: { prompt: '' } },
      '170:169': { inputs: { seed: 0 } },
      '170:168': { inputs: { value: false } }
    })
  })

  it.for([
    {
      name: 'a different workflow',
      body: { ...request, workflowId: 'workflows/unknown' },
      code: 'definition_incompatible'
    },
    {
      name: 'an outdated definition',
      body: { ...request, definitionVersion: 'old' },
      code: 'definition_incompatible'
    },
    {
      name: 'an undeclared input',
      body: { ...request, appInputs: { undeclared: true } },
      code: 'invalid_input'
    }
  ])('rejects $name before submitting', async ({ body, code }) => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    const api = createWorkflowApi({
      definition: definition(),
      fetch,
      token: 'caller'
    })

    await expect(
      api.submit(body, new AbortController().signal)
    ).rejects.toMatchObject({ code })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses the caller API key header for CLI submissions', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(Response.json({ prompt_id: id }))
    const api = createWorkflowApi({
      definition: definition(),
      fetch,
      token: 'caller-key',
      authentication: 'api-key'
    })

    expect((await api.submit(request, new AbortController().signal)).id).toBe(
      id
    )
    const headers = new Headers(fetch.mock.calls[0][1]?.headers)
    expect(headers.get('X-API-Key')).toBe('caller-key')
    expect(headers.has('Authorization')).toBe(false)
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
    const run = createWorkflowApi({
      definition: definition(),
      fetch,
      token
    }).submit(request, controller.signal)

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
    const run = createWorkflowApi({
      definition: definition(),
      fetch,
      token: 'caller'
    }).read(id, controller.signal)

    controller.abort()
    response.resolve(Response.json(observation()))

    await expect(run).rejects.toBe(controller.signal.reason)
  })

  it.for([
    'api/prompt',
    '//attacker.example/api/prompt',
    '/\\attacker.example/api/prompt',
    'https://attacker.example/api/prompt'
  ])(
    'rejects an unsafe API path %s before sending credentials',
    async (url) => {
      const fetch = vi.fn<typeof globalThis.fetch>()
      const api = createWorkflowApi({
        definition: definition(),
        fetch,
        token: 'caller'
      })

      await expect(
        api.request(url, z.unknown(), new AbortController().signal)
      ).rejects.toMatchObject({
        code: 'invalid_request'
      })
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it('bounds graph submission by encoded bytes before dispatch', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    const api = createWorkflowApi({
      definition: definition(),
      fetch,
      token: 'caller'
    })

    await expect(
      api.submit(
        {
          ...request,
          appInputs: { prompt: 'é'.repeat(WORKFLOW_CONTROL_BYTES / 2) }
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ code: 'payload_too_large' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not resubmit inference after a transport failure', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(new TypeError('private transport detail'))
    const api = createWorkflowApi({
      definition: definition(),
      fetch,
      token: 'caller'
    })

    await expect(
      api.submit(request, new AbortController().signal)
    ).rejects.toEqual(new WorkshopWorkflowError('network'))
    expect(fetch).toHaveBeenCalledOnce()
  })

  it.for([
    { status: 'pending', state: 'queued' },
    { status: 'in_progress', state: 'running' },
    { status: 'completed', state: 'succeeded' },
    { status: 'failed', state: 'failed' },
    { status: 'cancelled', state: 'cancelled' }
  ] satisfies {
    status: JobDetailResponse['status']
    state: WorkflowRunSummary['state']
  }[])(
    'reports native job status $status as $state',
    async ({ status, state }) => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(Response.json(observation({ status })))
      const api = createWorkflowApi({
        definition: definition(),
        fetch,
        token: 'caller'
      })

      expect(
        (await api.read(id, new AbortController().signal)).run
      ).toMatchObject({
        state,
        createdAt: '2026-09-23T19:00:00.000Z',
        updatedAt: '2026-09-23T19:00:07.000Z'
      })
    }
  )

  it('returns only selected URL outputs and refreshes media without new inference', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        Response.json(
          observation({
            outputs: {
              '9': {
                images: [
                  {
                    filename: 'result.png',
                    short_url: '/api/s/first-grant',
                    data: 'data:image/png;base64,private'
                  }
                ],
                videos: [
                  { filename: 'hidden.mp4', short_url: '/api/s/unselected-key' }
                ]
              },
              unselected: {
                images: [
                  {
                    filename: 'hidden.png',
                    short_url: '/api/s/unselected-node'
                  }
                ]
              }
            },
            preview_output: { data: 'data:image/png;base64,private' }
          })
        )
      )
      .mockResolvedValueOnce(
        Response.json(
          observation({
            outputs: {
              '9': {
                images: [
                  { filename: 'result.png', short_url: '/api/s/fresh-grant' }
                ]
              }
            }
          })
        )
      )
      .mockResolvedValueOnce(Response.json(observation()))
    const api = createWorkflowApi({
      definition: definition(),
      fetch,
      token: 'caller'
    })
    const signal = new AbortController().signal

    const result = await api.read(id, signal)
    expect(workflowOutputs(result)).toEqual([
      {
        id: 'image:0',
        kind: 'image',
        fileName: 'result.png',
        url: `${WORKSHOP_CLOUD_BASE_URL}/api/s/first-grant`
      }
    ])
    expect(JSON.stringify(result)).not.toContain('base64')
    expect(await api.access(id, 'image:0', signal)).toMatchObject({
      url: `${WORKSHOP_CLOUD_BASE_URL}/api/s/fresh-grant`
    })
    expect((await api.retryDelivery(id, signal)).run.state).toBe('succeeded')
    expect(
      fetch.mock.calls.map(([url, init]) => [String(url), init?.method])
    ).toEqual([
      [`${WORKSHOP_CLOUD_BASE_URL}${path}`, 'GET'],
      [`${WORKSHOP_CLOUD_BASE_URL}${path}`, 'GET'],
      [`${WORKSHOP_CLOUD_BASE_URL}${path}`, 'GET']
    ])
  })

  it.for([
    'data:image/png;base64,private',
    'blob:https://comfy.org/private',
    'http://storage.example/file',
    'https://attacker.example/api/s/secret',
    '//attacker.example/api/s/secret',
    `${WORKSHOP_CLOUD_BASE_URL}/api/s/secret?token=private`,
    `${WORKSHOP_CLOUD_BASE_URL}/api/s/secret#private`,
    `https://user:secret@${new URL(WORKSHOP_CLOUD_BASE_URL).hostname}/api/s/secret`,
    '/api/view?filename=private'
  ])('withholds unsafe media URL %s without reflecting it', async (url) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      Response.json(
        observation({
          outputs: {
            '9': { images: [{ filename: 'result.png', short_url: url }] }
          }
        })
      )
    )
    const api = createWorkflowApi({
      definition: definition(),
      fetch,
      token: 'caller'
    })

    const result = await api.read(id, new AbortController().signal)

    expect(result.run.outputState).toBe('failed')
    expect(workflowOutputs(result)).toEqual([])
    expect(JSON.stringify(result)).not.toContain(url)
  })

  it('retains a ready output when another selected output is unavailable', async () => {
    const job = observation({
      outputs: {
        '9': {
          images: [
            { filename: 'result.png', short_url: '/api/s/first-grant' },
            { filename: 'missing.png' }
          ]
        }
      }
    })
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(() => Promise.resolve(Response.json(job)))
    const api = createWorkflowApi({
      definition: definition(),
      fetch,
      token: 'caller'
    })

    const result = await api.read(id, new AbortController().signal)

    expect(result.run.outputState).toBe('partial')
    expect(workflowOutputs(result).map(({ fileName }) => fileName)).toEqual([
      'result.png'
    ])
    await expect(
      api.access(id, 'image:1', new AbortController().signal)
    ).rejects.toMatchObject({
      code: 'delivery_failed'
    })
  })

  it('accepts the maximum selected output count', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      Response.json(
        observation({
          outputs: {
            '9': {
              images: Array.from({ length: 16 }, (_, index) => ({
                filename: `result-${index}.png`,
                short_url: `/api/s/grant-${index}`
              }))
            }
          }
        })
      )
    )
    const api = createWorkflowApi({
      definition: definition(),
      fetch,
      token: 'caller'
    })

    expect(
      workflowOutputs(await api.read(id, new AbortController().signal))
    ).toHaveLength(16)
  })

  it.for([
    { name: 'mismatched job identity', body: observation({ id: otherId }) },
    {
      name: 'unsafe timestamp',
      body: observation({ create_time: Number.MAX_SAFE_INTEGER + 1 })
    },
    {
      name: 'too many selected outputs',
      body: observation({
        outputs: {
          '9': {
            images: Array.from({ length: 17 }, () => ({
              filename: 'result.png',
              short_url: '/api/s/first-grant'
            }))
          }
        }
      })
    }
  ])('rejects $name without exposing the response body', async ({ body }) => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(Response.json(body))
    const api = createWorkflowApi({
      definition: definition(),
      fetch,
      token: 'caller'
    })

    await expect(api.read(id, new AbortController().signal)).rejects.toEqual(
      new WorkshopWorkflowError('response')
    )
  })

  it.for([
    { status: 403, code: 'access_denied' },
    { status: 409, code: 'execution_failed' },
    { status: 503, code: 'execution_failed' }
  ] as const)(
    'contains raw error bodies for HTTP $status',
    async ({ status, code }) => {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        Response.json(
          {
            private_url: 'https://storage.example/secret',
            bytes: [1, 2]
          },
          { status }
        )
      )
      const api = createWorkflowApi({
        definition: definition(),
        fetch,
        token: 'caller'
      })

      await expect(api.read(id, new AbortController().signal)).rejects.toEqual(
        new WorkshopWorkflowError(code, {}, status)
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

  it('rejects an oversized declared response before reading its bytes', async () => {
    const pull = vi.fn()
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>(
      { pull, cancel },
      { highWaterMark: 0 }
    )

    await expect(
      workflowResponseJson(
        new Response(body, {
          headers: { 'Content-Length': String(WORKFLOW_CONTROL_BYTES + 1) }
        })
      )
    ).rejects.toMatchObject({ code: 'response' })
    expect(pull).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledOnce()
  })

  it.for([
    { name: 'invalid JSON', body: 'private response text' },
    { name: 'invalid UTF-8', body: new Uint8Array([0xff, 0xfe]) },
    { name: 'an absent body', body: null }
  ])('contains $name', async ({ body }) => {
    await expect(workflowResponseJson(new Response(body))).rejects.toEqual(
      new WorkshopWorkflowError('response')
    )
  })

  it.for([
    { cancelled: true, status: 'pending', state: 'queued' },
    { cancelled: false, status: 'cancelled', state: 'cancelled' }
  ] satisfies {
    cancelled: boolean
    status: JobDetailResponse['status']
    state: WorkflowRunSummary['state']
  }[])(
    'observes job state after cancel returns $cancelled',
    async ({ cancelled, status, state }) => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(Response.json({ cancelled }))
        .mockResolvedValueOnce(Response.json(observation({ status })))
      const api = createWorkflowApi({
        definition: definition(),
        fetch,
        token: 'caller'
      })

      expect(
        (await api.cancel(id, new AbortController().signal)).run.state
      ).toBe(state)
      expect(
        fetch.mock.calls.map(([url, init]) => [String(url), init?.method])
      ).toEqual([
        [`${WORKSHOP_CLOUD_BASE_URL}/api/jobs/${id}/cancel`, 'POST'],
        [`${WORKSHOP_CLOUD_BASE_URL}${path}`, 'GET']
      ])
      expect(fetch.mock.calls[0][1]?.body).toBeUndefined()
    }
  )
})
