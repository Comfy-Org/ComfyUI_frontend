import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchApi = vi.hoisted(() =>
  vi.fn<(route: string, init?: RequestInit) => Promise<Response>>()
)
vi.mock('@/scripts/api', () => ({ api: { fetchApi } }))

import { useAgentRunModeStore } from './agentRunModeStore'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('agentRunModeStore', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchApi.mockReset()
    setActivePinia(createPinia())
  })

  it('uses the safe fallback when loading gets 404 with invalid local state', async () => {
    localStorage.setItem('Comfy.Agent.RunModePreference', '{invalid')
    fetchApi.mockResolvedValueOnce(jsonResponse(404, { error: 'not found' }))

    const store = useAgentRunModeStore()
    await store.load()

    expect(store.mode).toBe('ask_approval')
    expect(store.creditLimit).toBeNull()
  })

  it('migrates a legacy preference when loading gets 404', async () => {
    localStorage.setItem('Comfy.Agent.RunMode', 'auto-limit')
    localStorage.setItem('Comfy.Agent.RunCreditLimit', '75')
    fetchApi.mockResolvedValueOnce(jsonResponse(404, { error: 'not found' }))

    const store = useAgentRunModeStore()
    await store.load()

    expect(store.mode).toBe('auto_limited')
    expect(store.creditLimit).toBe(75)
    expect(
      JSON.parse(localStorage.getItem('Comfy.Agent.RunModePreference')!)
    ).toEqual({ mode: 'auto_limited', credit_limit: 75 })
    expect(localStorage.getItem('Comfy.Agent.RunMode')).toBeNull()
    expect(localStorage.getItem('Comfy.Agent.RunCreditLimit')).toBeNull()
  })

  it('loads the server preference as the source of truth', async () => {
    fetchApi.mockResolvedValueOnce(
      jsonResponse(200, { mode: 'auto_limited', credit_limit: 25 })
    )

    const store = useAgentRunModeStore()
    await store.load()

    expect(fetchApi).toHaveBeenCalledWith('/agent/run-mode', { method: 'GET' })
    expect(store.mode).toBe('auto_limited')
    expect(store.creditLimit).toBe(25)
  })

  it('does not let a delayed load overwrite a later save', async () => {
    let resolveGet!: (response: Response) => void
    const getResponse = new Promise<Response>((resolve) => {
      resolveGet = resolve
    })
    fetchApi.mockImplementation((_route, init) => {
      if (init?.method === 'GET') return getResponse
      return Promise.resolve(
        jsonResponse(200, { mode: 'auto_limited', credit_limit: 20 })
      )
    })
    const store = useAgentRunModeStore()

    const load = store.load()
    await vi.waitFor(() =>
      expect(fetchApi).toHaveBeenCalledWith('/agent/run-mode', {
        method: 'GET'
      })
    )
    await store.save('auto_limited', 20)
    resolveGet(jsonResponse(200, { mode: 'ask_approval', credit_limit: null }))
    await load

    expect(store.mode).toBe('auto_limited')
    expect(store.creditLimit).toBe(20)
  })

  it('keeps a valid local preference when the endpoint is unavailable', async () => {
    localStorage.setItem(
      'Comfy.Agent.RunModePreference',
      JSON.stringify({ mode: 'auto_limited', credit_limit: 50 })
    )
    localStorage.setItem('Comfy.Agent.RunMode', 'ask')
    localStorage.setItem('Comfy.Agent.RunCreditLimit', '300')
    fetchApi.mockResolvedValueOnce(jsonResponse(404, { error: 'not found' }))

    const store = useAgentRunModeStore()
    await store.load()

    expect(store.mode).toBe('auto_limited')
    expect(store.creditLimit).toBe(50)
    expect(localStorage.getItem('Comfy.Agent.RunMode')).toBeNull()
    expect(localStorage.getItem('Comfy.Agent.RunCreditLimit')).toBeNull()
  })

  it('saves through the endpoint and applies its canonical response', async () => {
    fetchApi.mockResolvedValueOnce(
      jsonResponse(200, { mode: 'auto_limited', credit_limit: 20 })
    )

    const store = useAgentRunModeStore()
    await store.save('auto_limited', 20)

    const [route, init] = fetchApi.mock.calls[0]
    expect(route).toBe('/agent/run-mode')
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(init?.body as string)).toEqual({
      mode: 'auto_limited',
      credit_limit: 20
    })
    expect(store.mode).toBe('auto_limited')
    expect(store.creditLimit).toBe(20)
  })

  it('keeps a saved choice locally when the endpoint returns 404', async () => {
    fetchApi.mockResolvedValueOnce(jsonResponse(404, { error: 'not found' }))

    const store = useAgentRunModeStore()
    await store.save('auto', null)

    expect(store.mode).toBe('auto')
    expect(store.creditLimit).toBeNull()
    expect(
      JSON.parse(localStorage.getItem('Comfy.Agent.RunModePreference')!)
    ).toEqual({ mode: 'auto', credit_limit: null })
  })

  it.for([
    ['ask_approval', 1],
    ['auto', 1],
    ['auto_limited', null],
    ['auto_limited', 0],
    ['auto_limited', 1.5]
  ] as const)(
    'rejects an invalid mode and credit-limit pairing before sending',
    async ([mode, creditLimit]) => {
      const store = useAgentRunModeStore()

      await expect(store.save(mode, creditLimit)).rejects.toThrow()
      expect(fetchApi).not.toHaveBeenCalled()
    }
  )

  it('surfaces non-404 failures without changing the saved preference', async () => {
    fetchApi.mockResolvedValueOnce(jsonResponse(500, { error: 'failed' }))
    const store = useAgentRunModeStore()

    await expect(store.save('auto', null)).rejects.toThrow('failed')
    expect(store.mode).toBe('ask_approval')
    expect(store.creditLimit).toBeNull()
  })
})
