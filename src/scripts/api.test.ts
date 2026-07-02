import { fromAny } from '@total-typescript/shoehorn'
import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  api as singletonApi,
  ComfyApi,
  PromptExecutionError,
  UnauthorizedError
} from '@/scripts/api'
import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { fetchWithUnifiedRemint } from '@/platform/auth/unified/remintRetry'

const { mockToastStore } = vi.hoisted(() => ({
  mockToastStore: {
    add: vi.fn()
  }
}))

vi.mock('@/platform/auth/unified/remintRetry', () => ({
  fetchWithUnifiedRemint: vi.fn(),
  shouldRemintCloudRequest: vi.fn()
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: vi.fn(() => mockToastStore)
}))

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn()
  }
}))

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = []

  binaryType = ''
  sent: string[] = []

  constructor(readonly url: string) {
    super()
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.dispatchEvent(new Event('close'))
  }
}

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  })
}

function createWorkflow() {
  return {
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

function binaryMessage(type: number, payload: Uint8Array) {
  const bytes = new Uint8Array(4 + payload.length)
  new DataView(bytes.buffer).setUint32(0, type)
  bytes.set(payload, 4)
  return bytes.buffer
}

function uint32(value: number) {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value)
  return bytes
}

function concatBytes(...chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

describe('PromptExecutionError', () => {
  it('formats string, structured, and node-level errors', () => {
    expect(
      new PromptExecutionError({
        error: 'Queue rejected',
        node_errors: {}
      }).toString()
    ).toBe('Queue rejected')

    expect(
      new PromptExecutionError({
        error: {
          type: 'invalid_prompt',
          message: 'Invalid prompt',
          details: 'missing input'
        },
        node_errors: {
          1: {
            class_type: 'PreviewAny',
            dependent_outputs: ['1'],
            errors: [
              {
                type: 'required_input_missing',
                message: 'Required input',
                details: 'source'
              }
            ]
          }
        }
      }).toString()
    ).toContain('Invalid prompt: missing input\nPreviewAny:')
  })
})

describe('ComfyApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    FakeWebSocket.instances = []
    window.name = ''
    sessionStorage.clear()
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('builds API, internal, file, and fetch URLs with user headers', async () => {
    const api = new ComfyApi()
    api.user = 'reviewer'
    vi.mocked(fetchWithUnifiedRemint).mockResolvedValue(
      jsonResponse({ ok: true })
    )

    await api.fetchApi('/queue', {
      headers: new Headers([['X-Test', '1']])
    })

    expect(api.apiURL('/api/custom')).toBe(`${api.api_base}/api/custom`)
    expect(api.apiURL('/queue')).toBe(`${api.api_base}/api/queue`)
    expect(api.internalURL('/logs')).toBe(`${api.api_base}/internal/logs`)
    expect(api.fileURL('/view')).toBe(`${api.api_base}/view`)
    const [, options] = vi.mocked(fetchWithUnifiedRemint).mock.calls[0]
    expect(options.headers).toBeInstanceOf(Headers)
    expect((options.headers as Headers).get('Comfy-User')).toBe('reviewer')
    expect((options.headers as Headers).get('X-Test')).toBe('1')
  })

  it('guards event listeners and still allows removing them', async () => {
    const api = new ComfyApi()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const listener = vi.fn()
    const throwingListener = vi.fn(() => {
      throw new Error('listener failed')
    })
    const asyncListener = vi.fn(() => Promise.reject(new Error('async failed')))
    const objectListener = { handleEvent: vi.fn() }

    api.addEventListener('status', null)
    api.removeEventListener('status', null)
    api.addEventListener('status', listener)
    api.addEventListener('status', throwingListener)
    api.addEventListener('status', asyncListener)
    api.addEventListener('status', fromAny(objectListener))

    api.dispatchCustomEvent('status', { exec_info: { queue_remaining: 1 } })
    await Promise.resolve()

    expect(listener).toHaveBeenCalled()
    expect(throwingListener).toHaveBeenCalled()
    expect(asyncListener).toHaveBeenCalled()
    expect(objectListener.handleEvent).toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(2)

    api.removeEventListener('status', listener)
    api.dispatchCustomEvent('status', null)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('reuses guarded listener wrappers and ignores unknown removals', () => {
    const api = new ComfyApi()
    const listener = vi.fn()
    const neverRegistered = vi.fn()

    api.addEventListener('status', listener)
    api.addEventListener('status', listener)
    api.removeEventListener('status', neverRegistered)
    api.dispatchCustomEvent('status', null)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(neverRegistered).not.toHaveBeenCalled()
  })

  it('supports guarded custom event listeners', () => {
    const api = new ComfyApi()
    const listener = vi.fn()

    api.addCustomEventListener('custom-node-event', listener)
    ;(api as EventTarget).dispatchEvent(
      new CustomEvent('custom-node-event', { detail: { ok: true } })
    )
    api.removeCustomEventListener('custom-node-event', listener)
    ;(api as EventTarget).dispatchEvent(
      new CustomEvent('custom-node-event', { detail: { ok: false } })
    )

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('routes websocket JSON messages and custom registered messages', () => {
    window.name = 'existing-client'
    const api = new ComfyApi()
    const status = vi.fn()
    const executing = vi.fn()
    const featureFlags = vi.fn()
    const custom = vi.fn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    api.addEventListener('status', status)
    api.addEventListener('executing', executing)
    api.addEventListener('feature_flags', featureFlags)
    api.addCustomEventListener('custom-message', custom)
    api.init()
    const socket = FakeWebSocket.instances[0]
    socket.dispatchEvent(new Event('open'))

    expect(socket.url).toContain('clientId=existing-client')
    expect(JSON.parse(socket.sent[0])).toMatchObject({
      type: 'feature_flags'
    })

    socket.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'status',
          data: {
            sid: 'fresh-client',
            status: { exec_info: { queue_remaining: 2 } }
          }
        })
      })
    )
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'executing',
          data: { node: '12' }
        })
      })
    )
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'feature_flags',
          data: { supports_progress_text_metadata: true }
        })
      })
    )
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'custom-message',
          data: { from: 'extension' }
        })
      })
    )
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'unknown-message',
          data: {}
        })
      })
    )
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'unknown-message',
          data: {}
        })
      })
    )

    expect(api.clientId).toBe('fresh-client')
    expect(window.name).toBe('fresh-client')
    expect(sessionStorage.getItem('clientId')).toBe('fresh-client')
    expect(status).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { exec_info: { queue_remaining: 2 } }
      })
    )
    expect(executing).toHaveBeenCalledWith(
      expect.objectContaining({ detail: '12' })
    )
    expect(featureFlags).toHaveBeenCalled()
    expect(api.serverSupportsFeature('supports_progress_text_metadata')).toBe(
      true
    )
    expect(custom).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { from: 'extension' } })
    )
    expect(api.reportedUnknownMessageTypes.has('unknown-message')).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('polls status when the initial websocket connection fails', async () => {
    vi.useFakeTimers()
    const api = new ComfyApi()
    const status = vi.fn()
    vi.spyOn(api, 'fetchApi')
      .mockResolvedValueOnce(
        jsonResponse({ exec_info: { queue_remaining: 4 } })
      )
      .mockRejectedValueOnce(new Error('poll failed'))
    api.addEventListener('status', status)

    api.init()
    FakeWebSocket.instances[0].dispatchEvent(new Event('error'))
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)

    expect(status).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { exec_info: { queue_remaining: 4 } }
      })
    )
    expect(status).toHaveBeenCalledWith(
      expect.objectContaining({ detail: null })
    )
    vi.useRealTimers()
  })

  it('emits reconnect lifecycle events after an opened websocket closes', async () => {
    vi.useFakeTimers()
    const api = new ComfyApi()
    const status = vi.fn()
    const reconnecting = vi.fn()
    const reconnected = vi.fn()
    api.addEventListener('status', status)
    api.addEventListener('reconnecting', reconnecting)
    api.addEventListener('reconnected', reconnected)

    api.init()
    const socket = FakeWebSocket.instances[0]
    socket.dispatchEvent(new Event('open'))
    socket.close()

    expect(status).toHaveBeenCalledWith(
      expect.objectContaining({ detail: null })
    )
    expect(reconnecting).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(300)
    const reconnectSocket = FakeWebSocket.instances[1]
    reconnectSocket.dispatchEvent(new Event('open'))

    expect(reconnected).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('routes websocket variants without session ids and display-node fallbacks', () => {
    const api = new ComfyApi()
    const status = vi.fn()
    const executing = vi.fn()
    api.addEventListener('status', status)
    api.addEventListener('executing', executing)
    api.init()
    const socket = FakeWebSocket.instances[0]

    socket.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'status',
          data: { status: undefined }
        })
      })
    )
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'executing',
          data: { node: 'real', display_node: 'display' }
        })
      })
    )

    expect(status).toHaveBeenCalledWith(
      expect.objectContaining({ detail: null })
    )
    expect(executing).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'display' })
    )
  })

  it('routes binary preview and progress websocket messages', () => {
    const api = new ComfyApi()
    const preview = vi.fn()
    const previewWithMetadata = vi.fn()
    const progressText = vi.fn()
    const encoder = new TextEncoder()
    api.serverFeatureFlags.value = {
      supports_progress_text_metadata: true
    }
    api.addEventListener('b_preview', preview)
    api.addEventListener('b_preview_with_metadata', previewWithMetadata)
    api.addEventListener('progress_text', progressText)
    api.init()
    const socket = FakeWebSocket.instances[0]

    socket.dispatchEvent(
      new MessageEvent('message', {
        data: binaryMessage(1, concatBytes(uint32(2), new Uint8Array([1, 2])))
      })
    )

    const promptId = encoder.encode('prompt-1')
    const nodeId = encoder.encode('7')
    const progressPayload = concatBytes(
      uint32(promptId.length),
      promptId,
      uint32(nodeId.length),
      nodeId,
      encoder.encode('loading')
    )
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: binaryMessage(3, progressPayload)
      })
    )

    const metadata = encoder.encode(
      JSON.stringify({
        image_type: 'image/webp',
        node_id: '7',
        display_node_id: '7',
        parent_node_id: '4',
        real_node_id: '7',
        prompt_id: 'prompt-1'
      })
    )
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: binaryMessage(
          4,
          concatBytes(uint32(metadata.length), metadata, new Uint8Array([9]))
        )
      })
    )

    expect(preview).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ type: 'image/png' })
      })
    )
    expect(progressText).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          nodeId: '7',
          text: 'loading',
          prompt_id: 'prompt-1'
        }
      })
    )
    expect(previewWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          nodeId: '7',
          parentNodeId: '4',
          jobId: 'prompt-1'
        })
      })
    )
  })

  it('routes binary jpeg/default previews and malformed binary messages defensively', () => {
    const api = new ComfyApi()
    const preview = vi.fn()
    const progressText = vi.fn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const encoder = new TextEncoder()
    api.addEventListener('b_preview', preview)
    api.addEventListener('progress_text', progressText)
    api.init()
    const socket = FakeWebSocket.instances[0]

    socket.dispatchEvent(
      new MessageEvent('message', {
        data: binaryMessage(1, concatBytes(uint32(1), new Uint8Array([1])))
      })
    )
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: binaryMessage(1, concatBytes(uint32(99), new Uint8Array([2])))
      })
    )

    const nodeId = encoder.encode('node')
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: binaryMessage(
          3,
          concatBytes(uint32(nodeId.length), nodeId, encoder.encode('ready'))
        )
      })
    )
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: binaryMessage(3, new Uint8Array([1]))
      })
    )
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: binaryMessage(99, new Uint8Array())
      })
    )

    expect(preview).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ type: 'image/jpeg' })
      })
    )
    expect(progressText).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { nodeId: 'node', text: 'ready' }
      })
    )
    expect(warn).toHaveBeenCalled()
  })

  it('serializes prompt queue options and surfaces non-200 errors', async () => {
    const api = new ComfyApi()
    api.clientId = 'client-1'
    api.authToken = 'token-1'
    api.apiKey = 'key-1'
    const prompt: ComfyApiWorkflow = {
      1: {
        class_type: 'PreviewAny',
        inputs: {},
        _meta: { title: 'PreviewAny' }
      }
    }
    const fetchApi = vi
      .spyOn(api, 'fetchApi')
      .mockResolvedValueOnce(jsonResponse({ prompt_id: 'queued' }))
      .mockResolvedValueOnce(
        new Response('backend exploded', {
          status: 500,
          statusText: 'Server Error'
        })
      )

    await expect(
      api.queuePrompt(
        -1,
        { output: prompt, workflow: createWorkflow() },
        {
          partialExecutionTargets: ['7' as NodeExecutionId],
          previewMethod: 'latent2rgb'
        }
      )
    ).resolves.toEqual({ prompt_id: 'queued' })

    const body = JSON.parse(fetchApi.mock.calls[0][1]?.body as string)
    expect(body).toMatchObject({
      client_id: 'client-1',
      prompt,
      partial_execution_targets: ['7'],
      front: true,
      extra_data: {
        auth_token_comfy_org: 'token-1',
        api_key_comfy_org: 'key-1',
        comfy_usage_source: 'comfyui-frontend',
        preview_method: 'latent2rgb'
      }
    })
    expect(body.number).toBeUndefined()

    await expect(
      api.queuePrompt(3, { output: prompt, workflow: createWorkflow() })
    ).rejects.toMatchObject({ status: 500 })
  })

  it('omits queue position and default preview method for normal queueing', async () => {
    const api = new ComfyApi()
    const prompt: ComfyApiWorkflow = {
      1: {
        class_type: 'PreviewAny',
        inputs: {},
        _meta: { title: 'PreviewAny' }
      }
    }
    const fetchApi = vi
      .spyOn(api, 'fetchApi')
      .mockResolvedValue(jsonResponse({ prompt_id: 'queued' }))

    await api.queuePrompt(
      0,
      { output: prompt, workflow: createWorkflow() },
      {
        previewMethod: 'default'
      }
    )

    const body = JSON.parse(fetchApi.mock.calls[0][1]?.body as string)
    expect(body.front).toBeUndefined()
    expect(body.number).toBeUndefined()
    expect(body.extra_data.preview_method).toBeUndefined()
  })

  it('handles shareable assets, settings, userdata, subgraphs, and memory APIs', async () => {
    const api = new ComfyApi()
    const prompt: ComfyApiWorkflow = {
      1: {
        class_type: 'PreviewAny',
        inputs: {},
        _meta: { title: 'PreviewAny' }
      }
    }
    vi.spyOn(api, 'fetchApi')
      .mockResolvedValueOnce(jsonResponse({ assets: [] }))
      .mockResolvedValueOnce(jsonResponse({}, { status: 500 }))
      .mockResolvedValueOnce(
        new Response('', { status: 401, statusText: 'Unauthorized' })
      )
      .mockResolvedValueOnce(jsonResponse({}, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse([], { status: 404 }))
      .mockResolvedValueOnce(
        jsonResponse({}, { status: 500, statusText: 'Server Error' })
      )
      .mockResolvedValueOnce(jsonResponse({}, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({}, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({}, { status: 500 }))
    vi.spyOn(singletonApi, 'fetchApi')
      .mockResolvedValueOnce(jsonResponse({ data: 'subgraph-data' }))
      .mockResolvedValueOnce(jsonResponse({ missing: {} }))
      .mockResolvedValueOnce(jsonResponse({ one: { data: 'inline' } }))

    await expect(
      api.getShareableAssets(prompt, { owned: false })
    ).resolves.toEqual({ assets: [] })
    await expect(api.getShareableAssets(prompt)).rejects.toThrow(
      'Failed to fetch shareable assets'
    )
    await expect(api.getSettings()).rejects.toBeInstanceOf(UnauthorizedError)
    await expect(
      api.storeUserData('plain.txt', 'raw', {
        overwrite: false,
        stringify: false,
        throwOnError: false,
        full_info: true
      })
    ).resolves.toHaveProperty('status', 204)
    await expect(api.listUserDataFullInfo('/missing/')).resolves.toEqual([])
    await expect(api.listUserDataFullInfo('/broken/')).rejects.toThrow(
      "Error getting user data list '/broken'"
    )
    await expect(api.getGlobalSubgraphData('one')).resolves.toBe(
      'subgraph-data'
    )
    await expect(api.getGlobalSubgraphData('missing')).rejects.toThrow(
      "Global subgraph 'missing' returned empty data"
    )
    await expect(api.getGlobalSubgraphs()).resolves.toEqual({
      one: { data: 'inline' }
    })
    await api.freeMemory({ freeExecutionCache: true })
    await api.freeMemory({ freeExecutionCache: false })
    await api.freeMemory({ freeExecutionCache: true })
    expect(mockToastStore.add).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: 'Models and Execution Cache have been cleared.'
      })
    )
    expect(mockToastStore.add).toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'Models have been unloaded.' })
    )
    expect(mockToastStore.add).toHaveBeenCalledWith(
      expect.objectContaining({
        summary:
          'Unloading of models failed. Installed ComfyUI may be an outdated version.'
      })
    )
  })

  it('rejects non-success global subgraph data responses', async () => {
    const api = new ComfyApi()
    vi.spyOn(singletonApi, 'fetchApi').mockResolvedValueOnce(
      jsonResponse({}, { status: 404, statusText: 'Not Found' })
    )

    await expect(api.getGlobalSubgraphData('missing')).rejects.toThrow(
      "Failed to fetch global subgraph 'missing': 404 Not Found"
    )
  })

  it('handles successful settings and userdata helper request shapes', async () => {
    const api = new ComfyApi()
    const fetchApi = vi
      .spyOn(api, 'fetchApi')
      .mockResolvedValueOnce(jsonResponse({ theme: 'dark' }))
      .mockResolvedValueOnce(jsonResponse({}, { status: 500 }))
      .mockResolvedValueOnce(jsonResponse({}, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({}, { status: 200 }))

    await expect(api.getSettings()).resolves.toEqual({ theme: 'dark' })
    await expect(api.storeUserData('bad.json', { a: 1 })).rejects.toThrow(
      "Error storing user data file 'bad.json'"
    )
    await api.moveUserData('old/path.json', 'new path.json')
    await api.deleteUserData('old/path.json')

    expect(fetchApi.mock.calls[2]).toEqual([
      '/userdata/old%2Fpath.json/move/new%20path.json?overwrite=false',
      { method: 'POST' }
    ])
    expect(fetchApi.mock.calls[3]).toEqual([
      '/userdata/old%2Fpath.json',
      { method: 'DELETE' }
    ])
  })

  it('handles global subgraph fallbacks and log endpoints', async () => {
    const api = new ComfyApi()
    vi.spyOn(singletonApi, 'fetchApi')
      .mockResolvedValueOnce(jsonResponse({}, { status: 500 }))
      .mockResolvedValueOnce(
        jsonResponse({
          missing: {
            name: 'Missing data',
            info: { node_pack: 'core' }
          }
        })
      )
      .mockResolvedValueOnce(jsonResponse({ data: 'lazy-data' }))
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: 'log text', headers: {} })
      .mockResolvedValueOnce({ data: { logs: [] }, headers: {} })
      .mockRejectedValueOnce(new Error('no folders'))
      .mockResolvedValueOnce({
        data: { checkpoints: ['/models'] },
        headers: {}
      })
    vi.mocked(axios.patch).mockResolvedValue({ data: undefined })

    await expect(api.getGlobalSubgraphs()).resolves.toEqual({})
    const subgraphs = await api.getGlobalSubgraphs()
    await expect(subgraphs.missing.data).resolves.toBe('lazy-data')
    await expect(api.getLogs()).resolves.toBe('log text')
    await expect(api.getRawLogs()).resolves.toEqual({ logs: [] })
    await api.subscribeLogs(true)
    await expect(api.getFolderPaths()).resolves.toEqual({})
    await expect(api.getFolderPaths()).resolves.toEqual({
      checkpoints: ['/models']
    })

    expect(axios.patch).toHaveBeenCalledWith(
      api.internalURL('/logs/subscribe'),
      { enabled: true, clientId: undefined }
    )
  })

  it('loads localized template indexes and fuse options defensively', async () => {
    const api = new ComfyApi()
    vi.mocked(axios.get)
      .mockResolvedValueOnce({
        data: [{ name: 'template' }],
        headers: { 'content-type': 'application/json' }
      })
      .mockResolvedValueOnce({
        data: '<html></html>',
        headers: { 'content-type': 'text/html' }
      })
      .mockRejectedValueOnce(new Error('missing locale'))
      .mockResolvedValueOnce({
        data: [{ name: 'fallback' }],
        headers: { 'content-type': 'application/json' }
      })
      .mockRejectedValueOnce(new Error('default missing'))
      .mockResolvedValueOnce({
        data: { keys: ['name'] },
        headers: { 'content-type': 'application/json' }
      })
      .mockResolvedValueOnce({
        data: '<html></html>',
        headers: { 'content-type': 'text/html' }
      })
      .mockResolvedValueOnce({
        data: { ignored: true },
        headers: {}
      })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(api.getCoreWorkflowTemplates('fr')).resolves.toEqual([
      { name: 'template' }
    ])
    await expect(api.getCoreWorkflowTemplates()).resolves.toEqual([])
    await expect(api.getCoreWorkflowTemplates('zh')).resolves.toEqual([
      { name: 'fallback' }
    ])
    await expect(api.getCoreWorkflowTemplates('en')).resolves.toEqual([])
    await expect(api.getFuseOptions()).resolves.toEqual({ keys: ['name'] })
    await expect(api.getFuseOptions()).resolves.toBeNull()
    await expect(api.getFuseOptions()).resolves.toBeNull()
  })
})
