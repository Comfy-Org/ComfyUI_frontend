import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AgentCancelAccepted,
  AgentDraftSnapshot,
  AgentMessages,
  AgentThreadSummary,
  AgentTurnAccepted,
  TurnId,
  UploadImageResult
} from '../../schemas/agentApiSchema'
import { zAgentWsEvent } from '../../schemas/agentApiSchema'
import { AgentApiError } from '../../services/agent/agentRestClient'
import type {
  AgentRestClient,
  PostMessageInput
} from '../../services/agent/agentRestClient'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentDraftStore } from '../../stores/agent/agentDraftStore'

import type { AgentEventSource } from './useAgentSession'
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
const done = (id: string) =>
  wire({
    type: 'agent_message_done',
    data: { message_id: id, thread_id: 'th-1', usage: null }
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

describe('useAgentSession (v1 composition root)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('(a) posts to new, adopts ids, records the user turn, and renders a settled reply', async () => {
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('make me a cat')

    expect(rest.postMessage).toHaveBeenCalledWith('new', {
      content: 'make me a cat',
      selection: undefined,
      attachments: undefined
    })
    expect(session.threadId.value).toBe('th-1')

    emit(thinking('msg-1', 'planning'))
    emit(delta('msg-1', 'A cat.'))
    emit(done('msg-1'))

    const roles = session.entries.value.map((e) => e.role)
    expect(roles).toEqual(['user', 'assistant'])
    const assistant = session.entries.value[1]
    expect(assistant).toMatchObject({
      role: 'assistant',
      streaming: false
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

  it('(b2) a remounted session continues the persisted thread, not a new one', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockResolvedValueOnce({ thread_id: 'th-9', message_id: 'msg-1' })
      .mockResolvedValueOnce({ thread_id: 'th-9', message_id: 'msg-2' })
    const rest = fakeRest({ postMessage })

    const first = useAgentSession({ rest, events: fakeEvents().source })
    first.start()
    await first.sendMessage('first')
    first.stop()

    const second = useAgentSession({ rest, events: fakeEvents().source })
    second.start()
    await second.sendMessage('second')

    expect(postMessage.mock.calls[0][0]).toBe('new')
    expect(postMessage.mock.calls[1][0]).toBe('th-9')
  })

  it('(b3) a stale stop() from a superseded session leaves the live turn untouched', async () => {
    const rest = fakeRest()
    const conversation = useAgentConversationStore()

    const first = useAgentSession({ rest, events: fakeEvents().source })
    first.start()
    conversation.startTurn('turn-live' as TurnId)

    const second = useAgentSession({ rest, events: fakeEvents().source })
    second.start()
    first.stop()
    await Promise.resolve()
    expect(conversation.activeTurnId).toBe('turn-live')

    second.stop()
    await Promise.resolve()
    expect(conversation.activeTurnId).toBeNull()
  })

  it('(b4) a close with no successor still aborts once the microtask flushes', async () => {
    const conversation = useAgentConversationStore()
    const session = useAgentSession({
      rest: fakeRest(),
      events: fakeEvents().source
    })
    session.start()
    conversation.startTurn('turn-live' as TurnId)

    session.stop()
    expect(conversation.activeTurnId).toBe('turn-live')

    await Promise.resolve()
    expect(conversation.activeTurnId).toBeNull()
  })

  it('(b5) a stop followed by a successor start in the same microtask window skips the abort', async () => {
    const rest = fakeRest()
    const conversation = useAgentConversationStore()

    const first = useAgentSession({ rest, events: fakeEvents().source })
    first.start()
    conversation.startTurn('turn-live' as TurnId)

    first.stop()
    const second = useAgentSession({ rest, events: fakeEvents().source })
    second.start()

    await Promise.resolve()
    await Promise.resolve()
    expect(conversation.activeTurnId).toBe('turn-live')
  })

  it.for([
    ['stale hydrate resolves first', [0, 1]] as const,
    ['current hydrate resolves first', [1, 0]] as const
  ])(
    '(b6) a double toggle within one hydrate round trip keeps the live turn (%s)',
    async ([, resolutionOrder]) => {
      const conversation = useAgentConversationStore()
      const resolvers: Array<(rows: []) => void> = []
      const getMessages = vi.fn(
        () =>
          new Promise<[]>((resolve) => {
            resolvers.push(resolve)
          })
      )
      const rest = fakeRest({ getMessages })

      const s1 = useAgentSession({ rest, events: fakeEvents().source })
      s1.start()
      conversation.setThreadId('th-9')
      conversation.startTurn('turn-live' as TurnId)

      const s2 = useAgentSession({ rest, events: fakeEvents().source })
      s2.start()
      s1.stop()
      const s3 = useAgentSession({ rest, events: fakeEvents().source })
      s3.start()
      s2.stop()
      expect(resolvers).toHaveLength(2)

      for (const index of resolutionOrder) {
        resolvers[index]([])
        await Promise.resolve()
        await Promise.resolve()
      }
      await vi.waitFor(() =>
        expect(conversation.activeTurnId).toBe('turn-live')
      )
    }
  )

  it('(b8) a stale boot hydrate cannot kill a turn started after a remount', async () => {
    const conversation = useAgentConversationStore()
    localStorage.setItem('Comfy.Agent.ThreadId', 'th-9')
    const resolvers: Array<(rows: []) => void> = []
    const getMessages = vi.fn(
      () =>
        new Promise<[]>((resolve) => {
          resolvers.push(resolve)
        })
    )
    const rest = fakeRest({ getMessages })

    const s1 = useAgentSession({ rest, events: fakeEvents().source })
    s1.start()
    expect(conversation.threadId).toBe('th-9')

    const s2 = useAgentSession({ rest, events: fakeEvents().source })
    s2.start()
    s1.stop()
    expect(resolvers).toHaveLength(2)

    resolvers[1]([])
    await vi.waitFor(() => expect(getMessages).toHaveBeenCalledTimes(2))
    conversation.startTurn('turn-live' as TurnId)

    resolvers[0]([])
    await Promise.resolve()
    await Promise.resolve()
    await vi.waitFor(() => expect(conversation.activeTurnId).toBe('turn-live'))
  })

  it('(b7) a transient hydrate failure on rehost resumes the live turn instead of stranding it', async () => {
    const conversation = useAgentConversationStore()
    const getMessages = vi
      .fn<() => Promise<[]>>()
      .mockRejectedValue(new AgentApiError('backend blip', 500, undefined))
    const rest = fakeRest({ getMessages })

    const s1 = useAgentSession({ rest, events: fakeEvents().source })
    s1.start()
    conversation.setThreadId('th-9')
    conversation.startTurn('turn-live' as TurnId)

    const s2 = useAgentSession({ rest, events: fakeEvents().source })
    s2.start()
    s1.stop()

    await vi.waitFor(() => expect(conversation.activeTurnId).toBe('turn-live'))
    expect(conversation.threadId).toBe('th-9')
  })

  it('(c) a postMessage AgentApiError surfaces inline only (no toast) and opens no live turn', async () => {
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

    expect(session.notices.value).toHaveLength(0)
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
    expect(session.notices.value).toHaveLength(0)
    expect(session.isStreaming.value).toBe(true)

    emit(delta('msg-1', ' Stopped at your request.'))
    emit(done('msg-1'))
    expect(session.isStreaming.value).toBe(false)
  })

  it('(d2) stopTurn rejecting with a network TypeError surfaces a notice, not an unhandled rejection', async () => {
    const cancelMessage = vi
      .fn<
        (threadId: string, messageId: string) => Promise<AgentCancelAccepted>
      >()
      .mockRejectedValue(new TypeError('fetch failed'))
    const rest = fakeRest({ cancelMessage })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'working'))

    await session.stopTurn()

    expect(cancelMessage).toHaveBeenCalledWith('th-1', 'msg-1')
    expect(session.notices.value).toEqual([
      { level: 'error', text: 'fetch failed' }
    ])
  })

  it('(e) foreign chat events are ignored, but a mid-turn draft_patch still adopts', async () => {
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('hi')
    emit(delta('msg-1', 'kept'))
    emit(delta('msg-OTHER', 'DROP'))
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
    const session = useAgentSession({ rest, events: source })
    session.start()
    const draft = useAgentDraftStore()
    draft.bind('wf-1')

    emit(draftVersion('wf-1', 9))
    emit(draftVersion('wf-1', 10))
    expect(getDraft).toHaveBeenCalledTimes(1)

    resolveDraft?.({ content: { adopted: true }, version: 10 })
    await Promise.resolve()
    expect(draft.version).toBe(10)
    expect(draft.content).toEqual({ adopted: true })
  })

  it('(g) onStatus(false) aborts the active turn; onStatus(true) resyncs the draft', async () => {
    const rest = fakeRest()
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))
    expect(session.isStreaming.value).toBe(true)
    expect(rest.getDraft).not.toHaveBeenCalled()

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

    await session.sendMessage('with files', [
      { ref: 'upload_a.png', name: 'a.png', previewUrl: 'blob:a' },
      { ref: 'upload_b.png', name: 'b.png' }
    ])

    expect(rest.postMessage).toHaveBeenCalledWith('new', {
      content: 'with files',
      selection: undefined,
      attachments: ['upload_a.png', 'upload_b.png']
    })
  })

  it('(h2) tags ride as node_ids on the POST selection', async () => {
    const rest = fakeRest()
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()
    await session.sendMessage('explain', undefined, [
      { id: '5', title: 'K' },
      { id: '6', title: 'Decode' }
    ])
    const body = vi.mocked(rest.postMessage).mock.calls[0][1]
    expect(body.selection).toEqual({ node_ids: ['5', '6'] })
  })

  it('(h4) attaches the draft snapshot and reports the upload to adopted', async () => {
    const rest = fakeRest()
    const adopted = vi.fn()
    const session = useAgentSession({
      rest,
      events: fakeEvents().source,
      workflow: {
        current: () => undefined,
        adopted,
        snapshot: () => ({
          content: { nodes: [{ id: 1 }] },
          version: null
        })
      }
    })
    session.start()
    await session.sendMessage('hi')
    expect(vi.mocked(rest.postMessage).mock.calls[0][1]).toMatchObject({
      draft: { content: { nodes: [{ id: 1 }] }, version: null }
    })
    expect(adopted).toHaveBeenCalledWith('wf-1', undefined, true)
  })

  it('(h6) a 5xx draft rejection retries without the draft and reports uploaded=false', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockRejectedValueOnce(
        new AgentApiError('internal server error', 500, {
          error: 'internal server error'
        })
      )
      .mockResolvedValueOnce({
        thread_id: 'th-1',
        message_id: 'msg-1',
        workflow_id: 'wf-1'
      })
    const rest = fakeRest({ postMessage })
    const adopted = vi.fn()
    const uploadSkipped = vi.fn()
    const session = useAgentSession({
      rest,
      events: fakeEvents().source,
      workflow: {
        current: () => undefined,
        adopted,
        uploadSkipped,
        snapshot: () => ({
          content: { nodes: [{ id: 1 }] },
          version: null
        })
      }
    })
    session.start()
    const sent = await session.sendMessage('hi')

    expect(sent).toBe(true)
    expect(postMessage).toHaveBeenCalledTimes(2)
    expect(postMessage.mock.calls[0][1]).toHaveProperty('draft')
    expect(postMessage.mock.calls[1][1].draft).toBeUndefined()
    expect(uploadSkipped).toHaveBeenCalledTimes(1)
    expect(adopted).toHaveBeenCalledWith('wf-1', undefined, false)
  })

  it('(h5) a 409 draft conflict adopts the server version and retries once', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockRejectedValueOnce(
        new AgentApiError('draft moved', 409, { error: 'conflict', version: 7 })
      )
      .mockResolvedValueOnce({ thread_id: 'th-1', message_id: 'msg-1' })
    const rest = fakeRest({ postMessage })
    const session = useAgentSession({
      rest,
      events: fakeEvents().source,
      workflow: {
        current: () => undefined,
        adopted: () => {},
        snapshot: () => ({ content: { nodes: [{ id: 1 }] }, version: 3 })
      }
    })
    session.start()
    const ok = await session.sendMessage('hi')
    expect(ok).toBe(true)
    expect(postMessage).toHaveBeenCalledTimes(2)
    expect(postMessage.mock.calls[0][1].draft).toMatchObject({ version: 3 })
    expect(postMessage.mock.calls[1][1].draft).toMatchObject({
      content: { nodes: [{ id: 1 }] },
      version: 7
    })
  })

  it("(i2) loadThread drops the previous thread's draft binding", async () => {
    const rest = fakeRest()
    const { source } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('bind me')
    expect(useAgentDraftStore().workflowId).toBe('wf-1')

    await session.loadThread('th-2')
    expect(useAgentDraftStore().workflowId).toBeNull()
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
    const { source, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    const draft = useAgentDraftStore()
    draft.bind('wf-1')
    status(true)
    expect(getDraft).toHaveBeenCalledWith('wf-1')

    draft.bind('wf-2')

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

  it('(l) newChat keeps the active turn running instead of cancelling it', async () => {
    const cancelMessage = vi.fn<
      (threadId: string, messageId: string) => Promise<AgentCancelAccepted>
    >(async () => ({ status: 'cancelling' }))
    const getMessages = vi.fn(
      async (threadId: string): Promise<AgentMessages> =>
        threadId === 'th-1' ? [historyRow(1, 'user', 'turn-A', 'go')] : []
    )
    const rest = fakeRest({ cancelMessage, getMessages })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'work'))
    expect(session.isStreaming.value).toBe(true)

    session.newChat()

    expect(cancelMessage).not.toHaveBeenCalled()
    expect(session.entries.value).toHaveLength(0)
    expect(session.threadId.value).toBeNull()

    emit(delta('msg-1', 'ing'))
    await session.loadThread('th-1')

    expect(session.isStreaming.value).toBe(true)
    emit(done('msg-1'))
    const assistant = session.entries.value.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant')
      expect(assistant.parts).toEqual([
        { type: 'text', text: 'working', state: 'done' }
      ])
    expect(session.isStreaming.value).toBe(false)
  })

  it('(l2) switching threads keeps the turn streaming and re-attaches on return', async () => {
    const cancelMessage = vi.fn<
      (threadId: string, messageId: string) => Promise<AgentCancelAccepted>
    >(async () => ({ status: 'cancelling' }))
    const getMessages = vi.fn(
      async (threadId: string): Promise<AgentMessages> =>
        threadId === 'th-1' ? [historyRow(1, 'user', 'turn-A', 'go')] : []
    )
    const rest = fakeRest({ cancelMessage, getMessages })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'work'))

    await session.loadThread('th-2')
    expect(cancelMessage).not.toHaveBeenCalled()
    expect(session.entries.value).toHaveLength(0)
    expect(session.isStreaming.value).toBe(false)

    emit(delta('msg-1', 'ing'))
    expect(session.entries.value).toHaveLength(0)

    await session.loadThread('th-1')
    expect(session.isStreaming.value).toBe(true)
    expect(session.entries.value.map((e) => e.role)).toEqual([
      'user',
      'assistant'
    ])
    const resumed = session.entries.value.at(-1)
    expect(resumed?.role).toBe('assistant')
    if (resumed?.role === 'assistant')
      expect(resumed.parts).toEqual([
        { type: 'text', text: 'working', state: 'streaming' }
      ])

    emit(delta('msg-1', '!'))
    emit(done('msg-1'))
    const assistant = session.entries.value.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant')
      expect(assistant.parts).toEqual([
        { type: 'text', text: 'working!', state: 'done' }
      ])
    expect(session.isStreaming.value).toBe(false)
  })

  it('(l3) a turn that completes while away renders from history without duplication', async () => {
    const getMessages = vi.fn(
      async (threadId: string): Promise<AgentMessages> =>
        threadId === 'th-1'
          ? [
              historyRow(1, 'user', 'turn-A', 'go'),
              historyRow(2, 'assistant', 'turn-A', 'done deal', 'msg-1')
            ]
          : []
    )
    const rest = fakeRest({ getMessages })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'done'))
    await session.loadThread('th-2')
    emit(delta('msg-1', ' deal'))
    emit(done('msg-1'))

    await session.loadThread('th-1')
    expect(session.isStreaming.value).toBe(false)
    expect(session.entries.value.map((e) => e.role)).toEqual([
      'user',
      'assistant'
    ])
    const assistant = session.entries.value.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant')
      expect(assistant.parts).toEqual([
        { type: 'text', text: 'done deal', state: 'done' }
      ])
  })

  it("(l4) a background turn cannot bleed into another thread's live turn", async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockResolvedValueOnce({ thread_id: 'th-1', message_id: 'msg-1' })
      .mockResolvedValueOnce({ thread_id: 'th-2', message_id: 'msg-2' })
    const rest = fakeRest({ postMessage })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('first')
    emit(delta('msg-1', 'A'))

    await session.loadThread('th-2')
    await session.sendMessage('second')
    emit(deltaIn('th-2', 'msg-2', 'B'))
    emit(delta('msg-1', 'A2'))
    emit(doneIn('th-1', 'msg-1'))

    expect(session.isStreaming.value).toBe(true)
    const assistant = session.entries.value.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant')
      expect(assistant.parts).toEqual([
        { type: 'text', text: 'B', state: 'streaming' }
      ])
  })

  it('(l5) a done landing during the return hydrate still renders the full reply', async () => {
    let resolveHistory: ((rows: AgentMessages) => void) | undefined
    const getMessages = vi.fn(
      (threadId: string): Promise<AgentMessages> =>
        threadId === 'th-1'
          ? new Promise((resolve) => {
              resolveHistory = resolve
            })
          : Promise.resolve([])
    )
    const rest = fakeRest({ getMessages })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'the full'))
    await session.loadThread('th-2')
    emit(delta('msg-1', ' reply'))

    const returning = session.loadThread('th-1')
    emit(done('msg-1'))
    resolveHistory?.([historyRow(1, 'user', 'turn-A', 'go')])
    await returning

    expect(session.isStreaming.value).toBe(false)
    expect(session.entries.value.map((e) => e.role)).toEqual([
      'user',
      'assistant'
    ])
    const assistant = session.entries.value.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant')
      expect(assistant.parts).toEqual([
        { type: 'text', text: 'the full reply', state: 'done' }
      ])
  })

  it('(l6) a stale same-thread load resolving last cannot detach the resumed turn', async () => {
    const pending: Array<{
      threadId: string
      resolve: (rows: AgentMessages) => void
    }> = []
    const getMessages = vi.fn(
      (threadId: string): Promise<AgentMessages> =>
        new Promise((resolve) => {
          pending.push({ threadId, resolve })
        })
    )
    const rest = fakeRest({ getMessages })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'work'))

    const staleSameThread = session.loadThread('th-1')
    const detour = session.loadThread('th-2')
    const current = session.loadThread('th-1')

    pending[2].resolve([historyRow(1, 'user', 'turn-A', 'go')])
    await current
    expect(session.isStreaming.value).toBe(true)

    pending[1].resolve([])
    await detour
    pending[0].resolve([historyRow(1, 'user', 'turn-A', 'go')])
    await staleSameThread
    expect(session.isStreaming.value).toBe(true)

    emit(delta('msg-1', 'ing'))
    emit(done('msg-1'))
    const assistant = session.entries.value.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant')
      expect(assistant.parts).toEqual([
        { type: 'text', text: 'working', state: 'done' }
      ])
  })

  it('(l7) double-clicking the same history row keeps the turn attached', async () => {
    const getMessages = vi.fn(
      async (threadId: string): Promise<AgentMessages> =>
        threadId === 'th-1' ? [historyRow(1, 'user', 'turn-A', 'go')] : []
    )
    const rest = fakeRest({ getMessages })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'work'))

    await Promise.all([session.loadThread('th-1'), session.loadThread('th-1')])
    expect(session.isStreaming.value).toBe(true)
    expect(session.entries.value.map((e) => e.role)).toEqual([
      'user',
      'assistant'
    ])

    emit(delta('msg-1', 'ing'))
    emit(done('msg-1'))
    const assistant = session.entries.value.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant')
      expect(assistant.parts).toEqual([
        { type: 'text', text: 'working', state: 'done' }
      ])
  })

  it('(l8) socket death settles background turns instead of leaving zombies', async () => {
    const getMessages = vi.fn(
      async (threadId: string): Promise<AgentMessages> =>
        threadId === 'th-1'
          ? [
              historyRow(1, 'user', 'turn-A', 'go'),
              historyRow(2, 'assistant', 'turn-A', 'from server')
            ]
          : []
    )
    const rest = fakeRest({ getMessages })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))
    await session.loadThread('th-2')

    status(false)
    emit(delta('msg-1', ' never lands'))

    await session.loadThread('th-1')
    expect(session.isStreaming.value).toBe(false)
    expect(session.entries.value.map((e) => e.role)).toEqual([
      'user',
      'assistant'
    ])
    const assistant = session.entries.value.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant')
      expect(assistant.parts).toEqual([
        { type: 'text', text: 'from server', state: 'done' }
      ])
  })

  it('(l9) two backgrounded threads accumulate independently and resume live', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockResolvedValueOnce({ thread_id: 'th-1', message_id: 'msg-1' })
      .mockResolvedValueOnce({ thread_id: 'th-2', message_id: 'msg-2' })
    const rest = fakeRest({ postMessage })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('first')
    emit(delta('msg-1', 'A'))
    await session.loadThread('th-2')
    await session.sendMessage('second')
    emit(deltaIn('th-2', 'msg-2', 'B'))
    await session.loadThread('th-3')

    emit(delta('msg-1', 'A2'))
    emit(deltaIn('th-2', 'msg-2', 'B2'))
    emit(doneIn('th-1', 'msg-1'))

    await session.loadThread('th-2')
    expect(session.isStreaming.value).toBe(true)
    const assistant = session.entries.value.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant')
      expect(assistant.parts).toEqual([
        { type: 'text', text: 'BB2', state: 'streaming' }
      ])
  })

  it('(l10) a 404 thread load does not lose a stashed turn in another thread', async () => {
    const getMessages = vi.fn(
      async (threadId: string): Promise<AgentMessages> => {
        if (threadId === 'th-gone')
          throw new AgentApiError('gone', 404, undefined)
        return threadId === 'th-1'
          ? [historyRow(1, 'user', 'turn-A', 'go')]
          : []
      }
    )
    const rest = fakeRest({ getMessages })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'work'))

    await session.loadThread('th-gone')
    expect(session.threadId.value).toBeNull()

    await session.loadThread('th-1')
    expect(session.isStreaming.value).toBe(true)
    emit(delta('msg-1', 'ing'))
    emit(done('msg-1'))
    const assistant = session.entries.value.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant')
      expect(assistant.parts).toEqual([
        { type: 'text', text: 'working', state: 'done' }
      ])
  })

  it('(l11) an explicit Stop cancels only the displayed turn, not backgrounded ones', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockResolvedValueOnce({ thread_id: 'th-1', message_id: 'msg-1' })
      .mockResolvedValueOnce({ thread_id: 'th-2', message_id: 'msg-2' })
    const cancelMessage = vi.fn<
      (threadId: string, messageId: string) => Promise<AgentCancelAccepted>
    >(async () => ({ status: 'cancelling' }))
    const rest = fakeRest({ postMessage, cancelMessage })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('first')
    emit(delta('msg-1', 'A'))
    await session.loadThread('th-2')
    await session.sendMessage('second')

    await session.stopTurn()
    expect(cancelMessage).toHaveBeenCalledTimes(1)
    expect(cancelMessage).toHaveBeenCalledWith('th-2', 'msg-2')

    emit(delta('msg-1', 'A2'))
    await session.loadThread('th-1')
    expect(session.isStreaming.value).toBe(true)
  })

  it('(l13) newChat during a pending thread load discards that load and keeps the stash', async () => {
    const resolvers: Array<(rows: AgentMessages) => void> = []
    const getMessages = vi.fn(
      (threadId: string): Promise<AgentMessages> =>
        threadId === 'th-1'
          ? new Promise((resolve) => {
              resolvers.push(resolve)
            })
          : Promise.resolve([])
    )
    const rest = fakeRest({ getMessages })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'work'))
    await session.loadThread('th-2')

    const pendingBack = session.loadThread('th-1')
    session.newChat()
    resolvers[0]([historyRow(1, 'user', 'turn-A', 'go')])
    await pendingBack

    expect(session.entries.value).toHaveLength(0)
    expect(session.threadId.value).toBeNull()

    emit(delta('msg-1', 'ing'))
    const returning = session.loadThread('th-1')
    resolvers[1]([historyRow(1, 'user', 'turn-A', 'go')])
    await returning
    expect(session.isStreaming.value).toBe(true)
    emit(done('msg-1'))
    const assistant = session.entries.value.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant')
      expect(assistant.parts).toEqual([
        { type: 'text', text: 'working', state: 'done' }
      ])
  })

  it('(l14) a settled turn already inside a longer history is not duplicated', async () => {
    const getMessages = vi.fn(
      async (threadId: string): Promise<AgentMessages> =>
        threadId === 'th-1'
          ? [
              historyRow(1, 'user', 'turn-A', 'go'),
              historyRow(2, 'assistant', 'turn-A', 'the reply', 'msg-1'),
              historyRow(3, 'user', 'turn-B', 'newer question'),
              historyRow(4, 'assistant', 'turn-B', 'newer reply')
            ]
          : []
    )
    const rest = fakeRest({ getMessages })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'the reply'))
    await session.loadThread('th-2')
    emit(done('msg-1'))

    await session.loadThread('th-1')
    expect(session.isStreaming.value).toBe(false)
    expect(session.entries.value.map((e) => e.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant'
    ])
  })

  it('(l15) reopening after a mid-turn close renders history, not a dead live turn', async () => {
    const getMessages = vi.fn(
      async (threadId: string): Promise<AgentMessages> =>
        threadId === 'th-1'
          ? [
              historyRow(1, 'user', 'turn-A', 'go'),
              historyRow(2, 'assistant', 'turn-A', 'from server')
            ]
          : []
    )
    const rest = fakeRest({ getMessages })

    const first = useAgentSession({ rest, events: fakeEvents().source })
    first.start()
    await first.sendMessage('go')
    expect(first.isStreaming.value).toBe(true)
    first.stop()
    await Promise.resolve()

    const second = useAgentSession({ rest, events: fakeEvents().source })
    second.start()
    await second.loadThread('th-1')

    expect(second.isStreaming.value).toBe(false)
    const assistant = second.entries.value.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant')
      expect(assistant.parts).toEqual([
        { type: 'text', text: 'from server', state: 'done' }
      ])
  })

  it('(l16) a malformed done for a background turn defers to server history on return', async () => {
    const getMessages = vi.fn(
      async (threadId: string): Promise<AgentMessages> =>
        threadId === 'th-1'
          ? [
              historyRow(1, 'user', 'turn-A', 'go'),
              historyRow(2, 'assistant', 'turn-A', 'server truth')
            ]
          : []
    )
    const rest = fakeRest({ getMessages })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'trunc'))
    await session.loadThread('th-2')

    emit({ type: 'agent_message_done', data: { message_id: 'msg-1' } })
    emit(delta('msg-1', 'ated tail that never lands'))

    await session.loadThread('th-1')
    expect(session.isStreaming.value).toBe(false)
    const assistant = session.entries.value.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant')
      expect(assistant.parts).toEqual([
        { type: 'text', text: 'server truth', state: 'done' }
      ])
  })

  it('(l17) remounting the panel refreshes a surviving thread from history', async () => {
    const getMessages = vi.fn(
      async (threadId: string): Promise<AgentMessages> =>
        threadId === 'th-1'
          ? [
              historyRow(1, 'user', 'go', 'go'),
              historyRow(2, 'assistant', 'go', 'finished while closed')
            ]
          : []
    )
    const rest = fakeRest({ getMessages })

    const first = useAgentSession({ rest, events: fakeEvents().source })
    first.start()
    await first.sendMessage('go')
    first.stop()
    await Promise.resolve()

    const second = useAgentSession({ rest, events: fakeEvents().source })
    second.start()

    await vi.waitFor(() => {
      const assistant = second.entries.value.at(-1)
      expect(assistant?.role).toBe('assistant')
      if (assistant?.role === 'assistant')
        expect(assistant.parts).toEqual([
          { type: 'text', text: 'finished while closed', state: 'done' }
        ])
    })
    expect(second.isStreaming.value).toBe(false)
  })

  it('(l18) agent_active_tab routes to the workflow dep only for the displayed thread', async () => {
    const activeTab = vi.fn()
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({
      rest,
      events: source,
      workflow: { current: () => undefined, adopted: vi.fn(), activeTab }
    })
    session.start()
    await session.sendMessage('go')

    emit(
      wire({
        type: 'agent_active_tab',
        data: { workflow_id: 'wf-9', name: 'Video test', thread_id: 'th-OTHER' }
      })
    )
    expect(activeTab).not.toHaveBeenCalled()

    emit(
      wire({
        type: 'agent_active_tab',
        data: { workflow_id: 'wf-9', name: 'Video test', thread_id: 'th-1' }
      })
    )
    expect(activeTab).toHaveBeenCalledWith(
      expect.objectContaining({ workflow_id: 'wf-9', name: 'Video test' })
    )

    emit(
      wire({
        type: 'agent_active_tab',
        data: { workflow_id: 'wf-10' }
      })
    )
    expect(activeTab).toHaveBeenCalledWith(
      expect.objectContaining({ workflow_id: 'wf-10' })
    )
  })

  it('(l12) draft patches from a backgrounded thread cannot drive the displayed draft', async () => {
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    const draft = useAgentDraftStore()
    expect(draft.workflowId).toBe('wf-1')

    emit(
      wire({
        type: 'draft_patch',
        data: {
          base_version: 0,
          version: 1,
          content: { n: 1 },
          workflow_id: 'wf-1',
          thread_id: 'th-OTHER'
        }
      })
    )
    expect(draft.content).toBeNull()

    emit(
      wire({
        type: 'draft_patch',
        data: {
          base_version: 0,
          version: 1,
          content: { n: 1 },
          workflow_id: 'wf-1',
          thread_id: 'th-1'
        }
      })
    )
    expect(draft.content).toEqual({ n: 1 })
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
    expect(postMessage).toHaveBeenCalledTimes(1)

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
    const getDraft = vi
      .fn<(workflowId: string) => Promise<AgentDraftSnapshot>>()
      .mockRejectedValue(new TypeError('fetch failed'))
    const { source, status } = fakeEvents()
    const session = useAgentSession({
      rest: fakeRest({ getDraft }),
      events: source
    })
    session.start()

    useAgentDraftStore().bind('wf-1')
    status(true)
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

    emit({ type: 'agent_message_done', data: { message_id: 'msg-OTHER' } })
    expect(session.isStreaming.value).toBe(true)

    emit({ type: 'agent_message_done', data: { message_id: 'msg-1' } })
    expect(session.isStreaming.value).toBe(false)
  })

  it('(p) non-object and foreign host frames are dropped silently mid-turn', async () => {
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'working'))
    expect(session.isStreaming.value).toBe(true)

    emit('not an object')
    emit({ type: 'status', data: { sid: 1 } })

    expect(session.isStreaming.value).toBe(true)
    expect(session.entries.value.map((e) => e.role)).toEqual([
      'user',
      'assistant'
    ])
    expect(session.notices.value).toHaveLength(0)
  })

  it('(i) a 404 draft resync is benign; a 403 pushes an error notice', async () => {
    const draft = useAgentDraftStore()

    const getDraft404 = vi
      .fn<(workflowId: string) => Promise<AgentDraftSnapshot>>()
      .mockRejectedValue(new AgentApiError('not found', 404, undefined))
    const events404 = fakeEvents()
    const session404 = useAgentSession({
      rest: fakeRest({ getDraft: getDraft404 }),
      events: events404.source
    })
    session404.start()
    draft.bind('wf-1')
    events404.status(true)
    await Promise.resolve()
    expect(session404.notices.value).toHaveLength(0)

    const getDraft403 = vi
      .fn<(workflowId: string) => Promise<AgentDraftSnapshot>>()
      .mockRejectedValue(new AgentApiError('forbidden', 403, undefined))
    const events403 = fakeEvents()
    const session403 = useAgentSession({
      rest: fakeRest({ getDraft: getDraft403 }),
      events: events403.source
    })
    session403.start()
    events403.status(true)
    await Promise.resolve()
    expect(session403.notices.value).toEqual([
      { level: 'error', text: 'forbidden' }
    ])
  })
})
describe('thread resume (B17)', () => {
  const HISTORY: AgentMessages = [
    {
      id: 'row-1',
      thread_id: 'th-9',
      seq: 0,
      role: 'user',
      status: 'complete',
      turn_id: 'turn-1',
      content: { text: 'build a duck' }
    },
    {
      id: 'row-2',
      thread_id: 'th-9',
      seq: 1,
      role: 'assistant',
      status: 'complete',
      turn_id: 'turn-1',
      content: { text: 'Duck workflow ready.' }
    }
  ]

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('restores the persisted thread and hydrates its transcript on start', async () => {
    localStorage.setItem('Comfy.Agent.ThreadId', 'th-9')
    const getMessages = vi.fn(async (): Promise<AgentMessages> => HISTORY)
    const session = useAgentSession({
      rest: fakeRest({ getMessages }),
      events: fakeEvents().source
    })
    session.start()
    await vi.waitFor(() => expect(getMessages).toHaveBeenCalledWith('th-9'))
    await vi.waitFor(() => expect(session.entries.value).toHaveLength(2))

    const [user, assistant] = session.entries.value
    expect(user).toMatchObject({ role: 'user', text: 'build a duck' })
    expect(assistant).toMatchObject({ role: 'assistant', streaming: false })
    expect(session.threadId.value).toBe('th-9')
    expect(session.isStreaming.value).toBe(false)
  })

  it('forgets a stale persisted thread on 404 without surfacing an error', async () => {
    localStorage.setItem('Comfy.Agent.ThreadId', 'th-gone')
    const getMessages = vi.fn(async (): Promise<AgentMessages> => {
      throw new AgentApiError('not found', 404, null)
    })
    const session = useAgentSession({
      rest: fakeRest({ getMessages }),
      events: fakeEvents().source
    })
    session.start()
    await vi.waitFor(() =>
      expect(localStorage.getItem('Comfy.Agent.ThreadId')).toBeNull()
    )
    expect(session.threadId.value).toBeNull()
    expect(session.entries.value).toHaveLength(0)
    expect(session.notices.value).toHaveLength(0)
  })

  it('persists the thread on send and clears it on newChat', async () => {
    const session = useAgentSession({
      rest: fakeRest(),
      events: fakeEvents().source
    })
    session.start()
    await session.sendMessage('hello')
    expect(localStorage.getItem('Comfy.Agent.ThreadId')).toBe('th-1')

    session.newChat()
    expect(localStorage.getItem('Comfy.Agent.ThreadId')).toBeNull()
    expect(useAgentConversationStore().threadId).toBeNull()
  })

  it('panel reopen refreshes the surviving conversation without losing the sent message', async () => {
    const getMessages = vi.fn(
      async (): Promise<AgentMessages> => [
        historyRow(1, 'user', 'turn-A', 'live message'),
        historyRow(2, 'assistant', 'turn-A', 'finished while closed')
      ]
    )
    const rest = fakeRest({ getMessages })
    const first = useAgentSession({ rest, events: fakeEvents().source })
    first.start()
    await first.sendMessage('live message')
    first.stop()
    await Promise.resolve()

    const second = useAgentSession({ rest, events: fakeEvents().source })
    second.start()
    expect(
      second.entries.value.some(
        (entry) => entry.role === 'user' && entry.text === 'live message'
      )
    ).toBe(true)
    await vi.waitFor(() => {
      expect(getMessages).toHaveBeenCalledWith('th-1')
      const assistant = second.entries.value.at(-1)
      expect(assistant?.role).toBe('assistant')
      if (assistant?.role === 'assistant')
        expect(assistant.parts).toEqual([
          { type: 'text', text: 'finished while closed', state: 'done' }
        ])
    })
  })

  it('loadThread adopts, persists and hydrates a chat picked from history', async () => {
    const getMessages = vi.fn(async (): Promise<AgentMessages> => HISTORY)
    const session = useAgentSession({
      rest: fakeRest({ getMessages }),
      events: fakeEvents().source
    })
    session.start()

    await session.loadThread('th-9')

    expect(getMessages).toHaveBeenCalledWith('th-9')
    expect(session.threadId.value).toBe('th-9')
    expect(localStorage.getItem('Comfy.Agent.ThreadId')).toBe('th-9')
    await vi.waitFor(() => expect(session.entries.value).toHaveLength(2))
    expect(session.entries.value[0]).toMatchObject({
      role: 'user',
      text: 'build a duck'
    })
  })

  it('listThreads returns the REST client thread list', async () => {
    const listThreads = vi.fn(
      async (): Promise<AgentThreadSummary[]> => [
        {
          id: 'th-9',
          title: 'build a duck',
          updated_at: '2026-07-07T00:00:00Z'
        }
      ]
    )
    const session = useAgentSession({
      rest: fakeRest({ listThreads }),
      events: fakeEvents().source
    })
    const threads = await session.listThreads()
    expect(threads).toHaveLength(1)
    expect(threads[0]).toMatchObject({ id: 'th-9', title: 'build a duck' })
  })
})
