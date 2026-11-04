import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import type {
  GenerateNode,
  MediaItem
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import {
  fileItem,
  generateNode
} from '@/renderer/extensions/superComfy/engine/engineFixtures'
import { textItem } from '@/renderer/extensions/superComfy/engine/items'
import type { RunOutcome } from '@/renderer/extensions/superComfy/engine/types'
import {
  persistBlob,
  readItemBytes
} from '@/renderer/extensions/superComfy/media/superMedia'
import { createRouterExecutor } from '@/renderer/extensions/superComfy/router/routerExecutor'
import { ROUTER_FIXTURES } from '@/renderer/extensions/superComfy/router/fixtures/routerFixtures'
import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/renderer/extensions/superComfy/media/superMedia'), {
  spy: true
})

type Reply = () => Response

const FLUX = '/v2/models/bfl/flux-2-pro'
const OUTPUT_URL = 'https://cdn.example/out.png'

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  })
}

function routeKey(input: RequestInfo | URL, init?: RequestInit): string {
  const url = input instanceof Request ? input.url : String(input)
  return `${init?.method ?? 'GET'} ${url.replace(getComfyApiBaseUrl(), '')}`
}

function serveRouter(routes: Record<string, Reply[]>) {
  const served = new Map<string, number>()
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const key = routeKey(input, init)
    const replies = routes[key] ?? [
      () => jsonResponse(418, { detail: `unrouted ${key}` })
    ]
    const count = served.get(key) ?? 0
    served.set(key, count + 1)
    return replies[Math.min(count, replies.length - 1)]()
  })
}

function callsTo(key: string): (RequestInit | undefined)[] {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([input, init]) => routeKey(input, init) === key)
    .map(([, init]) => init)
}

function idempotencyKeys(key: string): (string | null)[] {
  return callsTo(key).map((init) =>
    new Headers(init?.headers).get('Idempotency-Key')
  )
}

const fluxSchema: Reply = () =>
  jsonResponse(200, ROUTER_FIXTURES['bfl/flux-2-pro'])
const outputBytes: Reply = () =>
  new Response(new Blob(['png'], { type: 'image/png' }), {
    status: 200,
    headers: { 'Content-Type': 'image/png' }
  })
const submitted: Reply = () =>
  jsonResponse(201, {
    request_id: 'req-1',
    status: 'IN_QUEUE',
    queue_position: 3
  })
const completed: Reply = () => jsonResponse(200, { status: 'COMPLETED' })
const fluxResult: Reply = () =>
  jsonResponse(200, { status: 'Ready', result: { sample: OUTPUT_URL } })

function fluxNode(): GenerateNode {
  return { ...generateNode('gen', 'image'), modelId: 'bfl/flux-2-pro' }
}

function startRun(
  node: GenerateNode,
  inputs: Record<string, MediaItem[]>,
  controller = new AbortController()
) {
  const onProgress = vi.fn()
  const outcome = createRouterExecutor()
    .begin(node, controller.signal)
    .run({
      node,
      run: { index: 0, repeat: 0, key: 'run-0', inputs },
      signal: controller.signal,
      onProgress
    })
  return { outcome, onProgress, controller }
}

async function settle(pending: Promise<RunOutcome>): Promise<RunOutcome> {
  const progress = { settled: false }
  void pending.finally(() => {
    progress.settled = true
  })
  for (let tick = 0; tick < 120 && !progress.settled; tick++) {
    await vi.advanceTimersByTimeAsync(1000)
  }
  return pending
}

beforeEach(() => {
  stubFirebaseAuthHarness()
  vi.mocked(useAuthStore().getWorkspaceAuthHeader).mockResolvedValue({
    Authorization: 'Bearer workspace'
  })
  vi.mocked(useAuthStore().getFirebaseAuthHeader).mockResolvedValue(null)
  vi.mocked(readItemBytes).mockResolvedValue({
    ok: true,
    blob: new Blob(['png-bytes'], { type: 'image/png' })
  })
  vi.mocked(persistBlob).mockImplementation(async (_blob, name, modality) => ({
    ok: true,
    item: {
      kind: 'file',
      modality,
      ref: { filename: name, subfolder: 'supercomfy', type: 'input' }
    }
  }))
})

