import { fromPartial } from '@total-typescript/shoehorn'
import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { rebuildWebsiteEndpoint } from './rebuildWebsite'

const noopLogger = { info: vi.fn(), error: vi.fn() }

type EndpointUser = { id: number; role: 'admin' | 'website-preview' } | null

const request = (user: EndpointUser): PayloadRequest =>
  fromPartial({ user, payload: { logger: noopLogger } })

const callEndpoint = async (user: EndpointUser) => {
  const response = await rebuildWebsiteEndpoint.handler(request(user))
  return { status: response.status, body: await response.json() }
}

describe('rebuild-website endpoint', () => {
  it('returns 401 for an unauthenticated request', async () => {
    const { status } = await callEndpoint(null)
    expect(status).toBe(401)
  })

  it('returns 403 for a website-preview key, without touching the hook', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { status } = await callEndpoint({ id: 2, role: 'website-preview' })

    expect(status).toBe(403)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns 500 for an admin when the deploy hook is not configured', async () => {
    vi.stubEnv('WEBSITE_DEPLOY_HOOK_URL', '')
    const { status } = await callEndpoint({ id: 1, role: 'admin' })
    expect(status).toBe(500)
  })

  it('POSTs the deploy hook for an admin', async () => {
    vi.stubEnv('WEBSITE_DEPLOY_HOOK_URL', 'https://hooks.test/deploy')
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const { status, body } = await callEndpoint({ id: 1, role: 'admin' })

    expect(status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledWith('https://hooks.test/deploy', {
      method: 'POST',
    })
  })

  it('returns 502 when the deploy hook fails', async () => {
    vi.stubEnv('WEBSITE_DEPLOY_HOOK_URL', 'https://hooks.test/deploy')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

    const { status } = await callEndpoint({ id: 1, role: 'admin' })
    expect(status).toBe(502)
  })

  it('returns 502 when the deploy hook is unreachable', async () => {
    vi.stubEnv('WEBSITE_DEPLOY_HOOK_URL', 'https://hooks.test/deploy')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

    const { status } = await callEndpoint({ id: 1, role: 'admin' })
    expect(status).toBe(502)
  })
})
