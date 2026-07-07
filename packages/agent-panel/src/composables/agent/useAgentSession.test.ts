import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AgentCancelAccepted,
  AgentDraftSnapshot,
  AgentMessages,
  AgentThreadCreated,
  AgentTurnAccepted,
  TokenUsage,
  UploadImageResult
} from '@/schemas/agentApiSchema'
import { zAgentWsEvent } from '@/schemas/agentApiSchema'
import { AgentApiError } from '@/services/agent/agentRestClient'
import type {
  AgentRestClient,
  PostMessageInput
} from '@/services/agent/agentRestClient'
import { useAgentDraftStore } from '@/stores/agent/agentDraftStore'

import type { AgentEventSource } from './useAgentSession'
import { useAgentSession } from './useAgentSession'

const USAGE: TokenUsage = {
  input_tokens: 10,
  output_tokens: 5,
  total_tokens: 42,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0
}

// A fully typed fake REST client: each method is a vi.fn the test arranges per scenario.
function fakeRest(overrides: Partial<AgentRestClient> = {}): AgentRestClient {
  const base: AgentRestClient = {
    createThread: vi.fn(
      async (): Promise<AgentThreadCreated> => ({ thread_id: 'th-1' })
    ),
    postMessage: vi.fn(
      async (): Promise<AgentTurnAccepted> => ({
        thread_id: 'th-1',
        message_id: 'msg-1'
      })
    ),
    getMessages: vi.fn(async (): Promise<AgentMessages> => []),
    cancelMessage: vi.fn(
      async (): Promise<AgentCancelAccepted> => ({ status: 'cancelling' })
    ),
    getDraft: vi.fn(
      async (): Promise<AgentDraftSnapshot> => ({ content: {}, version: 1 })
    ),
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

// A fake event source that captures the session's listeners so the test can push frames
// and toggle liveness by hand.
function fakeEvents() {
  let listener: ((raw: unknown) => void) | undefined
  let statusListener: ((live: boolean) => void) | undefined
  const source: AgentEventSource = {
    subscribe(fn) {
      listener = fn
      return () => {
        listener = undefined
      }
    },
    onStatus(fn) {
      statusListener = fn
      return () => {
        statusListener = undefined
      }
    }
  }
  return {
    source,
    emit: (raw: unknown) => listener?.(raw),
    status: (live: boolean) => statusListener?.(live)
  }
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
const done = (id: string, usage: TokenUsage | null) =>
  wire({
    type: 'agent_message_done',
    data: { message_id: id, thread_id: 'th-1', usage }
  })
const draftPatch = (workflowId: string, version: number) =>
  wire({
    type: 'draft_patch',
    data: {
      base_version: version - 1,
      version,
      content: { n: 1 },
      workflow_id: workflowId
    }
  })
const draftVersion = (workflowId: string, version: number) =>
  wire({ type: 'draft_version', data: { version, workflow_id: workflowId } })

describe('useAgentSession (v1 composition root)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('(a) posts to new, adopts ids, records the user turn, and renders a settled reply', async () => {
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('make me a cat')

    expect(rest.postMessage).toHaveBeenCalledWith('new', {
      content: 'make me a cat',
      workflowId: undefined,
      selection: undefined,
      attachments: undefined
    })
    expect(session.threadId.value).toBe('th-1')

    emit(thinking('msg-1', 'planning'))
    emit(delta('msg-1', 'A cat.'))
    emit(done('msg-1', USAGE))

    const roles = session.entries.value.map((e) => e.role)
    expect(roles).toEqual(['user', 'assistant'])
    const assistant = session.entries.value[1]
    expect(assistant).toMatchObject({
      role: 'assistant',
      streaming: false,
      tokens: 42
    })
    expect(session.isStreaming.value).toBe(false)
  })

  it('(b) a second send posts to the adopted threadId, not new', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockResolvedValueOnce({ thread_id: 'th-9', message_id: 'msg-1' })
      .mockResolvedValueOnce({ thread_id: 'th-9', message_id: 'msg-2' })
    const rest = fakeRest({ postMessage })
    const { source } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('first')
    await session.sendMessage('second')

    expect(postMessage.mock.calls[0][0]).toBe('new')
    expect(postMessage.mock.calls[1][0]).toBe('th-9')
  })

  it('(c) a postMessage AgentApiError pushes an error notice and opens no live turn', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockRejectedValue(new AgentApiError('server exploded', 500, undefined))
    const rest = fakeRest({ postMessage })
    const { source } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    const ok = await session.sendMessage('boom')
    expect(ok).toBe(false)

    expect(session.notices.value).toEqual([
      { level: 'error', text: 'server exploded' }
    ])
    // The failed send renders as a settled exchange (user + error notice), not a live
    // turn: no spinner is left running.
    expect(session.entries.value.map((e) => e.role)).toEqual([
      'user',
      'assistant'
    ])
    expect(session.isStreaming.value).toBe(false)
  })

  it('(d) stopTurn cancels the active turn; a 409 is swallowed and the socket settles it', async () => {
    const cancelMessage = vi
      .fn<
        (threadId: string, messageId: string) => Promise<AgentCancelAccepted>
      >()
      .mockRejectedValue(new AgentApiError('already done', 409, undefined))
    const rest = fakeRest({ cancelMessage })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'working'))
    expect(session.isStreaming.value).toBe(true)

    await session.stopTurn()
    expect(cancelMessage).toHaveBeenCalledWith('th-1', 'msg-1')
    // A 409 is benign — no notice, and no local abort (the socket settles the turn).
    expect(session.notices.value).toHaveLength(0)
    expect(session.isStreaming.value).toBe(true)

    emit(delta('msg-1', ' Stopped at your request.'))
    emit(done('msg-1', null))
    expect(session.isStreaming.value).toBe(false)
  })

  it('(e) foreign chat events are ignored, but a mid-turn draft_patch still adopts', async () => {
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({
      rest,
      events: source,
      workflowId: () => 'wf-1'
    })
    session.start()

    await session.sendMessage('hi')
    emit(delta('msg-1', 'kept'))
    // A chat event for a different turn is dropped.
    emit(delta('msg-OTHER', 'DROP'))
    // A draft_patch arriving during this turn still adopts (draft is not turn-filtered).
    emit(draftPatch('wf-1', 5))

    const assistant = session.entries.value.at(-1)
    const textPart =
      assistant?.role === 'assistant'
        ? assistant.parts.find((p) => p.type === 'text')
        : undefined
    expect(textPart).toMatchObject({ text: 'kept' })
    const draft = useAgentDraftStore()
    expect(draft.version).toBe(5)
    expect(draft.content).toEqual({ n: 1 })
  })

  it('(f) draft_version ahead triggers exactly one single-flight resync', async () => {
    let resolveDraft: ((snapshot: AgentDraftSnapshot) => void) | undefined
    const getDraft = vi.fn<(workflowId: string) => Promise<AgentDraftSnapshot>>(
      () =>
        new Promise<AgentDraftSnapshot>((resolve) => {
          resolveDraft = resolve
        })
    )
    const rest = fakeRest({ getDraft })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({
      rest,
      events: source,
      workflowId: () => 'wf-1'
    })
    session.start()
    // start() baselines the draft, so drain that first fetch before testing heartbeats.
    expect(getDraft).toHaveBeenCalledTimes(1)
    resolveDraft?.({ content: {}, version: 2 })
    await Promise.resolve()

    // Two 'behind' heartbeats before the fetch resolves collapse to ONE getDraft.
    emit(draftVersion('wf-1', 9))
    emit(draftVersion('wf-1', 10))
    expect(getDraft).toHaveBeenCalledTimes(2)

    resolveDraft?.({ content: { adopted: true }, version: 10 })
    await Promise.resolve()
    const draft = useAgentDraftStore()
    expect(draft.version).toBe(10)
    expect(draft.content).toEqual({ adopted: true })
  })

  it('(g) onStatus(false) aborts the active turn; onStatus(true) resyncs the draft', async () => {
    const rest = fakeRest()
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({
      rest,
      events: source,
      workflowId: () => 'wf-1'
    })
    session.start()
    ;(rest.getDraft as ReturnType<typeof vi.fn>).mockClear()

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))
    expect(session.isStreaming.value).toBe(true)

    status(false)
    expect(session.isStreaming.value).toBe(false)

    status(true)
    expect(rest.getDraft).toHaveBeenCalledTimes(1)
  })

  it('(h) attachments pass through to the postMessage wire body', async () => {
    const rest = fakeRest()
    const { source } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('with files', ['upload_a.png', 'upload_b.png'])

    expect(rest.postMessage).toHaveBeenCalledWith('new', {
      content: 'with files',
      workflowId: undefined,
      selection: undefined,
      attachments: ['upload_a.png', 'upload_b.png']
    })
  })

  it('(j) a rebind during resyncDraft does not adopt the stale workflow draft', async () => {
    let resolveDraft: ((snapshot: AgentDraftSnapshot) => void) | undefined
    const getDraft = vi.fn<(workflowId: string) => Promise<AgentDraftSnapshot>>(
      () =>
        new Promise<AgentDraftSnapshot>((resolve) => {
          resolveDraft = resolve
        })
    )
    const rest = fakeRest({ getDraft })
    const session = useAgentSession({
      rest,
      events: fakeEvents().source,
      workflowId: () => 'wf-1'
    })
    session.start()
    expect(getDraft).toHaveBeenCalledWith('wf-1')

    // The bound workflow changes before the in-flight fetch resolves.
    const draft = useAgentDraftStore()
    draft.bind('wf-2')

    // The stale snapshot for wf-1 arrives; it must NOT be adopted onto wf-2.
    resolveDraft?.({ content: { stale: true }, version: 99 })
    await Promise.resolve()

    expect(draft.workflowId).toBe('wf-2')
    expect(draft.content).toBeNull()
    expect(draft.version).toBeNull()
  })

  it('(k) a failed POST records the user text plus a settled error reply and returns false', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockRejectedValue(new AgentApiError('server exploded', 500, undefined))
    const rest = fakeRest({ postMessage })
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()

    const ok = await session.sendMessage('boom')
    expect(ok).toBe(false)

    const entries = session.entries.value
    expect(entries.map((e) => e.role)).toEqual(['user', 'assistant'])
    expect(entries[0]).toMatchObject({ role: 'user', text: 'boom' })
    const assistant = entries[1]
    expect(assistant.role).toBe('assistant')
    if (assistant.role === 'assistant') {
      expect(assistant.streaming).toBe(false)
      expect(assistant.parts).toEqual([
        {
          type: 'notice',
          level: 'error',
          text: 'Message failed to send: server exploded'
        }
      ])
    }
    expect(session.isStreaming.value).toBe(false)
  })

  it('(l) newChat cancels the active turn exactly once with the right ids', async () => {
    const cancelMessage = vi.fn<
      (threadId: string, messageId: string) => Promise<AgentCancelAccepted>
    >(async () => ({ status: 'cancelling' }))
    const rest = fakeRest({ cancelMessage })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'working'))
    expect(session.isStreaming.value).toBe(true)

    session.newChat()

    expect(cancelMessage).toHaveBeenCalledTimes(1)
    expect(cancelMessage).toHaveBeenCalledWith('th-1', 'msg-1')
    expect(session.entries.value).toHaveLength(0)
    expect(session.threadId.value).toBeNull()
  })

  it('(m) a second send while the first POST is pending posts once and records a busy notice', async () => {
    let resolvePost: ((ack: AgentTurnAccepted) => void) | undefined
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockImplementationOnce(
        () =>
          new Promise<AgentTurnAccepted>((resolve) => {
            resolvePost = resolve
          })
      )
    const rest = fakeRest({ postMessage })
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()

    const first = session.sendMessage('first')
    const second = await session.sendMessage('second')
    expect(second).toBe(false)
    // Only the first send reached the wire.
    expect(postMessage).toHaveBeenCalledTimes(1)

    // The dropped second send is recorded as a failed exchange, not swallowed.
    const busyNotice = session.entries.value.find(
      (e) =>
        e.role === 'assistant' &&
        e.parts.some(
          (p) =>
            p.type === 'notice' && p.text === 'A message is already being sent'
        )
    )
    expect(busyNotice).toBeDefined()

    resolvePost?.({ thread_id: 'th-1', message_id: 'msg-1' })
    await first
  })

  it('(n) a getDraft rejecting with a network TypeError surfaces a notice, not an unhandled rejection', async () => {
    // start() voids resyncDraft(), so a non-AgentApiError rethrow would escape as an
    // unhandled rejection. The catch must instead pushError. The notice is the proof:
    // the old rethrow path pushed NO notice (the error escaped), so its presence pins
    // both the surfacing and the absence of an escaping rejection.
    const getDraft = vi
      .fn<(workflowId: string) => Promise<AgentDraftSnapshot>>()
      .mockRejectedValue(new TypeError('fetch failed'))
    const session = useAgentSession({
      rest: fakeRest({ getDraft }),
      events: fakeEvents().source,
      workflowId: () => 'wf-1'
    })
    session.start()
    await Promise.resolve()
    await Promise.resolve()

    expect(session.notices.value).toEqual([
      { level: 'error', text: 'fetch failed' }
    ])
  })

  it('(o) a malformed done for the active turn settles it; a foreign malformed done does not', async () => {
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))
    expect(session.isStreaming.value).toBe(true)

    // A malformed done for a FOREIGN, readable message_id must not abort our turn.
    emit({ type: 'agent_message_done', data: { message_id: 'msg-OTHER' } })
    expect(session.isStreaming.value).toBe(true)

    // A malformed done for the ACTIVE turn settles it (no hung spinner).
    emit({ type: 'agent_message_done', data: { message_id: 'msg-1' } })
    expect(session.isStreaming.value).toBe(false)
  })

  it('(i) a 404 getDraft on start is benign; a 403 pushes an error notice', async () => {
    const getDraft404 = vi
      .fn<(workflowId: string) => Promise<AgentDraftSnapshot>>()
      .mockRejectedValue(new AgentApiError('not found', 404, undefined))
    const session404 = useAgentSession({
      rest: fakeRest({ getDraft: getDraft404 }),
      events: fakeEvents().source,
      workflowId: () => 'wf-1'
    })
    session404.start()
    await Promise.resolve()
    expect(session404.notices.value).toHaveLength(0)

    const getDraft403 = vi
      .fn<(workflowId: string) => Promise<AgentDraftSnapshot>>()
      .mockRejectedValue(new AgentApiError('forbidden', 403, undefined))
    const session403 = useAgentSession({
      rest: fakeRest({ getDraft: getDraft403 }),
      events: fakeEvents().source,
      workflowId: () => 'wf-1'
    })
    session403.start()
    await Promise.resolve()
    expect(session403.notices.value).toEqual([
      { level: 'error', text: 'forbidden' }
    ])
  })
})
