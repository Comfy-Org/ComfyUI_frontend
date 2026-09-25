import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { api } from '@/scripts/api'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

vi.mock(import('@/scripts/api'))

import { useAgentComposerStore } from './agentComposerStore'
import { useAgentRunModeStore } from './agentRunModeStore'
import { useAgentSendGateStore } from './agentSendGateStore'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('agentRunModeStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(api.fetchApi).mockReset()
  })

  it('uses the safe fallback when loading gets 404 with invalid local state', async () => {
    localStorage.setItem('Comfy.Agent.RunModePreference', '{invalid')
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      jsonResponse(404, { error: 'not found' })
    )

    const store = useAgentRunModeStore()
    await store.load()

    expect(store.mode).toBe('ask_approval')
    expect(store.creditLimit).toBeNull()
  })

  it('migrates a legacy preference when loading gets 404', async () => {
    localStorage.setItem('Comfy.Agent.RunMode', 'auto-limit')
    localStorage.setItem('Comfy.Agent.RunCreditLimit', '75')
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      jsonResponse(404, { error: 'not found' })
    )

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

  it('uses the default limit when a legacy limited mode has no valid limit', () => {
    localStorage.setItem('Comfy.Agent.RunMode', 'auto-limit')

    const store = useAgentRunModeStore()

    expect(store.mode).toBe('auto_limited')
    expect(store.creditLimit).toBe(300)
  })

  it('preserves legacy keys when migration cannot produce a preference', () => {
    localStorage.setItem('Comfy.Agent.RunMode', 'unsupported')
    localStorage.setItem('Comfy.Agent.RunCreditLimit', '75')

    useAgentRunModeStore()

    expect(localStorage.getItem('Comfy.Agent.RunMode')).toBe('unsupported')
    expect(localStorage.getItem('Comfy.Agent.RunCreditLimit')).toBe('75')
  })

  it('loads the server preference as the source of truth', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      jsonResponse(200, { mode: 'auto_limited', credit_limit: 25 })
    )

    const store = useAgentRunModeStore()
    await store.load()

    expect(api.fetchApi).toHaveBeenCalledWith('/agent/run-mode', {
      method: 'GET'
    })
    expect(store.mode).toBe('auto_limited')
    expect(store.creditLimit).toBe(25)
  })

  it('does not let a delayed load overwrite a later save', async () => {
    let resolveGet!: (response: Response) => void
    const getResponse = new Promise<Response>((resolve) => {
      resolveGet = resolve
    })
    vi.mocked(api.fetchApi).mockImplementation((_route, init) => {
      if (init?.method === 'GET') return getResponse
      return Promise.resolve(
        jsonResponse(200, { mode: 'auto_limited', credit_limit: 20 })
      )
    })
    const store = useAgentRunModeStore()

    const load = store.load()
    await vi.waitFor(() =>
      expect(api.fetchApi).toHaveBeenCalledWith('/agent/run-mode', {
        method: 'GET'
      })
    )
    await store.save('auto_limited', 20)
    resolveGet(jsonResponse(200, { mode: 'ask_approval', credit_limit: null }))
    await load

    expect(store.mode).toBe('auto_limited')
    expect(store.creditLimit).toBe(20)
  })

  it('invalidates a pending load as soon as a save starts', async () => {
    let resolveGet!: (response: Response) => void
    let resolvePut!: (response: Response) => void
    const getResponse = new Promise<Response>((resolve) => {
      resolveGet = resolve
    })
    const putResponse = new Promise<Response>((resolve) => {
      resolvePut = resolve
    })
    vi.mocked(api.fetchApi).mockImplementation((_route, init) =>
      init?.method === 'GET' ? getResponse : putResponse
    )
    localStorage.setItem(
      'Comfy.Agent.RunModePreference',
      JSON.stringify({ mode: 'auto', credit_limit: null })
    )
    const store = useAgentRunModeStore()

    const load = store.load()
    const save = store.save('auto_limited', 20)
    resolveGet(jsonResponse(200, { mode: 'ask_approval', credit_limit: null }))
    await load

    expect(store.mode).toBe('auto')
    resolvePut(jsonResponse(200, { mode: 'auto_limited', credit_limit: 20 }))
    await save
    expect(store.mode).toBe('auto_limited')
  })

  it('keeps the latest save when an earlier PUT resolves last', async () => {
    let resolveFirst!: (response: Response) => void
    let resolveSecond!: (response: Response) => void
    vi.mocked(api.fetchApi)
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecond = resolve
          })
      )
    const store = useAgentRunModeStore()

    const first = store.save('auto_limited', 20)
    const second = store.save('auto', null)
    resolveSecond(jsonResponse(200, { mode: 'auto', credit_limit: null }))
    await second
    resolveFirst(jsonResponse(200, { mode: 'auto_limited', credit_limit: 20 }))
    await first

    expect(store.mode).toBe('auto')
    expect(store.creditLimit).toBeNull()
  })

  it('applies an earlier save when the latest one fails', async () => {
    let resolveFirst!: (response: Response) => void
    let resolveSecond!: (response: Response) => void
    vi.mocked(api.fetchApi)
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecond = resolve
          })
      )
    const store = useAgentRunModeStore()

    const first = store.save('auto_limited', 20)
    const second = store.save('auto', null)

    resolveSecond(jsonResponse(500, { error: 'boom' }))
    await expect(second).rejects.toThrow()
    resolveFirst(jsonResponse(200, { mode: 'auto_limited', credit_limit: 20 }))
    await first

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
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      jsonResponse(404, { error: 'not found' })
    )

    const store = useAgentRunModeStore()
    await store.load()

    expect(store.mode).toBe('auto_limited')
    expect(store.creditLimit).toBe(50)
    expect(localStorage.getItem('Comfy.Agent.RunMode')).toBeNull()
    expect(localStorage.getItem('Comfy.Agent.RunCreditLimit')).toBeNull()
  })

  it('saves through the endpoint and applies its canonical response', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      jsonResponse(200, { mode: 'auto_limited', credit_limit: 20 })
    )

    const store = useAgentRunModeStore()
    await store.save('auto_limited', 20)

    const [route, init] = vi.mocked(api.fetchApi).mock.calls[0]
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
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      jsonResponse(404, { error: 'not found' })
    )

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
      expect(api.fetchApi).not.toHaveBeenCalled()
    }
  )

  // PM-1660: the composer clears on the send click but the POST waits on the
  // cloud-workflow refresh, so a mode saved in that window used to reach the
  // server first and re-authorize the turn the user had already sent.
  it('holds a mode change back until the in-flight send settles', async () => {
    localStorage.setItem(
      'Comfy.Agent.RunModePreference',
      JSON.stringify({ mode: 'auto', credit_limit: null })
    )
    vi.mocked(api.fetchApi).mockResolvedValue(
      jsonResponse(200, { mode: 'ask_approval', credit_limit: null })
    )
    const sendGate = useAgentSendGateStore()
    sendGate.begin()
    const store = useAgentRunModeStore()

    const save = store.save('ask_approval', null)
    await nextTick()

    expect(vi.mocked(api.fetchApi)).not.toHaveBeenCalled()
    expect(store.mode).toBe('auto')

    sendGate.end()
    await save

    expect(vi.mocked(api.fetchApi)).toHaveBeenCalledWith(
      '/agent/run-mode',
      expect.objectContaining({ method: 'PUT' })
    )
    expect(store.mode).toBe('ask_approval')
  })

  // Abandoning the VIEW does not abandon the turn: newChat/loadThread clear the
  // composer's submission but stash the turn, which keeps running and keeps
  // spending. Keying the wait on the draft let a later mode change overtake it.
  it('keeps holding a mode change after the composer submission is discarded', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      jsonResponse(200, { mode: 'auto', credit_limit: null })
    )
    const composer = useAgentComposerStore()
    composer.startSubmission({
      prompt: composer.prompt,
      attachments: [],
      nodes: [],
      target: createMockLoadedWorkflow({ path: 'workflows/target.json' })
    })
    const sendGate = useAgentSendGateStore()
    sendGate.begin()
    const store = useAgentRunModeStore()

    composer.invalidateSubmission()
    const save = store.save('auto', null)
    await nextTick()

    expect(vi.mocked(api.fetchApi)).not.toHaveBeenCalled()

    sendGate.end()
    await save

    expect(vi.mocked(api.fetchApi)).toHaveBeenCalledOnce()
  })

  // A send is only bounded as far as its response headers, so a stalled body
  // would hold the write forever and leave the popover disabled until a
  // reload. Failing lets the user retry and writes nothing behind a turn the
  // server may not have started.
  it('gives up rather than waiting on a send that never settles', async () => {
    vi.useFakeTimers()
    try {
      const sendGate = useAgentSendGateStore()
      sendGate.begin()
      const store = useAgentRunModeStore()

      // Caught on the spot, not asserted at the end: advancing the timers is
      // what rejects it, and an unhandled rejection in between fails the run.
      const save = store
        .save('ask_approval', null)
        .catch((error: unknown) => error)
      await vi.advanceTimersByTimeAsync(90_000)

      expect(await save).toBeInstanceOf(Error)
      expect(vi.mocked(api.fetchApi)).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('saves straight away when no send is in flight', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      jsonResponse(200, { mode: 'ask_approval', credit_limit: null })
    )
    const store = useAgentRunModeStore()

    await store.save('ask_approval', null)

    expect(vi.mocked(api.fetchApi)).toHaveBeenCalledOnce()
    expect(store.mode).toBe('ask_approval')
  })

  it('surfaces non-404 failures without changing the saved preference', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      jsonResponse(500, { error: 'failed' })
    )
    const store = useAgentRunModeStore()

    await expect(store.save('auto', null)).rejects.toThrow('failed')
    expect(store.mode).toBe('ask_approval')
    expect(store.creditLimit).toBeNull()
  })
})
