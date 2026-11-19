import { describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'

import { ComfyApi } from '@comfyorg/api-client/ComfyApi'
import { anonymousApiAuthProvider } from '@comfyorg/api-client/apiAuthProvider'
import { FETCH_RESPONSE_HEADERS_TIMEOUT_MS } from '@comfyorg/api-client/apiTimeouts'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { fetchWithUnifiedRemint } from '@/platform/auth/unified/remintRetry'
import type {
  GpuRequestHold,
  GpuStartingHold
} from '@/platform/workspace/gpuStartingFetch'
import { holdWhileGpuStarts } from '@/platform/workspace/gpuStartingFetch'

vi.mock(import('@sentry/vue'))
vi.mock(import('@comfyorg/telemetry'))

function gpuStarting(gpu: string) {
  return new Response(JSON.stringify({ code: 'gpu_starting', gpu }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  })
}

function readySignal() {
  let ready: (isReady: boolean) => void = () => {}
  const isReady = new Promise<boolean>((resolve) => {
    ready = resolve
  })
  const request: GpuRequestHold = {
    answered: vi.fn(),
    waitReady: vi.fn(() => isReady)
  }
  const hold: GpuStartingHold = { forRequest: () => request }
  return { hold, request, ready }
}

/**
 * A send that, like the browser's fetch, refuses a request whose signal has
 * aborted; `'stall'` never answers and rejects only when the signal aborts.
 */
function honouringAbort(...answers: Array<Response | 'stall'>) {
  return vi.fn<typeof fetch>(async (_input, init) => {
    const signal = init?.signal
    signal?.throwIfAborted()
    const answer = answers.shift()
    if (!answer) throw new Error('no answer left')
    if (answer !== 'stall') return answer
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason), {
        once: true
      })
    })
  })
}

/**
 * `fetchApi` wired as on Cloud: its real attempt deadline, the production
 * auth provider's fetch with its status retries, and the hold wrapping the
 * page's `fetch` underneath.
 */
function apiHolding(send: typeof fetch, hold: GpuStartingHold) {
  vi.mocked(fetch).mockImplementation(holdWhileGpuStarts(send, hold))
  const api = new ComfyApi({
    isCloud: false,
    featureFlagOverride: () => undefined,
    onFreeMemory: () => {}
  })
  api.setAuthProvider({
    ...anonymousApiAuthProvider,
    fetch: fetchWithUnifiedRemint
  })
  return api
}

function gpuHoldOfEachSend(send: MockInstance<typeof fetch>) {
  return send.mock.calls.map(([, init]) =>
    new Headers(init?.headers).get('Comfy-Gpu-Hold')
  )
}

const RUN_SUBMIT = '/api/prompt'
const RUN_INIT = { method: 'POST', body: '{"prompt":{}}' }

function emptyWorkflow(): ComfyWorkflowJSON {
  return {
    revision: 0,
    last_node_id: 0,
    last_link_id: 0,
    nodes: [],
    links: [],
    groups: [],
    extra: {},
    version: 0.4
  }
}

