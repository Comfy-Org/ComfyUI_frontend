import axios from 'axios'
import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import type { PromptResponse } from '@/schemas/apiSchema'
import { api as sharedApi, ComfyApi, PromptExecutionError } from '@/scripts/api'
import type { NodeExecutionId } from '@/types/nodeIdentification'

const fetchJobs = vi.hoisted(() => ({
  fetchHistory: vi.fn(),
  fetchJobDetail: vi.fn(),
  fetchQueue: vi.fn()
}))

vi.mock('axios')
vi.mock('@/platform/remote/comfyui/jobs/fetchJobs', () => fetchJobs)

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init
  })
}

function promptData(): {
  output: ComfyApiWorkflow
  workflow: ComfyWorkflowJSON
} {
  return {
    output: fromPartial<ComfyApiWorkflow>({
      1: {
        inputs: {},
        class_type: 'KSampler',
        _meta: { title: 'KSampler' }
      }
    }),
    workflow: fromPartial<ComfyWorkflowJSON>({
      version: 0.4,
      nodes: [],
      links: []
    })
  }
}

function requestBody(fetchApi: ReturnType<typeof vi.spyOn>, call = 0) {
  const init = fetchApi.mock.calls[call][1]
  return JSON.parse(String(init?.body)) as Record<string, unknown>
}

describe('PromptExecutionError', () => {
  it('formats string and node-specific prompt errors', () => {
    const response = fromPartial<PromptResponse>({
      error: 'invalid prompt',
      node_errors: {
        7: {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ message: 'bad seed', details: 'seed must be numeric' }]
        }
      }
    })

    expect(new PromptExecutionError(response, 400).toString()).toBe(
      'invalid prompt\nKSampler:\n    - bad seed: seed must be numeric'
    )
  })

  it('formats structured prompt errors without node errors', () => {
    const response = fromPartial<PromptResponse>({
      error: {
        type: 'prompt_outputs_failed_validation',
        message: 'Validation failed',
        details: 'missing node'
      }
    })

    expect(new PromptExecutionError(response).toString()).toBe(
      'Validation failed: missing node'
    )
  })
})

describe('ComfyApi queuePrompt', () => {
  it('sends front queue requests with auth and execution options', async () => {
    const api = new ComfyApi()
    api.clientId = 'client-1'
    api.authToken = 'auth-token'
    api.apiKey = 'api-key'
    const fetchApi = vi
      .spyOn(api, 'fetchApi')
      .mockResolvedValue(jsonResponse({ prompt_id: 'queued' }))

    await api.queuePrompt(-1, promptData(), {
      partialExecutionTargets: ['9:10' as NodeExecutionId],
      previewMethod: 'auto'
    })

    expect(fetchApi).toHaveBeenCalledWith('/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: fetchApi.mock.calls[0][1]?.body
    })
    expect(typeof fetchApi.mock.calls[0][1]?.body).toBe('string')
    expect(requestBody(fetchApi)).toMatchObject({
      client_id: 'client-1',
      front: true,
      partial_execution_targets: ['9:10'],
      extra_data: {
        auth_token_comfy_org: 'auth-token',
        api_key_comfy_org: 'api-key',
        comfy_usage_source: 'comfyui-frontend',
        preview_method: 'auto'
      }
    })
    expect(requestBody(fetchApi)).not.toHaveProperty('number')
  })

  it('omits default-only queue options and sets explicit queue numbers', async () => {
    const api = new ComfyApi()
    const fetchApi = vi
      .spyOn(api, 'fetchApi')
      .mockImplementation(() =>
        Promise.resolve(jsonResponse({ prompt_id: 'queued' }))
      )

    await api.queuePrompt(0, promptData(), { previewMethod: 'default' })
    await api.queuePrompt(4, promptData())

    expect(requestBody(fetchApi, 0)).toMatchObject({ client_id: '' })
    expect(requestBody(fetchApi, 0)).not.toHaveProperty('front')
    expect(requestBody(fetchApi, 0)).not.toHaveProperty('number')
    expect(
      requestBody(fetchApi, 0).extra_data as Record<string, unknown>
    ).not.toHaveProperty('preview_method')
    expect(requestBody(fetchApi, 1)).toMatchObject({ number: 4 })
  })

  it('throws parsed prompt errors from non-200 responses', async () => {
    const api = new ComfyApi()
    vi.spyOn(api, 'fetchApi').mockResolvedValue(
      jsonResponse(
        {
          error: {
            type: 'server_error',
            message: 'Server rejected prompt',
            details: 'bad output'
          }
        },
        { status: 400, statusText: 'Bad Request' }
      )
    )

    await expect(api.queuePrompt(0, promptData())).rejects.toThrow(
      'Prompt execution failed'
    )
  })

  it('wraps non-json prompt errors with status details', async () => {
    const api = new ComfyApi()
    vi.spyOn(api, 'fetchApi').mockResolvedValue(
      new Response('backend exploded', {
        status: 500,
        statusText: 'Server Error'
      })
    )

    await expect(api.queuePrompt(0, promptData())).rejects.toMatchObject({
      status: 500,
      response: {
        error: {
          message: '500 Server Error',
          details: 'backend exploded'
        }
      }
    })
  })
})

