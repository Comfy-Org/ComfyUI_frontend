import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { describe, expect, it, vi } from 'vitest'

import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import { listWorkspaces } from './workspaces'

const workspace = {
  id: 'ws-1',
  name: 'Personal',
  role: 'owner',
  type: 'personal',
  subscription_tier: 'PRO',
  created_at: '2026-01-01T00:00:00Z',
  joined_at: '2026-01-01T00:00:00Z'
} as const

const WORKSPACES_URL = new URL('/api/workspaces', WORKSHOP_CLOUD_BASE_URL).href

const fetchUntilAborted: typeof fetch = (_input, init) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal
    if (!signal) {
      reject(new Error('Expected listWorkspaces to pass an abort signal'))
      return
    }
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    signal.addEventListener('abort', () => reject(signal.reason), {
      once: true
    })
  })

describe('listWorkspaces', () => {
  it('returns the parsed workspace list with its scoped authorization', async () => {
    respondToFetch(WORKSPACES_URL, () =>
      Response.json({ workspaces: [workspace] })
    )

    await expect(listWorkspaces('workspace-jwt')).resolves.toEqual([workspace])
    expect(fetchRequests(WORKSPACES_URL)[0].headers.get('Authorization')).toBe(
      'Bearer workspace-jwt'
    )
  })

  it.for([
    ['invalid JSON', '{'],
    ['the wrong schema', JSON.stringify({ workspaces: [{ id: 1 }] })]
  ] as const)('rejects %s', async ([, body]) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(body, { status: 200 }))

    await expect(listWorkspaces('workspace-jwt')).rejects.toThrow(
      'Workspace list response malformed'
    )
  })

  it('rejects a non-success response before parsing it', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 503 }))

    await expect(listWorkspaces('workspace-jwt')).rejects.toThrow(
      'Workspace list failed with status 503'
    )
  })

  it('composes and honors a caller-provided abort signal', async () => {
    vi.mocked(fetch).mockImplementation(fetchUntilAborted)
    const controller = new AbortController()
    const reason = new DOMException('Caller stopped', 'AbortError')

    const pending = listWorkspaces('workspace-jwt', {
      signal: controller.signal,
      timeoutMs: 60_000
    })
    controller.abort(reason)

    await expect(pending).rejects.toBe(reason)
    const passedSignal = vi.mocked(fetch).mock.calls[0][1]?.signal
    expect(passedSignal).not.toBe(controller.signal)
    expect(passedSignal?.aborted).toBe(true)
  })

  it('honors the configured timeout signal', async () => {
    const timeout = new AbortController()
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeout.signal)
    vi.mocked(fetch).mockImplementation(fetchUntilAborted)
    const reason = new DOMException('Timed out', 'TimeoutError')

    const pending = listWorkspaces('workspace-jwt', { timeoutMs: 25 })
    timeout.abort(reason)

    await expect(pending).rejects.toBe(reason)
    expect(timeoutSpy).toHaveBeenCalledWith(25)
  })
})
