import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { ComfyApi } from '@/scripts/api'

const promptData = {
  output: {},
  workflow: {
    last_node_id: 0,
    last_link_id: 0,
    nodes: [],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  }
} as {
  output: ComfyApiWorkflow
  workflow: ComfyWorkflowJSON
}

describe('ComfyApi local API-node credentials', () => {
  let api: ComfyApi

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    sessionStorage.clear()
    window.name = ''
    api = new ComfyApi()
    api.clientId = 'client-a'
    Reflect.set(api, 'credentialKey', 'credential-key-a')
    api.serverFeatureFlags.value = {
      comfy_api_credentials: {
        version: 1,
        endpoint: '/api/credentials',
        websocket_auth_message: 'credential_auth'
      }
    }
  })

  it('updates the registry and authenticates the matching prompt submission', async () => {
    const fetchMock = vi
      .mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ generation: 1 }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ prompt_id: 'prompt-1', node_errors: {} }),
          { status: 200 }
        )
      )

    await expect(api.syncApiNodeCredential('fresh-token')).resolves.toBe(true)
    api.authToken = 'fresh-token'
    await api.queuePrompt(0, promptData)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/api/credentials'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Comfy-Client-Id': 'client-a',
          'X-Comfy-Credential-Key': 'credential-key-a'
        }),
        body: JSON.stringify({ auth_token_comfy_org: 'fresh-token' })
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/prompt'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Comfy-Client-Id': 'client-a',
          'X-Comfy-Credential-Key': 'credential-key-a'
        })
      })
    )
  })

  it('coalesces repeated synchronization of the same token', async () => {
    const fetchMock = vi
      .mocked(global.fetch)
      .mockResolvedValue(
        new Response(JSON.stringify({ generation: 1 }), { status: 200 })
      )

    await expect(
      Promise.all([
        api.syncApiNodeCredential('fresh-token'),
        api.syncApiNodeCredential('fresh-token')
      ])
    ).resolves.toEqual([true, true])
    await expect(api.syncApiNodeCredential('fresh-token')).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('falls back to the prompt snapshot when the server lacks the capability', async () => {
    api.serverFeatureFlags.value = {}
    const fetchMock = vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ prompt_id: 'prompt-1', node_errors: {} }), {
        status: 200
      })
    )

    await expect(api.syncApiNodeCredential('fresh-token')).resolves.toBe(false)
    api.authToken = 'fresh-token'
    await api.queuePrompt(0, promptData)

    expect(fetchMock).toHaveBeenCalledOnce()
    const request = fetchMock.mock.calls[0][1]
    expect(request?.headers).not.toHaveProperty('X-Comfy-Client-Id')
    expect(JSON.parse(String(request?.body))).toMatchObject({
      extra_data: { auth_token_comfy_org: 'fresh-token' }
    })
  })

  it('does not bind a prompt after a credential update failure', async () => {
    const fetchMock = vi
      .mocked(global.fetch)
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ prompt_id: 'prompt-1', node_errors: {} }),
          { status: 200 }
        )
      )

    await expect(api.syncApiNodeCredential('fresh-token')).resolves.toBe(false)
    api.authToken = 'fresh-token'
    await api.queuePrompt(0, fromPartial(promptData))

    const promptRequest = fetchMock.mock.calls[1][1]
    expect(promptRequest?.headers).not.toHaveProperty('X-Comfy-Client-Id')
    expect(promptRequest?.headers).not.toHaveProperty('X-Comfy-Credential-Key')
  })
})
