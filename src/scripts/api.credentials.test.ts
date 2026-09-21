import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { ComfyApi } from '@/scripts/api'

const promptData = {
  output: fromPartial<ComfyApiWorkflow>({}),
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
        body: JSON.stringify({
          auth_token_comfy_org: 'fresh-token',
          write_sequence: 1
        })
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

  it('does not bind a prompt to a token the server no longer holds', async () => {
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

    await expect(api.syncApiNodeCredential('token-a')).resolves.toBe(true)
    api.authToken = 'token-b'
    await api.queuePrompt(0, promptData)

    const promptRequest = fetchMock.mock.calls[1][1]
    expect(promptRequest?.headers).not.toHaveProperty('X-Comfy-Client-Id')
    expect(promptRequest?.headers).not.toHaveProperty('X-Comfy-Credential-Key')
    expect(JSON.parse(String(promptRequest?.body))).toMatchObject({
      extra_data: { auth_token_comfy_org: 'token-b' }
    })
  })

  it('marks a clear issued during an in-flight token write as the later write', async () => {
    let deliverTokenWrite: (response: Response) => void = () => {}
    const fetchMock = vi
      .mocked(global.fetch)
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            deliverTokenWrite = resolve
          })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ generation: 2 }), { status: 200 })
      )

    const tokenWrite = api.syncApiNodeCredential('token-a')
    const clear = api.syncApiNodeCredential(null)

    // The clear must not wait for the token write: logout has to close the
    // old account's session promptly, so both are on the wire at once and
    // the backend can see them in either order.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await expect(clear).resolves.toBe(true)

    // Reversed arrival: the older token write lands after the newer clear.
    deliverTokenWrite(
      new Response(JSON.stringify({ generation: 1 }), { status: 200 })
    )
    await expect(tokenWrite).resolves.toBe(false)

    const writeAt = (call: number) =>
      JSON.parse(String(fetchMock.mock.calls[call][1]?.body))
    expect(writeAt(0)).toMatchObject({ auth_token_comfy_org: 'token-a' })
    expect(writeAt(1)).toMatchObject({ auth_token_comfy_org: null })
    // The sequence is what lets the backend reject the stale write before
    // storing it, whichever order the two requests arrive in.
    expect(writeAt(1).write_sequence).toBeGreaterThan(writeAt(0).write_sequence)
  })

  it('resumes the write sequence for a client session restored after a reload', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ generation: 1 }), { status: 200 })
    )

    await expect(api.syncApiNodeCredential('token-a')).resolves.toBe(true)

    // A reload re-presents the stored credential key, and the backend still
    // holds the session while a prompt is bound to it.
    const reloaded = new ComfyApi()
    reloaded.clientId = 'client-a'
    Reflect.set(reloaded, 'credentialKey', 'credential-key-a')
    reloaded.serverFeatureFlags.value = api.serverFeatureFlags.value

    await expect(reloaded.syncApiNodeCredential('token-b')).resolves.toBe(true)

    const fetchMock = vi.mocked(global.fetch)
    const sequenceAt = (call: number) =>
      JSON.parse(String(fetchMock.mock.calls[call][1]?.body)).write_sequence
    expect(sequenceAt(1)).toBeGreaterThan(sequenceAt(0))
  })

  it('rejects a capability whose handshake identifier is not the one sent', async () => {
    api.serverFeatureFlags.value = {
      comfy_api_credentials: {
        version: 1,
        endpoint: '/api/credentials',
        websocket_auth_message: 'some_other_auth'
      }
    }
    const fetchMock = vi.mocked(global.fetch)

    await expect(api.syncApiNodeCredential('fresh-token')).resolves.toBe(false)

    expect(fetchMock).not.toHaveBeenCalled()
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
    await api.queuePrompt(0, promptData)

    const promptRequest = fetchMock.mock.calls[1][1]
    expect(promptRequest?.headers).not.toHaveProperty('X-Comfy-Client-Id')
    expect(promptRequest?.headers).not.toHaveProperty('X-Comfy-Credential-Key')
  })
})