describe('holdWhileGpuStarts', () => {
  it('holds a request answered gpu_starting until ready, then sends it again', async () => {
    const answer = new Response('scene')
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(gpuStarting('starting'))
      .mockResolvedValueOnce(answer)
    const { hold, request, ready } = readySignal()
    const init = { method: 'POST', body: '{}' }

    const response = holdWhileGpuStarts(send, hold)(
      '/example_pack/preview',
      init
    )
    await vi.waitFor(() => expect(request.waitReady).toHaveBeenCalled())
    expect(send).toHaveBeenCalledTimes(1)
    expect(request.answered).toHaveBeenCalledWith('starting')

    ready(true)

    await expect(response).resolves.toBe(answer)
    expect(send).toHaveBeenNthCalledWith(2, '/example_pack/preview', init)
  })

  it('answers the 503 when the GPU does not become ready', async () => {
    const send = vi.fn<typeof fetch>(async () => gpuStarting('starting'))
    const { hold, ready } = readySignal()

    const response = holdWhileGpuStarts(send, hold)('/example_pack/preview')
    ready(false)

    await expect(response).resolves.toHaveProperty('status', 503)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it.for(['off', 'unavailable'])(
    'answers at once when the GPU is %s',
    async (gpu) => {
      const send = vi.fn<typeof fetch>(async () => gpuStarting(gpu))
      const { hold, request } = readySignal()

      const response = await holdWhileGpuStarts(
        send,
        hold
      )('/example_pack/preview')

      expect(response.status).toBe(503)
      expect(request.answered).toHaveBeenCalledWith(gpu)
      expect(request.waitReady).not.toHaveBeenCalled()
    }
  )

  it('stops holding at once when the caller cancels', async () => {
    const send = honouringAbort(gpuStarting('starting'))
    const { hold, request } = readySignal()
    const controller = new AbortController()
    const reason = new DOMException('left the page', 'AbortError')

    const response = holdWhileGpuStarts(send, hold)('/example_pack/preview', {
      signal: controller.signal
    })
    await vi.waitFor(() => expect(request.waitReady).toHaveBeenCalled())
    controller.abort(reason)

    await expect(response).rejects.toBe(reason)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('sends again with the caller signal when ready and not cancelled', async () => {
    const answer = new Response('scene')
    const send = honouringAbort(gpuStarting('starting'), answer)
    const { hold, request, ready } = readySignal()
    const init = { signal: new AbortController().signal }

    const response = holdWhileGpuStarts(send, hold)(
      '/example_pack/preview',
      init
    )
    await vi.waitFor(() => expect(request.waitReady).toHaveBeenCalled())
    ready(true)

    await expect(response).resolves.toBe(answer)
    expect(send).toHaveBeenNthCalledWith(2, '/example_pack/preview', init)
  })

  it('answers a gpu_starting Request at once, since its body cannot be sent again', async () => {
    const send = vi.fn<typeof fetch>(async () => gpuStarting('starting'))
    const { hold, request } = readySignal()

    const response = await holdWhileGpuStarts(
      send,
      hold
    )(new Request('http://localhost/example_pack/preview'))

    expect(response.status).toBe(503)
    expect(request.answered).toHaveBeenCalledWith('starting')
    expect(request.waitReady).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('passes a 503 with an unreadable JSON body through', async () => {
    const answer = new Response('not json', {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
    const send = vi.fn<typeof fetch>(async () => answer)
    const { hold, request } = readySignal()

    await expect(
      holdWhileGpuStarts(send, hold)('/example_pack/preview')
    ).resolves.toBe(answer)
    expect(request.answered).not.toHaveBeenCalled()
  })

  describe('a Run submit', () => {
    async function headersSent(input: RequestInfo | URL, method = 'POST') {
      const send = vi.fn<typeof fetch>(async () => new Response('{}'))
      await holdWhileGpuStarts(send, readySignal().hold)(input, {
        method,
        headers: { 'Content-Type': 'application/json' }
      })
      expect(send).toHaveBeenCalledOnce()
      return new Headers(send.mock.calls[0][1]?.headers)
    }

    it.for([
      { name: 'a POST /api/prompt', input: RUN_SUBMIT },
      {
        name: 'a POST /api/prompt under a base path',
        input: '/base/api/prompt'
      },
      {
        name: 'a same-origin URL to /api/prompt',
        input: new URL(RUN_SUBMIT, location.href)
      }
    ])('marks $name with Comfy-Gpu-Hold: 1', async ({ input }) => {
      const headers = await headersSent(input)

      expect(headers.get('Comfy-Gpu-Hold')).toBe('1')
      expect(headers.get('Content-Type')).toBe('application/json')
    })

    it.for([
      {
        name: 'a cross-origin POST /api/prompt',
        input: 'https://other.example/api/prompt'
      },
      { name: 'a GET /api/prompt', input: RUN_SUBMIT, method: 'GET' },
      { name: 'a POST to a custom node route', input: '/example_pack/preview' },
      {
        name: 'a POST /api/prompt sent as a Request object',
        input: new Request(new URL(RUN_SUBMIT, location.href), {
          method: 'POST'
        })
      }
    ])('does not mark $name', async ({ input, method }) => {
      const headers = await headersSent(input, method)

      expect(headers.get('Comfy-Gpu-Hold')).toBeNull()
    })

    it('sends a held Run again without the hold once the GPU is ready', async () => {
      const queued = Response.json({ prompt_id: 'job-1' })
      const send = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(gpuStarting('starting'))
        .mockResolvedValueOnce(queued)
      const { hold, request, ready } = readySignal()

      const response = holdWhileGpuStarts(send, hold)(RUN_SUBMIT, RUN_INIT)
      await vi.waitFor(() => expect(request.waitReady).toHaveBeenCalled())
      expect(send).toHaveBeenCalledOnce()
      expect(request.answered).toHaveBeenCalledWith('starting')

      ready(true)

      await expect(response).resolves.toBe(queued)
      expect(send).toHaveBeenNthCalledWith(2, RUN_SUBMIT, RUN_INIT)
      expect(gpuHoldOfEachSend(send)).toEqual(['1', null])
    })

    it('sends a Run again without the hold when the GPU never becomes ready', async () => {
      const queued = Response.json({ prompt_id: 'job-1' })
      const send = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(gpuStarting('starting'))
        .mockResolvedValueOnce(queued)
      const { hold, request, ready } = readySignal()

      const response = holdWhileGpuStarts(send, hold)(RUN_SUBMIT, RUN_INIT)
      await vi.waitFor(() => expect(request.waitReady).toHaveBeenCalled())
      ready(false)

      await expect(response).resolves.toBe(queued)
      expect(gpuHoldOfEachSend(send)).toEqual(['1', null])
    })

    it.for(['off', 'unavailable'])(
      'sends a Run again at once without the hold when the GPU is %s',
      async (gpu) => {
        const queued = Response.json({ prompt_id: 'job-1' })
        const send = vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(gpuStarting(gpu))
          .mockResolvedValueOnce(queued)
        const { hold, request } = readySignal()

        await expect(
          holdWhileGpuStarts(send, hold)(RUN_SUBMIT, RUN_INIT)
        ).resolves.toBe(queued)
        expect(request.answered).toHaveBeenCalledWith(gpu)
        expect(request.waitReady).not.toHaveBeenCalled()
        expect(gpuHoldOfEachSend(send)).toEqual(['1', null])
      }
    )

    it('stops holding a Run at once when the caller cancels', async () => {
      const send = honouringAbort(gpuStarting('starting'))
      const { hold, request } = readySignal()
      const controller = new AbortController()
      const reason = new DOMException('left the page', 'AbortError')

      const response = holdWhileGpuStarts(send, hold)(RUN_SUBMIT, {
        ...RUN_INIT,
        signal: controller.signal
      })
      await vi.waitFor(() => expect(request.waitReady).toHaveBeenCalled())
      controller.abort(reason)

      await expect(response).rejects.toBe(reason)
      expect(send).toHaveBeenCalledOnce()
    })

    it('answers a Run that is not held with its own response', async () => {
      const queued = Response.json({ prompt_id: 'job-1' })
      const send = vi.fn<typeof fetch>(async () => queued)
      const { hold, request } = readySignal()

      await expect(
        holdWhileGpuStarts(send, hold)(RUN_SUBMIT, RUN_INIT)
      ).resolves.toBe(queued)
      expect(request.answered).not.toHaveBeenCalled()
      expect(send).toHaveBeenCalledOnce()
    })
  })

  describe('under fetchApi', () => {
    it.for([
      { name: 'once the GPU is ready', becomesReady: true },
      {
        name: 'as a normal job when the GPU never comes on',
        becomesReady: false
      }
    ])(
      'marks the Run queuePrompt submits and sends it again $name',
      async ({ becomesReady }) => {
        vi.useFakeTimers()
        const send = honouringAbort(
          gpuStarting('starting'),
          Response.json({ prompt_id: 'job-1', node_errors: {} })
        )
        const { hold, request, ready } = readySignal()

        const queued = apiHolding(send, hold).queuePrompt(0, {
          output: {},
          workflow: emptyWorkflow()
        })
        await vi.waitFor(() => expect(request.waitReady).toHaveBeenCalled())
        await vi.advanceTimersByTimeAsync(
          FETCH_RESPONSE_HEADERS_TIMEOUT_MS + 30_000
        )
        ready(becomesReady)

        await expect(queued).resolves.toMatchObject({ prompt_id: 'job-1' })
        expect(gpuHoldOfEachSend(send)).toEqual(['1', null])
        expect(send.mock.calls[1][0]).toBe(send.mock.calls[0][0])
        expect(send.mock.calls[1][1]?.body).toBe(send.mock.calls[0][1]?.body)
      }
    )

    it('sends again when the GPU is ready after the first attempt deadline', async () => {
      vi.useFakeTimers()
      const answer = new Response('scene')
      const send = honouringAbort(gpuStarting('starting'), answer)
      const { hold, request, ready } = readySignal()

      const response = apiHolding(send, hold).fetchApi(
        '/example_pack/preview',
        {
          method: 'POST',
          body: '{}'
        }
      )
      await vi.waitFor(() => expect(request.waitReady).toHaveBeenCalled())
      await vi.advanceTimersByTimeAsync(
        FETCH_RESPONSE_HEADERS_TIMEOUT_MS + 30_000
      )
      ready(true)

      await expect(response).resolves.toBe(answer)
      expect(send).toHaveBeenCalledTimes(2)
    })

    it('still lets the caller cancel a hold that outlasts the first attempt deadline', async () => {
      vi.useFakeTimers()
      const send = honouringAbort(gpuStarting('starting'))
      const { hold, request } = readySignal()
      const controller = new AbortController()
      const reason = new DOMException('left the page', 'AbortError')

      const response = apiHolding(send, hold).fetchApi(
        '/example_pack/preview',
        {
          signal: controller.signal
        }
      )
      const settled = Promise.allSettled([response])
      await vi.waitFor(() => expect(request.waitReady).toHaveBeenCalled())
      await vi.advanceTimersByTimeAsync(
        FETCH_RESPONSE_HEADERS_TIMEOUT_MS + 30_000
      )
      controller.abort(reason)

      expect(await settled).toEqual([{ status: 'rejected', reason }])
      expect(send).toHaveBeenCalledTimes(1)
    })

    it('rejects at the deadline when a status retry after the hold stalls', async () => {
      vi.useFakeTimers()
      const send = honouringAbort(
        gpuStarting('starting'),
        new Response('bad gateway', { status: 502 }),
        'stall'
      )
      const { hold, request, ready } = readySignal()
      let outcome: PromiseSettledResult<Response> | undefined
      void Promise.allSettled([
        apiHolding(send, hold).fetchApi('/example_pack/preview')
      ]).then(([settled]) => {
        outcome = settled
      })
      await vi.waitFor(() => expect(request.waitReady).toHaveBeenCalled())
      await vi.advanceTimersByTimeAsync(
        FETCH_RESPONSE_HEADERS_TIMEOUT_MS + 30_000
      )
      ready(true)
      await vi.advanceTimersByTimeAsync(10_000)
      expect(send).toHaveBeenCalledTimes(3)

      await vi.advanceTimersByTimeAsync(FETCH_RESPONSE_HEADERS_TIMEOUT_MS)

      expect(outcome).toMatchObject({
        status: 'rejected',
        reason: { name: 'TimeoutError' }
      })
    })
  })

  it('passes any other answer through', async () => {
    const answer = new Response('busy', { status: 503 })
    const send = vi.fn<typeof fetch>(async () => answer)
    const { hold, request } = readySignal()

    await expect(
      holdWhileGpuStarts(send, hold)('/example_pack/preview')
    ).resolves.toBe(answer)
    expect(request.answered).not.toHaveBeenCalled()
  })
})
