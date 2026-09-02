import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const identity = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue')
  return {
    currentUser: {
      resolvedUserInfo: ref({ id: 'user-1' } as { id: string } | null)
    },
    workspace: { activeWorkspaceId: ref('workspace-1' as string | null) }
  }
})

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => identity.currentUser
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => identity.workspace
}))

import type { NodeLocatorId } from '@/types/nodeIdentification'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'

import type {
  AgentCancelAccepted,
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
  OpenTabsSnapshot,
  PostMessageInput
} from '../../services/agent/agentRestClient'
import type { AgentEventSource } from '../../services/agent/agentEventSource'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'

import { useAgentSession } from './useAgentSession'

const THREAD_KEY = 'Comfy.Agent.ThreadId.user-1.workspace-1'

// TRANSITIONAL (agent-v1 chain): local shadow of useCanvasSelection's
// SelectedNode; slice 16 lands the canonical type and retires this copy.
interface SelectedNode {
  id: string
  locatorId?: NodeLocatorId
  title: string
}

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
  identity.currentUser.resolvedUserInfo.value = { id: 'user-1' }
  identity.workspace.activeWorkspaceId.value = 'workspace-1'
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

describe('useAgentSession (v1 composition root)', () => {
  beforeEach(resetHarness)

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
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('first')
    emit(doneIn('th-9', 'msg-1'))
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

  it('[08-T9 regression] a stale stop() from a superseded session leaves the live turn untouched', async () => {
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

  it('a stopped session does not restore threads after the identity scope changes', async () => {
    localStorage.setItem(
      'Comfy.Agent.ThreadId.user-1.workspace-2',
      'thread-workspace-2'
    )
    const getMessages = vi.fn(async (): Promise<AgentMessages> => [])
    const rest = fakeRest({ getMessages })
    const first = useAgentSession({ rest, events: fakeEvents().source })
    first.start()
    first.stop()
    const second = useAgentSession({ rest, events: fakeEvents().source })
    second.start()

    identity.workspace.activeWorkspaceId.value = 'workspace-2'

    await vi.waitFor(() =>
      expect(getMessages).toHaveBeenCalledWith('thread-workspace-2')
    )
    expect(getMessages).toHaveBeenCalledTimes(1)
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
    localStorage.setItem(THREAD_KEY, 'th-9')
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
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockResolvedValueOnce({ thread_id: 'th-1', message_id: 'msg-1' })
      .mockResolvedValueOnce({ thread_id: 'th-1', message_id: 'msg-2' })
    const cancelMessage = vi
      .fn<
        (threadId: string, messageId: string) => Promise<AgentCancelAccepted>
      >()
      .mockRejectedValue(new AgentApiError('already done', 409, undefined))
    const rest = fakeRest({ cancelMessage, postMessage })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'working'))
    expect(session.isStreaming.value).toBe(true)
    expect(session.editableTurnId.value).toBeNull()

    await session.stopTurn()
    expect(cancelMessage).toHaveBeenCalledWith('th-1', 'msg-1')
    expect(session.notices.value).toHaveLength(0)
    expect(session.isStreaming.value).toBe(true)
    expect(session.editableTurnId.value).toBeNull()

    emit(delta('msg-1', ' Stopped at your request.'))
    emit(done('msg-1'))
    expect(session.isStreaming.value).toBe(false)
    expect(session.editableTurnId.value).toBe('msg-1')

    await session.sendMessage('go revised')
    expect(session.editableTurnId.value).toBeNull()
    expect(
      session.entries.value
        .filter((entry) => entry.role === 'user')
        .map((entry) => entry.text)
    ).toEqual(['go', 'go revised'])

    session.newChat()
    expect(session.editableTurnId.value).toBeNull()
  })

  it('(d1) a normally completed turn is not editable', async () => {
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest: fakeRest(), events: source })
    session.start()

    await session.sendMessage('go')
    emit(done('msg-1'))

    expect(session.isStreaming.value).toBe(false)
    expect(session.editableTurnId.value).toBeNull()
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
    expect(session.editableTurnId.value).toBeNull()
  })

  it('(d3) stopTurn before the POST acknowledgement cancels the acknowledged turn once', async () => {
    let resolvePost: ((ack: AgentTurnAccepted) => void) | undefined
    const postMessage = vi.fn(
      () =>
        new Promise<AgentTurnAccepted>((resolve) => {
          resolvePost = resolve
        })
    )
    const cancelMessage = vi.fn<
      (threadId: string, messageId: string) => Promise<AgentCancelAccepted>
    >(async () => ({ status: 'cancelling' }))
    const rest = fakeRest({ postMessage, cancelMessage })
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()

    const sending = session.sendMessage('go')
    await session.stopTurn()
    expect(cancelMessage).not.toHaveBeenCalled()

    resolvePost?.({ thread_id: 'th-1', message_id: 'msg-1' })
    await sending

    expect(cancelMessage).toHaveBeenCalledTimes(1)
    expect(cancelMessage).toHaveBeenCalledWith('th-1', 'msg-1')
  })

  it('keeps a pending stop attached when the acknowledged turn moves to the background', async () => {
    let resolvePost: ((ack: AgentTurnAccepted) => void) | undefined
    const postMessage = vi.fn(
      () =>
        new Promise<AgentTurnAccepted>((resolve) => {
          resolvePost = resolve
        })
    )
    const cancelMessage = vi.fn<
      (threadId: string, messageId: string) => Promise<AgentCancelAccepted>
    >(async () => ({ status: 'cancelling' }))
    const session = useAgentSession({
      rest: fakeRest({ postMessage, cancelMessage }),
      events: fakeEvents().source
    })
    session.start()

    const sending = session.sendMessage('go')
    await session.stopTurn()
    session.newChat()
    resolvePost?.({ thread_id: 'th-1', message_id: 'msg-1' })
    await sending

    expect(cancelMessage).toHaveBeenCalledOnce()
    expect(cancelMessage).toHaveBeenCalledWith('th-1', 'msg-1')
  })

  it('(g) onStatus(false) aborts the active turn; onStatus(true) is inert', async () => {
    const rest = fakeRest()
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))
    expect(session.isStreaming.value).toBe(true)
    const requestsBefore = vi.mocked(rest.postMessage).mock.calls.length

    status(false)
    expect(session.isStreaming.value).toBe(false)

    // Reconnection recovery is the CRDT follower's job now; the session
    // makes no REST calls on a live transition.
    status(true)
    expect(vi.mocked(rest.postMessage).mock.calls.length).toBe(requestsBefore)
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
    const tags: SelectedNode[] = [
      {
        id: '5',
        locatorId: createNodeLocatorId(null, toNodeId('5')),
        title: 'K'
      },
      {
        id: '6',
        locatorId: createNodeLocatorId(
          '00000000-0000-0000-0000-000000000001',
          toNodeId('6')
        ),
        title: 'Decode'
      }
    ]
    session.start()
    await session.sendMessage('explain', undefined, tags)
    const body = vi.mocked(rest.postMessage).mock.calls[0][1]
    expect(body.selection).toEqual({ node_ids: ['5', '6'] })
  })

  it('(h4) the turn post never carries a draft field (upload retired)', async () => {
    const postMessage = vi.fn(async () => ({
      thread_id: 'th-1',
      message_id: 'msg-1',
      workflow_id: 'wf-1'
    })) as unknown as AgentRestClient['postMessage']
    const rest = fakeRest({ postMessage })
    const { source } = fakeEvents()
    const adopted = vi.fn()
    const session = useAgentSession({
      rest,
      events: source,
      workflow: {
        current: () => undefined,
        adopted
      }
    })
    session.start()

    await session.sendMessage('hello')

    expect(vi.mocked(postMessage).mock.calls[0][1]).not.toHaveProperty('draft')
    expect(adopted).toHaveBeenCalledWith('wf-1', undefined)
    expect(session.boundWorkflowId.value).toBe('wf-1')
  })

  it("(i2) loadThread drops the previous thread's workflow binding", async () => {
    const rest = fakeRest()
    const { source } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('bind me')
    expect(session.boundWorkflowId.value).toBe('wf-1')

    await session.loadThread('th-2')
    expect(session.boundWorkflowId.value).toBeNull()
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

  it('[08-T7 regression] same-text history cannot collapse the stashed live turn on return', async () => {
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
      'assistant',
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
      'assistant',
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
      'assistant',
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

  it('[08-T8 regression] two backgrounded threads with colliding turn ids route by thread and id', async () => {
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

  it('[08-T1 regression] newChat during a pending accepted turn keeps its ack backgrounded', async () => {
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

  it('(l16) a malformed done without thread identity cannot settle a background turn globally', async () => {
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
    expect(session.isStreaming.value).toBe(true)
    const assistant = session.entries.value.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant')
      expect(assistant.parts).toEqual([
        {
          type: 'text',
          text: 'truncated tail that never lands',
          state: 'streaming'
        }
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

  it('(l19) a backgrounded thread still records tab links in its own transcript', async () => {
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
    emit(delta('msg-1', 'working'))
    await session.loadThread('th-2')

    emit(
      wire({
        type: 'agent_active_tab',
        data: { workflow_id: 'wf-9', message_id: 'msg-1', thread_id: 'th-1' }
      })
    )
    expect(activeTab).not.toHaveBeenCalled()

    await session.loadThread('th-1')
    const assistant = session.entries.value.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant')
      expect(assistant.parts).toContainEqual({
        type: 'tabLink',
        workflowId: 'wf-9',
        name: undefined
      })
  })

  it('[08-T6 regression] a second send while a turn is active posts once and records a busy notice', async () => {
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

  beforeEach(resetHarness)

  it('restores the persisted thread and hydrates its transcript on start', async () => {
    localStorage.setItem(THREAD_KEY, 'th-9')
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

  it('rotates the persisted thread and transcript with workspace identity', async () => {
    localStorage.setItem(THREAD_KEY, 'thread-workspace-1')
    localStorage.setItem(
      'Comfy.Agent.ThreadId.user-1.workspace-2',
      'thread-workspace-2'
    )
    const getMessages = vi.fn(
      async (threadId: string): Promise<AgentMessages> => [
        historyRow(1, 'user', `turn-${threadId}`, `transcript ${threadId}`)
      ]
    )
    const session = useAgentSession({
      rest: fakeRest({ getMessages }),
      events: fakeEvents().source
    })
    session.start()
    await vi.waitFor(() =>
      expect(session.threadId.value).toBe('thread-workspace-1')
    )

    identity.workspace.activeWorkspaceId.value = 'workspace-2'

    await vi.waitFor(() =>
      expect(session.threadId.value).toBe('thread-workspace-2')
    )
    const userTexts = session.entries.value.flatMap((entry) =>
      entry.role === 'user' ? [entry.text] : []
    )
    expect(userTexts).toEqual(['transcript thread-workspace-2'])
  })

  it('forgets a stale persisted thread on 404 without surfacing an error', async () => {
    localStorage.setItem(THREAD_KEY, 'th-gone')
    const getMessages = vi.fn(async (): Promise<AgentMessages> => {
      throw new AgentApiError('not found', 404, null)
    })
    const session = useAgentSession({
      rest: fakeRest({ getMessages }),
      events: fakeEvents().source
    })
    session.start()
    await vi.waitFor(() => expect(localStorage.getItem(THREAD_KEY)).toBeNull())
    expect(session.threadId.value).toBeNull()
    expect(session.entries.value).toHaveLength(0)
    expect(session.notices.value).toHaveLength(0)
  })

  it('keeps a newly accepted thread when boot hydration 404s for the previous thread', async () => {
    localStorage.setItem(THREAD_KEY, 'th-old')
    let rejectHistory!: (error: unknown) => void
    const getMessages = vi.fn(
      () =>
        new Promise<AgentMessages>((_resolve, reject) => {
          rejectHistory = reject
        })
    )
    const postMessage = vi.fn(async (): Promise<AgentTurnAccepted> => ({
      thread_id: 'th-new',
      message_id: 'msg-new'
    }))
    const session = useAgentSession({
      rest: fakeRest({ getMessages, postMessage }),
      events: fakeEvents().source
    })
    session.start()
    await session.sendMessage('new turn')

    rejectHistory(new AgentApiError('gone', 404, null))
    await Promise.resolve()
    await Promise.resolve()

    expect(session.threadId.value).toBe('th-new')
    expect(localStorage.getItem(THREAD_KEY)).toBe('th-new')
  })

  it('persists the thread on send and clears it on newChat', async () => {
    const session = useAgentSession({
      rest: fakeRest(),
      events: fakeEvents().source
    })
    session.start()
    await session.sendMessage('hello')
    expect(localStorage.getItem(THREAD_KEY)).toBe('th-1')

    session.newChat()
    expect(localStorage.getItem(THREAD_KEY)).toBeNull()
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
    expect(localStorage.getItem(THREAD_KEY)).toBe('th-9')
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
    expect(localStorage.getItem(THREAD_KEY)).toBeNull()
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

  it('[08-T4 regression] a localStorage failure cannot fail or orphan the accepted turn', async () => {
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
    expect(session.boundWorkflowId.value).toBe('wf-1')
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
    expect(adopted).toHaveBeenCalledWith('wf-1', context)
  })

  it('[08-T3 regression] a resolving prepare gates the post and preserves its destination snapshot', async () => {
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
    const rest = fakeRest()
    const first = useAgentSession({ rest, events: fakeEvents().source })
    first.start()
    await first.sendMessage('bind me')
    expect(first.boundWorkflowId.value).toBe('wf-1')
    first.stop()

    const second = useAgentSession({ rest, events: fakeEvents().source })
    expect(second.boundWorkflowId.value).toBe('wf-1')
    second.start()
    expect(second.boundWorkflowId.value).toBe('wf-1')
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
    expect(second.boundWorkflowId.value).toBeNull()
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
    expect(localStorage.getItem(THREAD_KEY)).toBeNull()
  })

  it('[08-T2 regression] boot hydration never destroys an accepted in-flight turn', async () => {
    localStorage.setItem(THREAD_KEY, 'th-1')
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

    expect(localStorage.getItem(THREAD_KEY)).toBe('th-1')
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

  it('[08-T5 regression] a backgrounded accepted turn survives hydration and resumes with local metadata', async () => {
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
    expect(localStorage.getItem(THREAD_KEY)).toBeNull()

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
