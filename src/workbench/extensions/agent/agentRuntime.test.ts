import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AgentAnswerAccepted,
  AgentCancelAccepted,
  AgentMessages,
  AgentRunModePreference,
  AgentThreadSummary,
  AgentTurnAccepted,
  UploadImageResult
} from './schemas/agentApiSchema'
import type { AgentEventSource } from './composables/agent/useAgentSession'
import type { AgentRestClient } from './services/agent/agentRestClient'
import { createAgentTestHarness } from './testing/agentTestHarness'
import { createAgentRuntime } from './agentRuntime'

function fakeRest(overrides: Partial<AgentRestClient> = {}): AgentRestClient {
  const base: AgentRestClient = {
    postMessage: vi.fn(
      async (): Promise<AgentTurnAccepted> => ({
        thread_id: 'thread-1',
        message_id: 'turn-1'
      })
    ),
    getMessages: vi.fn(async (): Promise<AgentMessages> => []),
    listThreads: vi.fn(async (): Promise<AgentThreadSummary[]> => []),
    getRunMode: vi.fn(
      async (): Promise<AgentRunModePreference> => ({
        mode: 'auto',
        credit_limit: null
      })
    ),
    putRunMode: vi.fn(
      async (
        preference: AgentRunModePreference
      ): Promise<AgentRunModePreference> => preference
    ),
    listCloudWorkflows: vi.fn(async () => []),
    cancelMessage: vi.fn(
      async (): Promise<AgentCancelAccepted> => ({ status: 'cancelling' })
    ),
    answerAsk: vi.fn(
      async (): Promise<AgentAnswerAccepted> => ({ status: 'answered' })
    ),
    uploadImage: vi.fn(
      async (): Promise<UploadImageResult> => ({
        name: 'asset.png',
        subfolder: '',
        type: 'input'
      })
    )
  }
  return { ...base, ...overrides }
}

function fakeEvents() {
  let listener: ((raw: unknown) => void) | undefined
  const unsubscribe = vi.fn(() => {
    listener = undefined
  })
  const source: AgentEventSource = {
    subscribe: vi.fn((next) => {
      listener = next
      return unsubscribe
    })
  }
  return {
    source,
    emit: (raw: unknown) => listener?.(raw),
    unsubscribe
  }
}

describe('agentRuntime', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('does not construct stores or transports while the gate is off', () => {
    const createRest = vi.fn()
    const createEvents = vi.fn()

    const runtime = createAgentRuntime({
      enabled: false,
      createRest,
      createEvents,
      untitledChatTitle: 'Untitled chat'
    })

    expect(runtime).toBeNull()
    expect(createRest).not.toHaveBeenCalled()
    expect(createEvents).not.toHaveBeenCalled()
  })

  it('owns one event transport and has idempotent start and stop', () => {
    const harness = createAgentTestHarness()
    const createEvents = vi.fn(() => harness.events)
    const runtime = createAgentRuntime({
      enabled: true,
      createRest: () => harness.rest,
      createEvents,
      untitledChatTitle: 'Untitled chat'
    })

    runtime?.start()
    runtime?.start()

    expect(createEvents).toHaveBeenCalledOnce()
    expect(harness.events.subscribe).toHaveBeenCalledOnce()

    runtime?.stop()
    runtime?.stop()

    expect(harness.unsubscribe).toHaveBeenCalledOnce()
  })

  it('normalizes ordered events into the single conversation transcript', async () => {
    const events = fakeEvents()
    const runtime = createAgentRuntime({
      enabled: true,
      createRest: () => fakeRest(),
      createEvents: () => events.source,
      untitledChatTitle: 'Untitled chat'
    })
    runtime?.start()

    await runtime?.sendMessage('Make a fox')
    events.emit({
      type: 'agent_thinking',
      data: {
        delta: 'Planning',
        message_id: 'turn-1',
        thread_id: 'thread-1'
      }
    })
    events.emit({
      type: 'agent_message_delta',
      data: {
        delta: 'A red fox',
        message_id: 'turn-1',
        thread_id: 'thread-1'
      }
    })
    events.emit({
      type: 'agent_message_done',
      data: {
        message_id: 'turn-1',
        thread_id: 'thread-1',
        usage: null
      }
    })

    expect(runtime?.entries.value.map((entry) => entry.role)).toEqual([
      'user',
      'assistant'
    ])
    expect(runtime?.entries.value[1]).toMatchObject({
      role: 'assistant',
      streaming: false,
      parts: [
        { type: 'thinking', text: 'Planning' },
        { type: 'text', text: 'A red fox' }
      ]
    })
  })

  it('cancels the active turn and aborts pending requests on stop', async () => {
    const cancelMessage = vi.fn(
      async (): Promise<AgentCancelAccepted> => ({ status: 'cancelling' })
    )
    const observedSignals: AbortSignal[] = []
    const runtime = createAgentRuntime({
      enabled: true,
      createRest: (signal) => {
        const current = signal()
        if (current) observedSignals.push(current)
        return fakeRest({ cancelMessage })
      },
      createEvents: () => fakeEvents().source,
      untitledChatTitle: 'Untitled chat'
    })
    runtime?.start()
    await runtime?.sendMessage('Make a fox')

    await runtime?.stopTurn()
    expect(cancelMessage).toHaveBeenCalledWith('thread-1', 'turn-1')

    runtime?.stop()
    expect(observedSignals[0]?.aborted).toBe(true)
  })

  it('propagates a history failure without stopping the session transport', async () => {
    const events = fakeEvents()
    const error = new Error('history unavailable')
    const onError = vi.fn()
    const runtime = createAgentRuntime({
      enabled: true,
      createRest: () =>
        fakeRest({ listThreads: vi.fn(async () => Promise.reject(error)) }),
      createEvents: () => events.source,
      untitledChatTitle: 'Untitled chat',
      onError
    })

    runtime?.start()
    await runtime?.refreshHistory()

    expect(onError).toHaveBeenCalledWith(error)
    expect(events.unsubscribe).not.toHaveBeenCalled()
  })
})