describe('ComfyApi read helpers', () => {
  it('returns localized templates, default templates, and empty non-json responses', async () => {
    const api = new ComfyApi()
    vi.mocked(axios.get)
      .mockResolvedValueOnce({
        headers: { 'content-type': 'application/json' },
        data: [{ name: 'localized' }]
      })
      .mockResolvedValueOnce({
        headers: { 'content-type': 'text/html' },
        data: '<html></html>'
      })

    await expect(api.getCoreWorkflowTemplates('fr')).resolves.toEqual([
      { name: 'localized' }
    ])
    await expect(api.getCoreWorkflowTemplates()).resolves.toEqual([])
    expect(vi.mocked(axios.get).mock.calls[0][0]).toContain(
      '/templates/index.fr.json'
    )
    expect(vi.mocked(axios.get).mock.calls[1][0]).toContain(
      '/templates/index.json'
    )
  })

  it('falls back from missing localized templates to the default index', async () => {
    const api = new ComfyApi()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(axios.get)
      .mockRejectedValueOnce(new Error('missing locale'))
      .mockResolvedValueOnce({
        headers: { 'content-type': 'application/json' },
        data: [{ name: 'default' }]
      })

    await expect(api.getCoreWorkflowTemplates('ja')).resolves.toEqual([
      { name: 'default' }
    ])
    expect(vi.mocked(axios.get).mock.calls[1][0]).toContain(
      '/templates/index.json'
    )
  })

  it('returns empty model lists for 404s and filters internal folders', async () => {
    const api = new ComfyApi()
    const fetchApi = vi
      .spyOn(api, 'fetchApi')
      .mockResolvedValueOnce(jsonResponse([], { status: 404 }))
      .mockResolvedValueOnce(
        jsonResponse([
          { name: 'checkpoints' },
          { name: 'configs' },
          { name: 'custom_nodes' }
        ])
      )
      .mockResolvedValueOnce(jsonResponse([], { status: 404 }))
      .mockResolvedValueOnce(jsonResponse(['model.safetensors']))

    await expect(api.getModelFolders()).resolves.toEqual([])
    await expect(api.getModelFolders()).resolves.toEqual([
      { name: 'checkpoints' }
    ])
    await expect(api.getModels('checkpoints')).resolves.toEqual([])
    await expect(api.getModels('checkpoints')).resolves.toEqual([
      'model.safetensors'
    ])
    expect(fetchApi).toHaveBeenCalledTimes(4)
  })

  it('handles model metadata text responses', async () => {
    const api = new ComfyApi()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(api, 'fetchApi')
      .mockResolvedValueOnce(new Response(''))
      .mockResolvedValueOnce(new Response('{"format":"safetensors"}'))
      .mockResolvedValueOnce(
        new Response('not json', { status: 200, statusText: 'OK' })
      )

    await expect(
      api.viewMetadata('checkpoints', 'a.safetensors')
    ).resolves.toBe(null)
    await expect(
      api.viewMetadata('checkpoints', 'a.safetensors')
    ).resolves.toEqual({ format: 'safetensors' })
    await expect(
      api.viewMetadata('checkpoints', 'a.safetensors')
    ).resolves.toBe(null)
  })

  it('gets fuse options only from json responses', async () => {
    const api = new ComfyApi()
    vi.mocked(axios.get)
      .mockResolvedValueOnce({
        headers: { 'content-type': 'application/json' },
        data: { keys: ['name'] }
      })
      .mockResolvedValueOnce({
        headers: { 'content-type': 'text/plain' },
        data: 'nope'
      })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(api.getFuseOptions()).resolves.toEqual({ keys: ['name'] })
    await expect(api.getFuseOptions()).resolves.toBeNull()
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('missing'))
    await expect(api.getFuseOptions()).resolves.toBeNull()
  })
})