describe('createRouterExecutor', () => {
  it('polls a queued run to its result and stores the output', async () => {
    serveRouter({
      [`GET ${FLUX}/openapi.json`]: [fluxSchema],
      [`POST ${FLUX}/requests`]: [submitted],
      [`GET ${FLUX}/requests/req-1/status`]: [
        () => jsonResponse(200, { status: 'IN_QUEUE', queue_position: 1 }),
        completed
      ],
      [`GET ${FLUX}/requests/req-1`]: [
        () =>
          jsonResponse(
            200,
            { status: 'Ready', result: { sample: OUTPUT_URL } },
            {
              'X-Comfy-Credits-Used': '4',
              'X-Comfy-Router-Dropped-Params': 'seed'
            }
          )
      ],
      [`GET ${OUTPUT_URL}`]: [outputBytes]
    })

    const { outcome, onProgress } = startRun(fluxNode(), {
      prompt: [textItem('a fox')]
    })

    expect(await settle(outcome)).toEqual({
      ok: true,
      outputs: {
        out: [
          {
            kind: 'file',
            modality: 'image',
            ref: {
              filename: expect.stringMatching(
                /^supercomfy-flux-2-pro-.+\.png$/
              ),
              subfolder: 'supercomfy',
              type: 'input'
            }
          }
        ]
      },
      creditsUsed: 4,
      notice: t('superComfy.node.droppedParams', { params: 'seed' })
    })
    expect(onProgress.mock.calls).toEqual([
      [{ queuePosition: 3 }],
      [{ queuePosition: 1 }]
    ])
  })

  it('reuses the idempotency key when a failed submit is retried', async () => {
    serveRouter({
      [`GET ${FLUX}/openapi.json`]: [fluxSchema],
      [`POST ${FLUX}/requests`]: [
        () => jsonResponse(503, { detail: 'busy' }),
        submitted
      ],
      [`GET ${FLUX}/requests/req-1/status`]: [completed],
      [`GET ${FLUX}/requests/req-1`]: [fluxResult],
      [`GET ${OUTPUT_URL}`]: [outputBytes]
    })

    const { outcome } = startRun(fluxNode(), { prompt: [textItem('a fox')] })
    const result = await settle(outcome)

    const keys = idempotencyKeys(`POST ${FLUX}/requests`)
    expect(result.ok).toBe(true)
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBeTruthy()
    expect(keys[1]).toBe(keys[0])
  })

  it('moves to the sync route with the same key when the queue is not enabled', async () => {
    serveRouter({
      [`GET ${FLUX}/openapi.json`]: [fluxSchema],
      [`POST ${FLUX}/requests`]: [
        () =>
          jsonResponse(403, {
            detail: 'Queue not enabled for this model',
            error_type: 'not_enabled'
          })
      ],
      [`POST ${FLUX}`]: [fluxResult],
      [`GET ${OUTPUT_URL}`]: [outputBytes]
    })

    const { outcome } = startRun(fluxNode(), { prompt: [textItem('a fox')] })
    const result = await settle(outcome)

    expect(result.ok).toBe(true)
    expect(idempotencyKeys(`POST ${FLUX}`)).toEqual(
      idempotencyKeys(`POST ${FLUX}/requests`)
    )
  })

  it.for([
    {
      name: 'a completed request with an error type',
      status: [
        () =>
          jsonResponse(200, {
            status: 'COMPLETED',
            error_type: 'content_policy_violation'
          })
      ],
      result: [() => jsonResponse(400, { detail: 'Prompt was flagged' })],
      message: 'Prompt was flagged (content_policy_violation)'
    },
    {
      name: 'an expired result',
      status: [
        () =>
          jsonResponse(410, {
            detail: 'Result expired',
            error_type: 'result_expired'
          })
      ],
      result: [fluxResult],
      message: 'Result expired (result_expired)'
    },
    {
      name: 'a refused credit check',
      status: [completed],
      result: [
        () =>
          jsonResponse(402, {
            detail: 'Not enough credits',
            error_type: 'insufficient_credits'
          })
      ],
      message: 'Not enough credits (insufficient_credits)'
    }
  ])(
    'fails with the server text for $name',
    async ({ status, result, message }) => {
      serveRouter({
        [`GET ${FLUX}/openapi.json`]: [fluxSchema],
        [`POST ${FLUX}/requests`]: [submitted],
        [`GET ${FLUX}/requests/req-1/status`]: status,
        [`GET ${FLUX}/requests/req-1`]: result
      })

      const { outcome } = startRun(fluxNode(), { prompt: [textItem('a fox')] })

      expect(await settle(outcome)).toEqual({ ok: false, message })
    }
  )

  it('cancels the Router request when the run is stopped', async () => {
    serveRouter({
      [`GET ${FLUX}/openapi.json`]: [fluxSchema],
      [`POST ${FLUX}/requests`]: [submitted],
      [`GET ${FLUX}/requests/req-1/status`]: [
        () => jsonResponse(200, { status: 'IN_PROGRESS' })
      ],
      [`POST ${FLUX}/requests/req-1/cancel`]: [
        () => jsonResponse(202, { status: 'CANCELLED' })
      ]
    })
    const { outcome, controller } = startRun(fluxNode(), {
      prompt: [textItem('a fox')]
    })
    await vi.advanceTimersByTimeAsync(3500)
    expect(callsTo(`GET ${FLUX}/requests/req-1/status`)).toHaveLength(1)

    controller.abort()
    const result = await settle(outcome)

    expect(result.ok).toBe(false)
    await vi.waitFor(() =>
      expect(callsTo(`POST ${FLUX}/requests/req-1/cancel`)).toHaveLength(1)
    )
  })

  it('refuses a request body over the size limit without submitting it', async () => {
    serveRouter({ [`GET ${FLUX}/openapi.json`]: [fluxSchema] })
    vi.mocked(readItemBytes).mockResolvedValue({
      ok: true,
      blob: new Blob([new Uint8Array(15 * 1024 * 1024)], { type: 'image/png' })
    })

    const { outcome } = startRun(fluxNode(), {
      prompt: [textItem('a fox')],
      image: [fileItem('huge.png')]
    })

    expect(await settle(outcome)).toEqual({
      ok: false,
      message: t('superComfy.media.tooLarge', { size: '20.0' })
    })
    expect(callsTo(`POST ${FLUX}/requests`)).toHaveLength(0)
  })

  it('runs a text model on the sync route', async () => {
    const claude = '/v2/models/anthropic/claude-haiku-4-5-20251001'
    serveRouter({
      [`GET ${claude}/openapi.json`]: [
        () =>
          jsonResponse(
            200,
            ROUTER_FIXTURES['anthropic/claude-haiku-4-5-20251001']
          )
      ],
      [`POST ${claude}`]: [
        () => jsonResponse(200, { content: [{ type: 'text', text: 'Hello' }] })
      ]
    })
    const node: GenerateNode = {
      ...generateNode('chat', 'text'),
      modelId: 'anthropic/claude-haiku-4-5-20251001',
      values: { max_tokens: 16 }
    }

    const { outcome } = startRun(node, { prompt: [textItem('Say hello')] })

    expect(await settle(outcome)).toEqual({
      ok: true,
      outputs: { out: [{ kind: 'text', text: 'Hello' }] }
    })
    expect(JSON.parse(String(callsTo(`POST ${claude}`)[0]?.body))).toEqual({
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Say hello' }] }
      ],
      max_tokens: 16
    })
  })
})
