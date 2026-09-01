// Chain-authored 08 fix-round pins (DEFECT-FIX receipts from the 08
// rounds R1-R3), relocated VERBATIM from the pre-restore
// useAgentSession.test.ts (3fc436c09a) so the canonical test file can
// stay byte-exact while useAgentSession.ts remains deliberately
// divergent with the 08 fixes these tests pin. Delete this file in the
// same commit that ever reverts useAgentSession.ts to canonical.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AgentCancelAccepted,
  AgentMessages,
  AgentThreadSummary,
  AgentTurnAccepted,
  UploadImageResult
} from '../../schemas/agentApiSchema'
import { zAgentWsEvent } from '../../schemas/agentApiSchema'
import { AgentApiError } from '../../services/agent/agentRestClient'
import type {
  AgentRestClient,
  OpenTabsSnapshot,
  PostMessageInput
} from '../../services/agent/agentRestClient'
import type { AgentEventSource } from '../../services/agent/agentEventSource'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentDraftStore } from '../../stores/agent/agentDraftStore'

import { useAgentSession } from './useAgentSession'

function fakeRest(overrides: Partial<AgentRestClient> = {}): AgentRestClient {
  const base: AgentRestClient = {
    postMessage: vi.fn(
      async (): Promise<AgentTurnAccepted> => ({
        thread_id: 'th-1',
        message_id: 'msg-1',
        workflow_id: 'wf-1'
      })
    ),
    getMessages: vi.fn(async (): Promise<AgentMessages> => []),
    listThreads: vi.fn(async (): Promise<AgentThreadSummary[]> => []),
    listCloudWorkflows: vi.fn(async () => []),
    cancelMessage: vi.fn(
      async (): Promise<AgentCancelAccepted> => ({ status: 'cancelling' })
    ),
    getDraft: vi.fn(async (): Promise<never> => {
      throw new Error('getDraft unused in this harness')
    }),
    uploadImage: vi.fn(
      async (): Promise<UploadImageResult> => ({
        name: 'n',
        subfolder: '',
        type: 'input'
      })
    )
  }
  return { ...base, ...overrides }
}

function fakeEvents() {
  // Mirrors createAgentEventSource: every subscribe call is its own
  // subscription (fresh closures on the host), even for a repeated listener.
  const listeners = new Set<{ fn: (raw: unknown) => void }>()
  const statusListeners = new Set<{ fn: (live: boolean) => void }>()
  const source: AgentEventSource = {
    subscribe(fn) {
      const entry = { fn }
      listeners.add(entry)
      return () => {
        listeners.delete(entry)
      }
    },
    onStatus(fn) {
      const entry = { fn }
      statusListeners.add(entry)
      return () => {
        statusListeners.delete(entry)
      }
    }
  }
  return {
    source,
    emit: (raw: unknown) => {
      for (const { fn } of [...listeners]) fn(raw)
    },
    status: (live: boolean) => {
      for (const { fn } of [...statusListeners]) fn(live)
    }
  }
}

function resetHarness() {
  setActivePinia(createPinia())
  useAgentSession({ rest: fakeRest(), events: fakeEvents().source }).newChat()
  localStorage.clear()
}

const wire = (raw: unknown): unknown => zAgentWsEvent.parse(raw)
const thinking = (id: string, delta: string) =>
  wire({
    type: 'agent_thinking',
    data: { delta, message_id: id, thread_id: 'th-1' }
  })
const delta = (id: string, text: string) =>
  wire({
    type: 'agent_message_delta',
    data: { delta: text, message_id: id, thread_id: 'th-1' }
  })
const done = (id: string) =>
  wire({
    type: 'agent_message_done',
    data: { message_id: id, thread_id: 'th-1', usage: null }
  })
const deltaIn = (threadId: string, id: string, text: string) =>
  wire({
    type: 'agent_message_delta',
    data: { delta: text, message_id: id, thread_id: threadId }
  })
const doneIn = (threadId: string, id: string) =>
  wire({
    type: 'agent_message_done',
    data: { message_id: id, thread_id: threadId, usage: null }
  })
