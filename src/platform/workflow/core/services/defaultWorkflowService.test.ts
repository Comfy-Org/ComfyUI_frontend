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

const servedWorkflow: ComfyWorkflowJSON = {
  ...blankGraph,
  last_node_id: 42
}

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })

const errorResponse = (status: number) => new Response('', { status })

const notJsonResponse = () =>
  new Response('<html>nope</html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  })

const stalledBodyResponse = () =>
  new Response(new ReadableStream({ start() {} }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })

describe('defaultWorkflowService', () => {
  beforeEach(() => {
    resetDefaultWorkflowForTesting()
  })

  it('serves the backend workflow once the route has answered', async () => {
    fetchApi.mockResolvedValue(jsonResponse(servedWorkflow))

    await initDefaultWorkflow()

    expect(fetchApi).toHaveBeenCalledWith('/default_workflow')
    expect(getDefaultWorkflow()).toEqual(servedWorkflow)
  })

  it('serves the bundled default until the route has answered', async () => {
    fetchApi.mockResolvedValue(jsonResponse(servedWorkflow))

    const ready = initDefaultWorkflow()
    expect(getDefaultWorkflow()).toBe(defaultGraph)

    await ready
  })

  it('falls back to the bundled default on a backend without the route', async () => {
    fetchApi.mockResolvedValue(errorResponse(404))

    await initDefaultWorkflow()

    expect(getDefaultWorkflow()).toBe(defaultGraph)
  })

  it('does not report a 404, which is how older backends answer', async () => {
    fetchApi.mockResolvedValue(errorResponse(404))

    await initDefaultWorkflow()

    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a server error and falls back to the bundled default', async () => {
    fetchApi.mockResolvedValue(errorResponse(500))

    await initDefaultWorkflow()

    expect(getDefaultWorkflow()).toBe(defaultGraph)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'DefaultWorkflowRouteUnavailable' })
    )
  })

  it('reports an invalid workflow and falls back to the bundled default', async () => {
    fetchApi.mockResolvedValue(jsonResponse({ not: 'a workflow' }))

    await initDefaultWorkflow()

    expect(getDefaultWorkflow()).toBe(defaultGraph)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'DefaultWorkflowInvalid' })
    )
  })

  it('falls back to the bundled default when the body is not JSON', async () => {
    fetchApi.mockResolvedValue(notJsonResponse())

    await initDefaultWorkflow()

    expect(getDefaultWorkflow()).toBe(defaultGraph)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'DefaultWorkflowFetchFailed' })
    )
  })

  it('falls back to the bundled default when the request fails outright', async () => {
    fetchApi.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(initDefaultWorkflow()).resolves.toBeUndefined()
    expect(getDefaultWorkflow()).toBe(defaultGraph)
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
    await vi.advanceTimersByTimeAsync(10_000)
    await ready

    expect(getDefaultWorkflow()).toBe(defaultGraph)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'DefaultWorkflowTimedOut' })
    )
    vi.useRealTimers()
  })

  it('opens with the bundled default when headers arrive but the body stalls', async () => {
    vi.useFakeTimers()
    fetchApi.mockResolvedValue(stalledBodyResponse())

    const ready = initDefaultWorkflow()
    await vi.advanceTimersByTimeAsync(10_000)
    await ready

    expect(getDefaultWorkflow()).toBe(defaultGraph)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'DefaultWorkflowTimedOut' })
    )
    vi.useRealTimers()
  })

  it('does not hand a served workflow its own document id to new tabs', async () => {
    fetchApi.mockResolvedValue(
      jsonResponse({
        ...servedWorkflow,
        id: '11111111-1111-4111-8111-111111111111'
      })
    )

    await initDefaultWorkflow()

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
    expect(getDefaultWorkflow()).toBe(defaultGraph)
  })
})
