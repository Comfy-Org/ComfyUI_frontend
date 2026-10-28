import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { blankGraph, defaultGraph } from '@/scripts/defaultGraph'

import {
  getDefaultWorkflow,
  initDefaultWorkflow,
  resetDefaultWorkflowForTesting
} from './defaultWorkflowService'

vi.mock(import('@/scripts/api'))

const fetchApi = vi.mocked(api.fetchApi)

/** A valid workflow that is not the bundled default, so the two are telling apart. */
const servedWorkflow: ComfyWorkflowJSON = {
  ...blankGraph,
  last_node_id: 42
}

const jsonResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body)
  }) as unknown as Response

const errorResponse = (status: number) =>
  ({
    ok: false,
    status,
    json: () => Promise.reject(new Error('should not be read'))
  }) as unknown as Response

describe('defaultWorkflowService', () => {
  beforeEach(() => {
    resetDefaultWorkflowForTesting()
    fetchApi.mockReset()
  })

  it('serves the backend workflow once the route has answered', async () => {
    fetchApi.mockResolvedValue(jsonResponse(servedWorkflow))

    await initDefaultWorkflow()

    expect(fetchApi).toHaveBeenCalledWith('/default_workflow')
    expect(getDefaultWorkflow()).toEqual(servedWorkflow)
  })

  it('serves the bundled default until the route has answered', () => {
    fetchApi.mockResolvedValue(jsonResponse(servedWorkflow))

    void initDefaultWorkflow()

    expect(getDefaultWorkflow()).toBe(defaultGraph)
  })

  it('falls back to the bundled default on a backend without the route', async () => {
    fetchApi.mockResolvedValue(errorResponse(404))

    await initDefaultWorkflow()

    expect(getDefaultWorkflow()).toBe(defaultGraph)
  })

  it('does not warn about a 404, which is how older backends answer', async () => {
    fetchApi.mockResolvedValue(errorResponse(404))

    await initDefaultWorkflow()

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('falls back to the bundled default on a server error', async () => {
    fetchApi.mockResolvedValue(errorResponse(500))

    await initDefaultWorkflow()

    expect(getDefaultWorkflow()).toBe(defaultGraph)
    expect(console.warn).toHaveBeenCalled()
  })

  it('falls back to the bundled default when the route serves an invalid workflow', async () => {
    fetchApi.mockResolvedValue(jsonResponse({ not: 'a workflow' }))

    await initDefaultWorkflow()

    expect(getDefaultWorkflow()).toBe(defaultGraph)
    expect(console.warn).toHaveBeenCalled()
  })

  it('falls back to the bundled default when the body is not JSON', async () => {
    fetchApi.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('Unexpected token <'))
    } as unknown as Response)

    await initDefaultWorkflow()

    expect(getDefaultWorkflow()).toBe(defaultGraph)
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
})

describe('defaultWorkflowService in e2e builds', () => {
  beforeEach(() => {
    resetDefaultWorkflowForTesting()
    vi.stubEnv('VITE_USE_LEGACY_DEFAULT_GRAPH', 'true')
    fetchApi.mockReset()
    fetchApi.mockResolvedValue(jsonResponse(servedWorkflow))
  })

  it('never requests the route, so the pinned test graph stays pinned', async () => {
    await initDefaultWorkflow()

    expect(fetchApi).not.toHaveBeenCalled()
    expect(getDefaultWorkflow()).toBe(defaultGraph)
  })
})
