import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@comfyorg/telemetry/reportError'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { api } from '@/scripts/api'
import { blankGraph, defaultGraph } from '@/scripts/defaultGraph'

import {
  getDefaultWorkflow,
  initDefaultWorkflow,
  resetDefaultWorkflowForTesting
} from './defaultWorkflowService'

vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry/reportError'))

const fetchApi = vi.mocked(api.fetchApi)

const PREFETCH_TIMEOUT_MS = 10_000

const servedWorkflow: ComfyWorkflowJSON = {
  ...blankGraph,
  last_node_id: 42
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

function errorResponse(status: number): Response {
  return new Response('', { status })
}

function notJsonResponse(): Response {
  return new Response('<html>nope</html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  })
}

function stalledBodyResponse(): Response {
  return new Response(new ReadableStream({ start() {} }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

function abortingBodyResponse(signal: AbortSignal): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        signal.addEventListener('abort', () => {
          controller.error(
            new DOMException('The operation was aborted.', 'AbortError')
          )
        })
      }
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

function reportedErrorTypes(): unknown[] {
  return vi
    .mocked(reportError)
    .mock.calls.map(([, context]) => context.errorType)
}

describe('defaultWorkflowService', () => {
  beforeEach(() => {
    resetDefaultWorkflowForTesting()
  })

  it('serves the backend workflow once the route has answered', async () => {
    fetchApi.mockResolvedValue(jsonResponse(servedWorkflow))

    await initDefaultWorkflow()

    expect(fetchApi).toHaveBeenCalledWith(
      '/default_workflow',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(getDefaultWorkflow()).toEqual(servedWorkflow)
  })

  it('serves the bundled default until the route has answered', async () => {
    fetchApi.mockResolvedValue(jsonResponse(servedWorkflow))

    const ready = initDefaultWorkflow()
    expect(getDefaultWorkflow()).toEqual(defaultGraph)

    await ready
  })

  it('falls back to the bundled default on a backend without the route', async () => {
    fetchApi.mockResolvedValue(errorResponse(404))

    await initDefaultWorkflow()

    expect(getDefaultWorkflow()).toEqual(defaultGraph)
  })

  it('does not report a 404, which is how older backends answer', async () => {
    fetchApi.mockResolvedValue(errorResponse(404))

    await initDefaultWorkflow()

    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a server error and falls back to the bundled default', async () => {
    fetchApi.mockResolvedValue(errorResponse(500))

    await initDefaultWorkflow()

    expect(getDefaultWorkflow()).toEqual(defaultGraph)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'default_workflow_route_unavailable'
      })
    )
  })

  it('reports an invalid workflow and falls back to the bundled default', async () => {
    fetchApi.mockResolvedValue(jsonResponse({ not: 'a workflow' }))

    await initDefaultWorkflow()

    expect(getDefaultWorkflow()).toEqual(defaultGraph)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'default_workflow_invalid' })
    )
  })

  it('falls back to the bundled default when the body is not JSON', async () => {
    fetchApi.mockResolvedValue(notJsonResponse())

    await initDefaultWorkflow()

    expect(getDefaultWorkflow()).toEqual(defaultGraph)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'default_workflow_fetch_failed' })
    )
  })

  it('falls back to the bundled default when the request fails outright', async () => {
    fetchApi.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(initDefaultWorkflow()).resolves.toBeUndefined()
    expect(getDefaultWorkflow()).toEqual(defaultGraph)
  })

  it('requests the workflow at most once per page load', async () => {
    fetchApi.mockResolvedValue(jsonResponse(servedWorkflow))

    await Promise.all([
      initDefaultWorkflow(),
      initDefaultWorkflow(),
      initDefaultWorkflow()
    ])
    await initDefaultWorkflow()

    expect(fetchApi).toHaveBeenCalledTimes(1)
  })

  it('opens with the bundled default when the request never answers', async () => {
    vi.useFakeTimers()
    fetchApi.mockReturnValue(new Promise<Response>(() => {}))

    const ready = initDefaultWorkflow()
    await vi.advanceTimersByTimeAsync(PREFETCH_TIMEOUT_MS)
    await ready

    expect(getDefaultWorkflow()).toEqual(defaultGraph)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'default_workflow_timed_out' })
    )
    vi.useRealTimers()
  })

  it('opens with the bundled default when headers arrive but the body stalls', async () => {
    vi.useFakeTimers()
    fetchApi.mockResolvedValue(stalledBodyResponse())

    const ready = initDefaultWorkflow()
    await vi.advanceTimersByTimeAsync(PREFETCH_TIMEOUT_MS)
    await ready

    expect(getDefaultWorkflow()).toEqual(defaultGraph)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'default_workflow_timed_out' })
    )
    vi.useRealTimers()
  })

  it('aborts a stalled request instead of leaving its body pending', async () => {
    vi.useFakeTimers()
    fetchApi.mockResolvedValue(stalledBodyResponse())

    const ready = initDefaultWorkflow()
    await vi.advanceTimersByTimeAsync(PREFETCH_TIMEOUT_MS)
    await ready

    const [, options] = fetchApi.mock.calls[0] ?? []
    expect(options?.signal?.aborted).toBe(true)
    vi.useRealTimers()
  })

  it('reports the timeout once when the abort makes the body reject', async () => {
    vi.useFakeTimers()
    fetchApi.mockImplementation((_route, options) =>
      Promise.resolve(abortingBodyResponse(options!.signal!))
    )

    const ready = initDefaultWorkflow()
    await vi.advanceTimersByTimeAsync(PREFETCH_TIMEOUT_MS)
    await ready
    await vi.advanceTimersByTimeAsync(0)

    expect(getDefaultWorkflow()).toEqual(defaultGraph)
    expect(reportedErrorTypes()).toEqual(['default_workflow_timed_out'])
    vi.useRealTimers()
  })

  it('serves a workflow that arrived with a document id, without that id', async () => {
    fetchApi.mockResolvedValue(
      jsonResponse({
        ...servedWorkflow,
        id: '11111111-1111-4111-8111-111111111111'
      })
    )

    await initDefaultWorkflow()

    expect(getDefaultWorkflow()).toEqual(servedWorkflow)
  })

  it('never exposes a document id, so each caller mints its own', () => {
    expect(getDefaultWorkflow()).not.toHaveProperty('id')
  })
})

describe('defaultWorkflowService in e2e builds', () => {
  beforeEach(() => {
    resetDefaultWorkflowForTesting()
    vi.stubEnv('VITE_USE_LEGACY_DEFAULT_GRAPH', 'true')
    fetchApi.mockResolvedValue(jsonResponse(servedWorkflow))
  })

  it('never requests the route, so the pinned test graph stays pinned', async () => {
    await initDefaultWorkflow()

    expect(fetchApi).not.toHaveBeenCalled()
    expect(getDefaultWorkflow()).toEqual(defaultGraph)
  })
})
