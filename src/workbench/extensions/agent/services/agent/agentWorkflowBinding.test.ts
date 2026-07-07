import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAgentWorkflowBinding } from './agentWorkflowBinding'

function okResponse(id: string): Response {
  return new Response(JSON.stringify({ id }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('createAgentWorkflowBinding', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('collapses overlapping ensure() calls into a single POST (single-flight)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('wf-1'))
    const binding = createAgentWorkflowBinding({
      getAuthToken: () => 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      serializeGraph: () => ({})
    })

    const [a, b] = await Promise.all([binding.ensure(), binding.ensure()])

    expect(a).toBe('wf-1')
    expect(b).toBe('wf-1')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('returns the cached id without re-posting on a later ensure()', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('wf-2'))
    const binding = createAgentWorkflowBinding({
      getAuthToken: () => undefined,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      serializeGraph: () => ({})
    })

    expect(await binding.ensure()).toBe('wf-2')
    expect(await binding.ensure()).toBe('wf-2')
    expect(binding.current()).toBe('wf-2')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('resolves undefined without throwing on failure and allows a retry', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(okResponse('wf-3'))
    const binding = createAgentWorkflowBinding({
      getAuthToken: () => 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      serializeGraph: () => ({})
    })

    expect(await binding.ensure()).toBeUndefined()
    expect(binding.current()).toBeUndefined()
    // The failed attempt did not cache, so a later ensure() retries and succeeds.
    expect(await binding.ensure()).toBe('wf-3')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('sends the bearer token and workflow payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('wf-4'))
    const binding = createAgentWorkflowBinding({
      getAuthToken: () => 'secret-token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      serializeGraph: () => ({ nodes: [] })
    })

    await binding.ensure()

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/workflows')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer secret-token'
    )
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'AI Agent session',
      workflow_json: { nodes: [] }
    })
  })
})
