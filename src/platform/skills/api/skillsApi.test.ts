vi.mock(import('firebase/auth'))
const distribution = vi.hoisted(() => ({ isCloud: false }))
vi.mock(import('@/platform/distribution/types'), () => distribution)

import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'

import type {
  SkillPack,
  SkillPackPublishRequest
} from '@/platform/skills/types'
import { deleteSkillPack, listSkillPacks, publishSkillPack } from './skillsApi'

vi.mock(import('@/scripts/api'))

const pack: SkillPack = {
  id: 'pack-1',
  name: 'my-pack',
  description: 'load me',
  body: 'do the thing',
  body_hash: 'abc',
  created_at: '2026-08-22T00:00:00Z',
  updated_at: '2026-08-22T00:00:00Z'
}

const payload: SkillPackPublishRequest = {
  name: pack.name,
  description: pack.description,
  body: pack.body
}

function workspaceSession(token: string | Error): void {
  useAuthStore().currentUser = fromPartial<User>({ uid: 'user-a' })
  const mint = vi.spyOn(useAuthStore(), 'getWorkspaceAuthTokenOrThrow')
  if (token instanceof Error) mint.mockRejectedValue(token)
  else mint.mockResolvedValue(token)
}

function apiKeySession(key: string): void {
  Object.assign(useApiKeyAuthStore(), { isAuthenticated: true })
  vi.spyOn(useApiKeyAuthStore(), 'getAuthHeader').mockReturnValue({
    'X-API-KEY': key
  })
}

function requestHeaders(): Headers {
  const init = vi.mocked(api.fetchApi).mock.calls[0][1]
  return new Headers(init?.headers)
}

beforeEach(() => {
  distribution.isCloud = false
})

describe('skill pack request authentication', () => {
  it('lists with the local workspace credential and redirect refusal', async () => {
    workspaceSession('workspace-token')
    vi.mocked(api.fetchApi).mockResolvedValue(Response.json({ skills: [pack] }))

    await expect(listSkillPacks()).resolves.toEqual([pack])

    expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith(
      '/agent/skills',
      expect.objectContaining({ redirect: 'error' })
    )
    expect(requestHeaders().get('Authorization')).toBe('Bearer workspace-token')
  })

  it('publishes JSON once with a local API-key session', async () => {
    apiKeySession('comfyui-key')
    vi.mocked(api.fetchApi).mockResolvedValue(Response.json(pack))

    await expect(publishSkillPack(payload)).resolves.toEqual(pack)

    expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith(
      '/agent/skills',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        redirect: 'error'
      })
    )
    expect(requestHeaders().get('Content-Type')).toBe('application/json')
    expect(requestHeaders().get('X-API-KEY')).toBe('comfyui-key')
  })

  it('deletes the encoded name once with the local workspace credential', async () => {
    workspaceSession('workspace-token')
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(null, { status: 204 })
    )

    await deleteSkillPack('my-pack')

    expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith(
      '/agent/skills/my-pack',
      expect.objectContaining({ method: 'DELETE', redirect: 'error' })
    )
  })

  it('does not send or fall back to a stored API key when workspace minting fails', async () => {
    const failure = new AuthStoreError('token exchange failed')
    workspaceSession(failure)
    apiKeySession('unrelated-key')

    await expect(publishSkillPack(payload)).rejects.toBe(failure)

    expect(api.fetchApi).not.toHaveBeenCalled()
  })

  it('sends no credential when signed out and preserves backend refusal', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json(
        { error: "this action requires the signed-in user's credential" },
        { status: 403 }
      )
    )

    await expect(publishSkillPack(payload)).rejects.toMatchObject({
      name: 'SkillPacksApiError',
      status: 403,
      message: "this action requires the signed-in user's credential"
    })

    expect(requestHeaders().has('Authorization')).toBe(false)
    expect(requestHeaders().has('X-API-KEY')).toBe(false)
  })

  it('leaves cloud authentication client-owned without minting or adding headers', async () => {
    distribution.isCloud = true
    workspaceSession('workspace-token')
    const mint = vi.mocked(useAuthStore().getWorkspaceAuthTokenOrThrow)
    vi.mocked(api.fetchApi).mockResolvedValue(Response.json(pack))

    await publishSkillPack(payload)

    expect(mint).not.toHaveBeenCalled()
    expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith('/agent/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  })
})

describe('skill pack error responses', () => {
  it('preserves plain-text proxy failure messages', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response('Upstream service unavailable', { status: 502 })
    )

    await expect(listSkillPacks()).rejects.toMatchObject({
      name: 'SkillPacksApiError',
      status: 502,
      message: 'Upstream service unavailable'
    })
  })

  it.for([
    {
      status: 400,
      body: { error: 'Instructions are required' },
      message: 'Instructions are required'
    },
    {
      status: 409,
      body: { error: 'Total size exceeds the configured budget' },
      message: 'Total size exceeds the configured budget'
    },
    {
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Skills are unavailable' },
      message: 'Skills are unavailable'
    },
    {
      status: 404,
      body: { error: 'NOT_FOUND', message: 'Skills are unavailable' },
      message: 'Skills are unavailable'
    }
  ])('preserves HTTP $status and the corrective message', async (testCase) => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json(testCase.body, { status: testCase.status })
    )

    await expect(listSkillPacks()).rejects.toMatchObject({
      name: 'SkillPacksApiError',
      status: testCase.status,
      message: testCase.message
    })
  })
})
