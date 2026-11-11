import { describe, expect, it, vi } from 'vitest'

import { CHAT_URL, modelBackend } from './agentBackends'
import type { AgentRequest } from './agentReply'
import { pointConfig } from './config'
import { textToImageNodes } from './fakePointHost'
import recordedStream from './fixtures/openrouterThinkingStream.recorded.txt?raw'
import type { AgentOutcome } from './modelReply'
import { chatBodySchema } from './modelWire'

const nodes = textToImageNodes()
const request: AgentRequest = {
  requestId: 'request-1',
  annotations: [
    {
      id: 'comment-1',
      label: 'Save Image',
      comment: 'make this wider',
      targets: [{ kind: 'node', nodeId: nodes[2].id }]
    }
  ]
}

function streamOf(pieces: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      pieces.forEach((piece) => controller.enqueue(encoder.encode(piece)))
      controller.close()
    }
  })
}

function neverAnswers(_url: unknown, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(new DOMException('aborted', 'AbortError'))
    )
  })
}

function ask(signal = new AbortController().signal) {
  const thinking: string[] = []
  const outcome = new Promise<AgentOutcome>((onOutcome) => {
    modelBackend(pointConfig.model).ask(request, nodes, {
      signal,
      onThinking: (text) => thinking.push(text),
      onOutcome
    })
  })
  return { outcome, thinking }
}

describe('modelBackend', () => {
  it('L-01, T-01: posts the batch to the proxy and hands on the thinking as it arrives, then the reply', async () => {
    const middle = Math.floor(recordedStream.length / 2)
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        streamOf([
          recordedStream.slice(0, middle),
          recordedStream.slice(middle)
        ]),
        { headers: { 'content-type': 'text/event-stream' } }
      )
    )

    const { outcome, thinking } = ask()

    await expect(outcome).resolves.toMatchObject({
      kind: 'reply',
      reply: { steps: [{ annotationId: 'comment-1' }, {}, {}] }
    })
    expect(thinking.join('')).toBe(
      "I'm checking which node sets the picture's width, and it's the"
    )
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(CHAT_URL)
    expect(
      chatBodySchema.safeParse(JSON.parse(String(init?.body))).success
    ).toBe(true)
  })

  it('L-05: a provider error becomes a failure that names the status', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(
        { error: { code: 429, message: 'Rate limit exceeded' } },
        { status: 429 }
      )
    )

    await expect(ask().outcome).resolves.toEqual({
      kind: 'failure',
      failure: { kind: 'provider', detail: 'status 429: Rate limit exceeded' }
    })
  })

  it('L-05: a stream that breaks off becomes a provider failure', async () => {
    const broken = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new TypeError('network error'))
      }
    })
    vi.mocked(fetch).mockResolvedValue(new Response(broken))

    await expect(ask().outcome).resolves.toEqual({
      kind: 'failure',
      failure: {
        kind: 'provider',
        detail: 'the connection to the model was lost'
      }
    })
  })

  it('L-06: an unreachable proxy becomes its own failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(ask().outcome).resolves.toEqual({
      kind: 'failure',
      failure: { kind: 'proxyDown', detail: '' }
    })
  })

  it('L-07: gives up when nothing arrives for the configured time', async () => {
    vi.mocked(fetch).mockImplementation(neverAnswers)

    const { outcome } = ask()
    await vi.advanceTimersByTimeAsync(pointConfig.model.silenceTimeoutMs)

    await expect(outcome).resolves.toEqual({
      kind: 'failure',
      failure: { kind: 'timeout', detail: '60' }
    })
  })

  it('L-08: cancelling aborts the call and reports no failure', async () => {
    vi.mocked(fetch).mockImplementation(neverAnswers)
    const cancel = new AbortController()

    const { outcome } = ask(cancel.signal)
    cancel.abort()

    await expect(outcome).resolves.toEqual({ kind: 'cancelled' })
  })

  it('L-10: a proxy without a key becomes its own failure', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(
        { error: { code: 'no_key', message: 'OPENROUTER_API_KEY is empty.' } },
        { status: 503 }
      )
    )

    await expect(ask().outcome).resolves.toEqual({
      kind: 'failure',
      failure: { kind: 'noKey', detail: 'OPENROUTER_API_KEY is empty.' }
    })
  })
})