const historyRow = (
  seq: number,
  role: 'user' | 'assistant',
  turnId: string,
  text: string,
  id: string = `row-${seq}`
): AgentMessages[number] => ({
  id,
  thread_id: 'th-1',
  seq,
  role,
  status: 'complete',
  turn_id: turnId,
  content: { text }
})

describe('08-fix1 receipts and pins', () => {
  beforeEach(resetHarness)

  it('(f1a) a loadThread whose history GET fails non-404 leaves identity and transcript coherent', async () => {
    const getMessages = vi
      .fn<(threadId: string) => Promise<AgentMessages>>()
      .mockResolvedValueOnce([
        historyRow(1, 'user', 'turn-a', 'thread A prompt'),
        historyRow(2, 'assistant', 'turn-a', 'thread A reply')
      ])
      .mockRejectedValueOnce(new AgentApiError('backend down', 500, undefined))
    const session = useAgentSession({
      rest: fakeRest({ getMessages }),
      events: fakeEvents().source
    })
    session.start()
    await session.loadThread('th-a')
    expect(session.entries.value.length).toBeGreaterThan(0)

    await session.loadThread('th-b')

    expect(session.threadId.value).toBeNull()
    expect(session.entries.value).toEqual([])
    expect(localStorage.getItem('Comfy.Agent.ThreadId')).toBeNull()
    expect(session.notices.value).toHaveLength(1)
  })

  it('(f1b) a turn stashed for the target thread survives the failed load and resumes on retry', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockResolvedValue({ thread_id: 'th-b', message_id: 'msg-b' })
    const getMessages = vi
      .fn<(threadId: string) => Promise<AgentMessages>>()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new AgentApiError('backend down', 500, undefined))
      .mockResolvedValueOnce([])
    const rest = fakeRest({ postMessage, getMessages })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    await session.sendMessage('live turn')
    emit(deltaIn('th-b', 'msg-b', 'partial'))

    await session.loadThread('th-a')
    await session.loadThread('th-b')
    expect(session.threadId.value).toBeNull()
    expect(session.isStreaming.value).toBe(false)

    await session.loadThread('th-b')
    const conversation = useAgentConversationStore()
    expect(conversation.activeTurnId).toBe('msg-b')
    expect(session.isStreaming.value).toBe(true)
    const users = session.entries.value.flatMap((e) =>
      e.role === 'user' ? [e.text] : []
    )
    expect(users).toEqual(['live turn'])
  })

  it('(f2a) a localStorage failure after the ack cannot fail or orphan the accepted turn', async () => {
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    const real = localStorage
    const setItem = vi.fn(() => {
      throw new DOMException('QuotaExceededError')
    })
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => real.getItem(key),
      setItem,
      removeItem: (key: string) => real.removeItem(key),
      clear: () => real.clear()
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let ok: boolean
    try {
      ok = await session.sendMessage('accepted')
    } finally {
      vi.unstubAllGlobals()
    }

    expect(setItem).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toBe(
      '[agent] failed to persist the thread id'
    )
    warn.mockRestore()
    expect(ok).toBe(true)
    expect(rest.postMessage).toHaveBeenCalledTimes(1)
    expect(session.notices.value).toEqual([])
    expect(session.isSending.value).toBe(false)
    emit(delta('msg-1', 'reply landed'))
    emit(done('msg-1'))
    expect(JSON.stringify(session.entries.value)).toContain('reply landed')
    const users = session.entries.value.flatMap((e) =>
      e.role === 'user' ? [e.text] : []
    )
    expect(users).toEqual(['accepted'])
  })

  it('(f2b) a workflow.adopted throw after the ack cannot fail or orphan the accepted turn', async () => {
    const adopted = vi.fn(() => {
      throw new Error('consumer exploded')
    })
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({
      rest,
      events: source,
      workflow: { current: () => undefined, adopted }
    })
    session.start()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ok = await session.sendMessage('accepted')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toBe(
      '[agent] workflow.adopted consumer threw'
    )
    warn.mockRestore()

    expect(ok).toBe(true)
    expect(adopted).toHaveBeenCalledTimes(1)
    expect(useAgentDraftStore().workflowId).toBe('wf-1')
    expect(session.isSending.value).toBe(false)
    emit(delta('msg-1', 'reply landed'))
    emit(done('msg-1'))
    expect(JSON.stringify(session.entries.value)).toContain('reply landed')
    expect(session.isStreaming.value).toBe(false)
  })

  it('(f3) failed sends across a remount mint distinct ids and keep their own prompts', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockRejectedValue(new AgentApiError('server down', 500, undefined))
    const rest = fakeRest({ postMessage })
    const first = useAgentSession({ rest, events: fakeEvents().source })
    first.start()
    await first.sendMessage('first text')
    first.stop()

    const second = useAgentSession({ rest, events: fakeEvents().source })
    second.start()
    await second.sendMessage('second text')

    const users = second.entries.value.flatMap((e) =>
      e.role === 'user' ? [{ id: e.id, text: e.text }] : []
    )
    expect(users.map((u) => u.text)).toEqual(['first text', 'second text'])
    expect(new Set(users.map((u) => u.id)).size).toBe(2)
  })

  it('(t1a) frames for a turn after its done never mutate the settled transcript (active path)', async () => {
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    await session.sendMessage('question')
    emit(delta('msg-1', 'partial answer'))
    await session.stopTurn()
    emit(done('msg-1'))
    expect(session.isStreaming.value).toBe(false)
    const settled = JSON.stringify(session.entries.value)

    emit(thinking('msg-1', 'late thought'))
    emit(delta('msg-1', 'late delta'))
    emit(done('msg-1'))

    expect(JSON.stringify(session.entries.value)).toBe(settled)
    expect(session.isStreaming.value).toBe(false)
  })

  it('(t1b) late frames after a background done never reach the retained turn (background path)', async () => {
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    await session.sendMessage('bg question')
    emit(delta('msg-1', 'partial'))

    await session.loadThread('th-2')
    emit(doneIn('th-1', 'msg-1'))
    emit(deltaIn('th-1', 'msg-1', 'LATE-BLEED'))

    await session.loadThread('th-1')
    const dump = JSON.stringify(session.entries.value)
    expect(dump).not.toContain('LATE-BLEED')
    expect(dump).toContain('partial')
    const users = session.entries.value.flatMap((e) =>
      e.role === 'user' ? [e.text] : []
    )
    expect(users).toEqual(['bg question'])
    expect(session.isStreaming.value).toBe(false)
  })

  it('(t2a) the posted body carries the workflow identity and tab snapshot; adopted gets the sent context', async () => {
    const rest = fakeRest()
    const adopted = vi.fn()
    const context = { id: 'wf-7', tabPath: 'workflows/seven.json' }
    const tabsSnapshot: OpenTabsSnapshot = {
      open_tabs: [{ workflow_id: 'wf-7', name: 'Seven' }],
      current_tab: 'wf-7'
    }
    const session = useAgentSession({
      rest,
      events: fakeEvents().source,
      workflow: {
        current: () => context,
        adopted,
        tabs: () => tabsSnapshot
      }
    })
    session.start()
    await session.sendMessage('with context')

    const body = vi.mocked(rest.postMessage).mock.calls[0][1]
    expect(body.workflowId).toBe('wf-7')
    expect(body.tabs).toBe(tabsSnapshot)
    expect(adopted).toHaveBeenCalledTimes(1)
    expect(adopted).toHaveBeenCalledWith('wf-1', context, false)
  })

  it('(t2b) a resolving prepare gates the post; workflow context is read after the gate', async () => {
    vi.useFakeTimers()
    try {
      let release!: () => void
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      let context: { id: string; tabPath: string } | undefined = undefined
      const rest = fakeRest()
      const session = useAgentSession({
        rest,
        events: fakeEvents().source,
        workflow: {
          current: () => context,
          adopted: vi.fn(),
          prepare: () => gate
        }
      })
      session.start()

      const sendResult = session.sendMessage('gated')
      await Promise.resolve()
      await Promise.resolve()
      expect(rest.postMessage).not.toHaveBeenCalled()

      context = { id: 'wf-late', tabPath: 'late.json' }
      release()
      await expect(sendResult).resolves.toBe(true)
      expect(rest.postMessage).toHaveBeenCalledTimes(1)
      expect(vi.mocked(rest.postMessage).mock.calls[0][1].workflowId).toBe(
        'wf-late'
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('(t2c) a prepare that never settles still posts exactly once after the timeout', async () => {
    vi.useFakeTimers()
    try {
      let context: { id: string; tabPath: string } | undefined = undefined
      const rest = fakeRest()
      const session = useAgentSession({
        rest,
        events: fakeEvents().source,
        workflow: {
          current: () => context,
          adopted: vi.fn(),
          prepare: () => new Promise<void>(() => {})
        }
      })
      session.start()
      const sendResult = session.sendMessage('timed out')
      context = { id: 'wf-after-timeout', tabPath: 'later.json' }
      await vi.advanceTimersByTimeAsync(3000)
      await expect(sendResult).resolves.toBe(true)
      expect(rest.postMessage).toHaveBeenCalledTimes(1)
      expect(vi.mocked(rest.postMessage).mock.calls[0][1].workflowId).toBe(
        'wf-after-timeout'
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('(t2d) a rejecting prepare still posts exactly once', async () => {
    vi.useFakeTimers()
    try {
      const rest = fakeRest()
      const session = useAgentSession({
        rest,
        events: fakeEvents().source,
        workflow: {
          current: () => undefined,
          adopted: vi.fn(),
          prepare: () => Promise.reject(new Error('prepare exploded'))
        }
      })
      session.start()
      await expect(session.sendMessage('after reject')).resolves.toBe(true)
      expect(rest.postMessage).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('(t3a) a stopped session ingests nothing further from its source', async () => {
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    await session.sendMessage('question')
    emit(delta('msg-1', 'before stop'))
    const snapshot = JSON.stringify(session.entries.value)

    session.stop()
    emit(delta('msg-1', 'after stop'))

    expect(JSON.stringify(session.entries.value)).toBe(snapshot)
  })

  it('(t3b) starting twice never ingests a frame more than once', async () => {
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    session.start()
    await session.sendMessage('question')
    emit(delta('msg-1', 'ONCE-TOKEN'))

    const occurrences =
      JSON.stringify(session.entries.value).match(/ONCE-TOKEN/g) ?? []
    expect(occurrences).toHaveLength(1)
  })

  it('(t4) after a reset, a reused turn id resurfaces no prior prompt text', async () => {
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    await session.sendMessage('old secret')
    emit(delta('msg-1', 'private reply'))
    emit(done('msg-1'))

    session.newChat()
    expect(session.entries.value).toEqual([])

    vi.mocked(rest.getMessages).mockResolvedValueOnce([
      historyRow(1, 'assistant', 'msg-1', 'fresh reply')
    ])
    await session.loadThread('th-1')
    const dump = JSON.stringify(session.entries.value)
    expect(dump).not.toContain('old secret')
    expect(dump).toContain('fresh reply')
  })

  it('(t5a) a remount with a surviving thread keeps the ack-established workflow binding', async () => {
    // The binding now lives in the draft store (bound on ack), which
    // survives a panel remount within the same app the same way the
    // module-level memory it replaced did.
    const rest = fakeRest()
    const first = useAgentSession({ rest, events: fakeEvents().source })
    first.start()
    await first.sendMessage('bind me')
    expect(useAgentDraftStore().workflowId).toBe('wf-1')
    first.stop()

    const second = useAgentSession({ rest, events: fakeEvents().source })
    expect(useAgentDraftStore().workflowId).toBe('wf-1')
    second.start()
    expect(useAgentDraftStore().workflowId).toBe('wf-1')
    expect(rest.getMessages).toHaveBeenCalledTimes(1)
    await vi.mocked(rest.getMessages).mock.results[0].value
    await Promise.resolve()
  })

  it('(t5b) a remount with no surviving thread starts unbound', async () => {
    const rest = fakeRest()
    const first = useAgentSession({ rest, events: fakeEvents().source })
    first.start()
    await first.sendMessage('bind me')
    first.stop()

    setActivePinia(createPinia())
    localStorage.clear()
    const second = useAgentSession({ rest, events: fakeEvents().source })
    second.start()
    expect(useAgentDraftStore().workflowId).toBeNull()
  })
})

describe('08-fix2 receipts and pins', () => {
  beforeEach(resetHarness)

  it('(r2a) a loadThread whose target 404s leaves identity and transcript coherent', async () => {
    const getMessages = vi
      .fn<(threadId: string) => Promise<AgentMessages>>()
      .mockResolvedValueOnce([
        historyRow(1, 'user', 'turn-a', 'thread A prompt'),
        historyRow(2, 'assistant', 'turn-a', 'thread A reply')
      ])
      .mockRejectedValueOnce(new AgentApiError('gone', 404, undefined))
    const session = useAgentSession({
      rest: fakeRest({ getMessages }),
      events: fakeEvents().source
    })
    session.start()
    await session.loadThread('th-a')
    expect(session.entries.value.length).toBeGreaterThan(0)

    await session.loadThread('th-b')

    expect(session.threadId.value).toBeNull()
    expect(session.entries.value).toEqual([])
    expect(localStorage.getItem('Comfy.Agent.ThreadId')).toBeNull()
  })

  it('(r2b) a transient boot-hydrate failure never destroys an in-flight turn or the resume pointer', async () => {
    localStorage.setItem('Comfy.Agent.ThreadId', 'th-1')
    let rejectHistory!: (error: unknown) => void
    const getMessages = vi.fn(
      () =>
        new Promise<AgentMessages>((_resolve, reject) => {
          rejectHistory = reject
        })
    )
    const rest = fakeRest({ getMessages })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('mid-boot question')
    emit(delta('msg-1', 'partial'))

    rejectHistory(new AgentApiError('backend down', 500, undefined))
    await Promise.resolve()
    await Promise.resolve()

    expect(localStorage.getItem('Comfy.Agent.ThreadId')).toBe('th-1')
    const conversation = useAgentConversationStore()
    expect(conversation.activeTurnId).toBe('msg-1')
    expect(session.isStreaming.value).toBe(true)
    expect(session.notices.value).toHaveLength(1)
  })

  it('(r2c) a throwing workflow.current() surfaces sendFailed and never latches sending', async () => {
    let calls = 0
    const rest = fakeRest()
    const session = useAgentSession({
      rest,
      events: fakeEvents().source,
      workflow: {
        current: () => {
          calls += 1
          if (calls === 1) throw new Error('workflow context exploded')
          return undefined
        },
        adopted: vi.fn()
      }
    })
    session.start()

    const first = await session.sendMessage('doomed')
    expect(first).toBe(false)
    expect(session.isSending.value).toBe(false)
    expect(rest.postMessage).not.toHaveBeenCalled()
    expect(JSON.stringify(session.entries.value)).toContain(
      'Message failed to send'
    )

    const second = await session.sendMessage('fine now')
    expect(second).toBe(true)
    expect(rest.postMessage).toHaveBeenCalledTimes(1)
  })
})

describe('08-fix3 receipts and pins', () => {
  beforeEach(resetHarness)

  it('(r3a) a send acked while the target load is in flight survives its 404 and resumes on retry', async () => {
    let rejectHistory!: (error: unknown) => void
    const getMessages = vi
      .fn<(threadId: string) => Promise<AgentMessages>>()
      .mockResolvedValueOnce([
        historyRow(1, 'user', 'turn-a', 'thread A prompt'),
        historyRow(2, 'assistant', 'turn-a', 'thread A reply')
      ])
      .mockImplementationOnce(
        () =>
          new Promise<AgentMessages>((_resolve, reject) => {
            rejectHistory = reject
          })
      )
      .mockResolvedValueOnce([])
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockResolvedValue({ thread_id: 'th-b', message_id: 'msg-b' })
    const rest = fakeRest({ getMessages, postMessage })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    await session.loadThread('th-a')

    const load = session.loadThread('th-b')
    await session.sendMessage('acked mid-load')
    emit(deltaIn('th-b', 'msg-b', 'partial'))
    rejectHistory(new AgentApiError('gone', 404, undefined))
    await load

    expect(session.threadId.value).toBeNull()
    expect(session.entries.value).toEqual([])
    expect(localStorage.getItem('Comfy.Agent.ThreadId')).toBeNull()

    await session.loadThread('th-b')
    const conversation = useAgentConversationStore()
    expect(conversation.activeTurnId).toBe('msg-b')
    const users = session.entries.value.flatMap((e) =>
      e.role === 'user' ? [e.text] : []
    )
    expect(users).toEqual(['acked mid-load'])
  })

  it('(r3b) a send acked while the target load is in flight survives its 500 and resumes on retry', async () => {
    let rejectHistory!: (error: unknown) => void
    const getMessages = vi
      .fn<(threadId: string) => Promise<AgentMessages>>()
      .mockResolvedValueOnce([
        historyRow(1, 'user', 'turn-a', 'thread A prompt'),
        historyRow(2, 'assistant', 'turn-a', 'thread A reply')
      ])
      .mockImplementationOnce(
        () =>
          new Promise<AgentMessages>((_resolve, reject) => {
            rejectHistory = reject
          })
      )
      .mockResolvedValueOnce([])
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockResolvedValue({ thread_id: 'th-b', message_id: 'msg-b' })
    const rest = fakeRest({ getMessages, postMessage })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    await session.loadThread('th-a')

    const load = session.loadThread('th-b')
    await session.sendMessage('acked mid-load')
    emit(deltaIn('th-b', 'msg-b', 'partial'))
    rejectHistory(new AgentApiError('backend down', 500, undefined))
    await load

    expect(session.threadId.value).toBeNull()
    expect(session.entries.value).toEqual([])
    expect(session.notices.value).toHaveLength(1)

    await session.loadThread('th-b')
    const conversation = useAgentConversationStore()
    expect(conversation.activeTurnId).toBe('msg-b')
    const users = session.entries.value.flatMap((e) =>
      e.role === 'user' ? [e.text] : []
    )
    expect(users).toEqual(['acked mid-load'])
  })

  it('(r3c) a throwing workflow.tabs() surfaces sendFailed and never latches sending', async () => {
    const rest = fakeRest()
    const session = useAgentSession({
      rest,
      events: fakeEvents().source,
      workflow: {
        current: () => undefined,
        adopted: vi.fn(),
        tabs: () => {
          throw new Error('tabs exploded')
        }
      }
    })
    session.start()

    expect(await session.sendMessage('doomed')).toBe(false)
    expect(session.isSending.value).toBe(false)
    expect(await session.sendMessage('doomed again')).toBe(false)
    expect(rest.postMessage).not.toHaveBeenCalled()
    const failures =
      JSON.stringify(session.entries.value).match(/Message failed to send/g) ??
      []
    expect(failures).toHaveLength(2)
  })

  it('(r3d) a synchronously-throwing prepare surfaces sendFailed and never latches sending', async () => {
    const rest = fakeRest()
    const session = useAgentSession({
      rest,
      events: fakeEvents().source,
      workflow: {
        current: () => undefined,
        adopted: vi.fn(),
        prepare: () => {
          throw new Error('prepare exploded synchronously')
        }
      }
    })
    session.start()

    expect(await session.sendMessage('doomed')).toBe(false)
    expect(session.isSending.value).toBe(false)
    expect(await session.sendMessage('doomed again')).toBe(false)
    expect(rest.postMessage).not.toHaveBeenCalled()
    const failures =
      JSON.stringify(session.entries.value).match(/Message failed to send/g) ??
      []
    expect(failures).toHaveLength(2)
  })
})
