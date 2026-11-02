import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { api } from '@/scripts/api'
import { AgentApiError } from '@/workbench/extensions/agent/services/agent/agentRestClient'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/workbench/extensions/agent/services/agent/agentAuth'))

import { useAgentModelStore } from './agentModelStore'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const SIGNED_IN = {
  models: [
    {
      id: 'cloud:claude-opus-4-8',
      label: 'Claude Opus 4.8 (Comfy Cloud)',
      route: 'cloud',
      available: true,
      reason: null
    },
    {
      id: 'local',
      label: 'qwen (this computer)',
      route: 'local',
      available: true,
      reason: null
    },
    {
      id: 'openrouter:anthropic/claude-sonnet-5-5',
      label: 'Sonnet (OpenRouter)',
      route: 'openrouter',
      available: false,
      reason: 'no_key'
    }
  ],
  default: 'cloud:claude-opus-4-8'
}

const SIGNED_OUT = {
  models: SIGNED_IN.models.map((model) =>
    model.route === 'cloud'
      ? { ...model, available: false, reason: 'not_signed_in' }
      : model
  ),
  default: 'local'
}

describe('agentModelStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(api.fetchApi).mockReset()
  })

  it('stays unsupported on a host without the model list', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      jsonResponse(404, { error: 'not found' })
    )
    const store = useAgentModelStore()
    await store.load()

    expect(store.supported).toBe(false)
    expect(store.available).toEqual([])
    expect(store.modelForSend(null)).toBeUndefined()
    expect(store.modelForSend('t1')).toBeUndefined()
  })

  it('offers only the available models and sends the default', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(jsonResponse(200, SIGNED_IN))
    const store = useAgentModelStore()
    await store.load()

    expect(api.fetchApi).toHaveBeenCalledWith(
      '/agent/models',
      expect.objectContaining({ method: 'GET' })
    )
    expect(store.supported).toBe(true)
    expect(store.available.map((model) => model.id)).toEqual([
      'cloud:claude-opus-4-8',
      'local'
    ])
    expect(store.modelForSend(null)).toBe('cloud:claude-opus-4-8')
  })

  it('remembers the pick per chat and moves a new chat pick to its id', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(jsonResponse(200, SIGNED_IN))
    const store = useAgentModelStore()
    await store.load()

    store.select(null, 'local')
    expect(store.modelForSend(null)).toBe('local')
    store.adoptDraft('t1')

    expect(store.modelForSend('t1')).toBe('local')
    expect(store.modelForSend(null)).toBe('cloud:claude-opus-4-8')
    expect(store.modelForSend('t2')).toBe('cloud:claude-opus-4-8')
    await nextTick()
    expect(
      JSON.parse(localStorage.getItem('Comfy.Agent.ModelChoiceByThread')!)
    ).toEqual({ t1: 'local' })
  })

  it('falls back to the default when the pick is no longer offered', async () => {
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(jsonResponse(200, SIGNED_IN))
      .mockResolvedValueOnce(jsonResponse(200, SIGNED_OUT))
    const store = useAgentModelStore()
    await store.load()
    store.select('t1', 'cloud:claude-opus-4-8')

    await store.load()

    expect(store.available.map((model) => model.id)).toEqual(['local'])
    expect(store.selectedFor('t1')?.id).toBe('local')
    expect(store.modelForSend('t1')).toBe('local')
  })

  it('ignores a stored choice map it cannot read', () => {
    localStorage.setItem('Comfy.Agent.ModelChoiceByThread', '{bad')
    const store = useAgentModelStore()
    expect(store.modelForSend('t1')).toBeUndefined()
  })

  it('asks again while Cloud is still checking the login', async () => {
    vi.useFakeTimers()
    const checking = {
      ...SIGNED_OUT,
      models: SIGNED_OUT.models.map((model) =>
        model.route === 'cloud' ? { ...model, reason: 'checking' } : model
      )
    }
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(jsonResponse(200, checking))
      .mockResolvedValueOnce(jsonResponse(200, SIGNED_IN))
    const store = useAgentModelStore()
    await store.load()
    expect(store.available.map((model) => model.id)).toEqual(['local'])

    await vi.advanceTimersByTimeAsync(3000)

    expect(api.fetchApi).toHaveBeenCalledTimes(2)
    expect(store.available.map((model) => model.id)).toContain(
      'cloud:claude-opus-4-8'
    )
  })

  it('drops the pick and refreshes the list when the host refuses it', async () => {
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(jsonResponse(200, SIGNED_IN))
      .mockResolvedValueOnce(jsonResponse(200, SIGNED_OUT))
    const store = useAgentModelStore()
    await store.load()
    store.select('t1', 'cloud:claude-opus-4-8')

    const refused = new AgentApiError('model not available', 409, {
      error: 'model not available',
      code: 'MODEL_UNAVAILABLE',
      model: 'cloud:claude-opus-4-8',
      reason: 'not_signed_in'
    })
    expect(store.handleSendRefusal(refused, 't1')).toBe(true)
    await vi.waitFor(() =>
      expect(store.available.map((model) => model.id)).toEqual(['local'])
    )
    expect(store.modelForSend('t1')).toBe('local')
  })

  it('leaves other send errors alone', async () => {
    const store = useAgentModelStore()
    const busy = new AgentApiError('turn in progress', 409, {
      error: 'turn in progress'
    })
    expect(store.handleSendRefusal(busy, 't1')).toBe(false)
    expect(store.handleSendRefusal(new Error('offline'), 't1')).toBe(false)
    expect(api.fetchApi).not.toHaveBeenCalled()
  })
})