describe('ComfyApi queue and data helpers', () => {
  it('routes item collection requests to queue or history', async () => {
    const api = new ComfyApi()
    const queue = vi.spyOn(api, 'getQueue').mockResolvedValue({
      Running: [],
      Pending: []
    })
    const historyItem = fromPartial<JobListItem>({
      id: 'history-1',
      status: 'completed',
      create_time: 1,
      priority: 0
    })
    const history = vi.spyOn(api, 'getHistory').mockResolvedValue([historyItem])

    await expect(api.getItems('queue')).resolves.toEqual({
      Running: [],
      Pending: []
    })
    await expect(api.getItems('history')).resolves.toEqual([historyItem])
    expect(queue).toHaveBeenCalledOnce()
    expect(history).toHaveBeenCalledOnce()
  })

  it('returns queue fallbacks unless errors are requested', async () => {
    const api = new ComfyApi()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchJobs.fetchQueue.mockRejectedValue(new Error('network'))

    await expect(api.getQueue()).resolves.toEqual({ Running: [], Pending: [] })
    await expect(api.getQueue({ throwOnError: true })).rejects.toThrow(
      'network'
    )
  })

  it('returns empty history when fetchHistory fails', async () => {
    const api = new ComfyApi()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchJobs.fetchHistory.mockRejectedValue(new Error('history down'))

    await expect(api.getHistory()).resolves.toEqual([])
  })

  it('posts item mutations with and without request bodies', async () => {
    const api = new ComfyApi()
    const fetchApi = vi.spyOn(api, 'fetchApi').mockResolvedValue(new Response())

    await api.deleteItem('history', 'job-1')
    await api.clearItems('queue')
    await api.interrupt(null)
    await api.interrupt('running-1')

    expect(fetchApi.mock.calls.map((call) => call[0])).toEqual([
      '/history',
      '/queue',
      '/interrupt',
      '/interrupt'
    ])
    expect(fetchApi.mock.calls[0][1]?.body).toBe(
      JSON.stringify({ delete: ['job-1'] })
    )
    expect(fetchApi.mock.calls[1][1]?.body).toBe(
      JSON.stringify({ clear: true })
    )
    expect(fetchApi.mock.calls[2][1]?.body).toBeUndefined()
    expect(fetchApi.mock.calls[3][1]?.body).toBe(
      JSON.stringify({ prompt_id: 'running-1' })
    )
  })

  it('throws unauthorized settings responses', async () => {
    const api = new ComfyApi()
    vi.spyOn(api, 'fetchApi').mockResolvedValue(
      new Response('', { status: 401, statusText: 'Unauthorized' })
    )

    await expect(api.getSettings()).rejects.toThrow('Unauthorized')
  })

  it('stores user data with default and raw-body options', async () => {
    const api = new ComfyApi()
    const fetchApi = vi
      .spyOn(api, 'fetchApi')
      .mockResolvedValue(new Response('', { status: 200 }))
    const raw = new Blob(['raw'])

    await api.storeUserData('a/b.json', { ok: true })
    await api.storeUserData('raw.bin', raw, {
      overwrite: false,
      stringify: false,
      throwOnError: false,
      full_info: true
    })

    expect(fetchApi.mock.calls[0][0]).toBe(
      '/userdata/a%2Fb.json?overwrite=true&full_info=false'
    )
    expect(fetchApi.mock.calls[0][1]?.body).toBe(JSON.stringify({ ok: true }))
    expect(fetchApi.mock.calls[1][0]).toBe(
      '/userdata/raw.bin?overwrite=false&full_info=true'
    )
    expect(fetchApi.mock.calls[1][1]?.body).toBe(raw)
  })

  it('honors storeUserData throwOnError', async () => {
    const api = new ComfyApi()
    vi.spyOn(api, 'fetchApi')
      .mockResolvedValueOnce(
        new Response('', { status: 500, statusText: 'Server Error' })
      )
      .mockResolvedValueOnce(
        new Response('', { status: 500, statusText: 'Server Error' })
      )

    await expect(api.storeUserData('bad.json', {})).rejects.toThrow(
      "Error storing user data file 'bad.json': 500 Server Error"
    )
    await expect(
      api.storeUserData('bad.json', {}, { throwOnError: false })
    ).resolves.toHaveProperty('status', 500)
  })

  it('lists full user data info by status', async () => {
    const api = new ComfyApi()
    vi.spyOn(api, 'fetchApi')
      .mockResolvedValueOnce(jsonResponse([], { status: 404 }))
      .mockResolvedValueOnce(
        new Response('', { status: 500, statusText: 'Server Error' })
      )
      .mockResolvedValueOnce(jsonResponse([{ path: 'x' }]))

    await expect(api.listUserDataFullInfo('models/')).resolves.toEqual([])
    await expect(api.listUserDataFullInfo('models/')).rejects.toThrow(
      "Error getting user data list 'models': 500 Server Error"
    )
    await expect(api.listUserDataFullInfo('models/')).resolves.toEqual([
      { path: 'x' }
    ])
  })

  it('loads global subgraph records and deferred data', async () => {
    const fetchApi = vi
      .spyOn(sharedApi, 'fetchApi')
      .mockResolvedValueOnce(jsonResponse({}, { status: 500 }))
      .mockResolvedValueOnce(
        jsonResponse({
          ready: { name: 'Ready', info: { node_pack: 'core' }, data: '{}' },
          lazy: { name: 'Lazy', info: { node_pack: 'core' } }
        })
      )
      .mockResolvedValueOnce(jsonResponse({ data: '{"lazy":true}' }))

    await expect(sharedApi.getGlobalSubgraphs()).resolves.toEqual({})
    const subgraphs = await sharedApi.getGlobalSubgraphs()

    expect(subgraphs.ready.data).toBe('{}')
    expect(subgraphs.lazy.data).toBeInstanceOf(Promise)
    await expect(subgraphs.lazy.data).resolves.toBe('{"lazy":true}')
    expect(fetchApi).toHaveBeenCalledTimes(3)
  })
})
