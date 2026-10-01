import type {
  AgentAdmissionError,
  UploadImageResponse
} from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { api } from '@/scripts/api'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'

import type {
  AgentAnswerAccepted,
  AgentCancelAccepted,
  AgentMessages,
  AgentRunModePreference,
  AgentThreadSummary,
  AgentTurnAccepted,
  TurnId
} from '../../schemas/agentApiSchema'
import {
  zAgentAdmissionError,
  zAgentTurnAccepted,
  zAgentWsEvent
} from '../../schemas/agentApiSchema'
import {
  AgentApiError,
  AgentResponseUnreadableError,
  createAgentRestClient
} from '../../services/agent/agentRestClient'
import type {
  AgentRestClient,
  PostMessageInput
} from '../../services/agent/agentRestClient'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'

import type { SelectedNode } from './useCanvasSelection'
import type { AgentEventSource, TurnOrigin } from './useAgentSession'
import { useAgentSession } from './useAgentSession'

vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/platform/telemetry'))
const telemetryProvider = useTelemetry()
assert.exists(telemetryProvider)
const telemetry = vi.mocked(telemetryProvider)

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
      async (): Promise<AgentCancelAccepted> => ({
        status: 'cancelling'
      })
    ),
    answerAsk: vi.fn(
      async (): Promise<AgentAnswerAccepted> => ({
        status: 'answered'
      })
    ),
    uploadImage: vi.fn(
      async (): Promise<UploadImageResponse> => ({
        name: 'n',
        subfolder: '',
        type: 'input'
      })
    )
  }
  return { ...base, ...overrides }
}

function hangingGetMessages(
  _threadId: string,
  options: { signal?: AbortSignal } = {}
): Promise<AgentMessages> {
  return new Promise((_, reject) => {
    options.signal?.addEventListener('abort', () =>
      reject(options.signal?.reason)
    )
  })
}

const storedAttachmentRef = `${'9f2c'.repeat(16)}.png`

function wireSend() {
  const fetchApi = vi
    .spyOn(api, 'fetchApi')
    .mockImplementation(async () =>
      Response.json(
        { thread_id: 'th-1', message_id: 'msg-1', workflow_id: 'wf-1' },
        { status: 202 }
      )
    )
  const session = useAgentSession({
    rest: createAgentRestClient(),
    events: fakeEvents().source
  })
  session.start()
  return {
    send: session.sendMessage,
    postedBody: (): unknown => {
      const posted = fetchApi.mock.calls.filter(
        ([route, init]) =>
          route.endsWith('/messages') && init?.method === 'POST'
      )
      assert(posted.length === 1)
      return JSON.parse(String(posted[0][1]?.body))
    }
  }
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

// Mirrors AgentPanelRoot's originWorkflow(): an explicit `null` origin means
// the send had no origin tab and must resolve to nothing, while an omitted
// origin falls back to whatever tab is active right now.
const pathFor = (
  origin: TurnOrigin | undefined,
  activePath: string | undefined
): string | undefined =>
  origin === null ? undefined : (origin?.tabPath ?? activePath)

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
const runApproval = (id: string, askId = 'turn-1:call-1') =>
  wire({
    type: 'agent_ask',
    data: {
      thread_id: 'th-1',
      message_id: id,
      ask_id: askId,
      kind: 'run_approval',
      context: {
        workflow_id: 'workflow-1',
        workflow_name: 'Portrait workflow'
      },
      prompt: 'Run it?',
      options: [
        { id: 'run', label: 'Run' },
        { id: 'cancel', label: 'Cancel' }
      ],
      min_selections: 1,
      max_selections: 1,
      allow_other: false
    }
  })
const askResolved = (id: string, askId = 'turn-1:call-1') =>
  wire({
    type: 'agent_ask_resolved',
    data: {
      thread_id: 'th-1',
      message_id: id,
      ask_id: askId,
      status: 'answered',
      selected: ['run']
    }
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

function emitDeltaBurst(emit: (raw: unknown) => void, count: number): void {
  for (let index = 0; index < count; index++)
    emit(delta('msg-1', `chunk-${index} `))
}
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

type AgentAdmissionReason = AgentAdmissionError['error']['reason']

function admissionError(
  reason: AgentAdmissionReason,
  message: string,
  retryAfterSeconds?: number
): AgentApiError {
  const serviceUnavailable = reason === 'funds_unavailable'
  const body = zAgentAdmissionError.parse({
    error: {
      message,
      type: serviceUnavailable ? 'SERVICE_UNAVAILABLE' : 'PAYMENT_REQUIRED',
      reason
    }
  })
  return new AgentApiError(
    message,
    serviceUnavailable ? 503 : 402,
    body,
    retryAfterSeconds
  )
}

type SettleCapMailbox = (history: AgentMessages) => void

const capThread = (index: number) => `cap-thread-${index}`
const capMessage = (index: number) => `cap-message-${index}`

/**
 * Arms `count` hydrates that never resolve, lets each hand off to a mailbox
 * holding its own terminal frame, and stops every owner. Returns the resolvers
 * so the caller can settle them all at once -- which is the moment the cap can
 * finally evict, since nothing pending is a candidate.
 */
async function armStoppedCapMailboxes(
  conversation: ReturnType<typeof useAgentConversationStore>,
  count: number
): Promise<SettleCapMailbox[]> {
  const settles: SettleCapMailbox[] = []
  for (let index = 0; index < count; index++) {
    const thread = capThread(index)
    let resolveHistory: SettleCapMailbox | undefined
    const rest = fakeRest({
      getMessages: vi.fn(
        () =>
          new Promise<AgentMessages>((resolve) => {
            resolveHistory = resolve
          })
      )
    })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    conversation.setThreadId(thread)
    session.start()
    await vi.waitFor(() => expect(rest.getMessages).toHaveBeenCalledOnce())
    await vi.advanceTimersByTimeAsync(30_001)
    emit(doneIn(thread, capMessage(index)))
    session.stop()
    assert(resolveHistory !== undefined)
    settles.push(resolveHistory)
  }
  return settles
}

async function settleCapMailboxes(settles: SettleCapMailbox[]): Promise<void> {
  for (const settle of settles) settle([])
  for (let flush = 0; flush < 5; flush++) await Promise.resolve()
}

async function restoredTurnStaysStreaming(
  conversation: ReturnType<typeof useAgentConversationStore>,
  index: number
): Promise<boolean> {
  const thread = capThread(index)
  conversation.setThreadId(thread)
  const successor = useAgentSession({
    rest: fakeRest({
      getMessages: vi.fn(
        async (): Promise<AgentMessages> => [
          {
            ...historyRow(1, 'user', `cap-turn-${index}`, 'go'),
            thread_id: thread
          },
          {
            ...historyRow(
              2,
              'assistant',
              `cap-turn-${index}`,
              '',
              capMessage(index)
            ),
            thread_id: thread,
            content: {},
            status: 'streaming'
          }
        ]
      )
    }),
    events: fakeEvents().source
  })
  successor.start()
  await vi.advanceTimersByTimeAsync(0)
  const streaming = successor.isStreaming.value
  successor.stop()
  conversation.abortActiveTurn()
  return streaming
}

describe('useAgentSession (v1 composition root)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.mocked(reportError).mockClear()
    telemetry.trackAgentStopClicked.mockClear()
  })

  it('initializes when legacy storage cleanup fails', () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementationOnce(() => {
      throw new DOMException('Storage unavailable', 'SecurityError')
    })

    expect(() =>
      useAgentSession({
        rest: fakeRest(),
        events: fakeEvents().source
      })
    ).not.toThrow()
  })

  it('(a) posts to new, adopts ids, records the user turn, and renders a settled reply', async () => {
    const rest = fakeRest()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    await session.sendMessage('make me a cat')

    expect(rest.postMessage).toHaveBeenCalledWith('new', {
      content: 'make me a cat',
      workflowReferences: [],
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

  it('tracks each durable thread start once with its initiating source', async () => {
    const onThreadStarted = vi.fn()
    const { source } = fakeEvents()
    const session = useAgentSession({
      rest: fakeRest(),
      events: source,
      onThreadStarted
    })
    session.start()

    await session.sendMessage('first')
    expect(onThreadStarted).toHaveBeenCalledExactlyOnceWith('first_open')

    session.newChat('new_chat_button')
    await session.sendMessage('second')
    expect(onThreadStarted.mock.calls).toEqual([
      ['first_open'],
      ['new_chat_button']
    ])
  })

  it.for(['success', 'failure', 'new-chat', 'newer-chat', 'cancelled'])(
    'activates only a ready current selection after %s',
    async (outcome) => {
      let activeThreadId: string | null = null
      let finishRestoration = (_ready: boolean) => {}
      const restoration = new Promise<boolean>((resolve) => {
        finishRestoration = resolve
      })
      let startRestoration = () => {}
      const restorationStarted = new Promise<void>((resolve) => {
        startRestoration = resolve
      })
      const restored = vi
        .fn(async () => true)
        .mockImplementationOnce(() => {
          startRestoration()
          return restoration
        })
      const session = useAgentSession({
        rest: fakeRest(),
        events: fakeEvents().source,
        onThreadActivated: (id) => {
          activeThreadId = id
        },
        workflow: { current: () => undefined, adopted: vi.fn(), restored }
      })
      session.start()
      await session.sendMessage('First chat')
      expect(activeThreadId).toBe('th-1')

      let navigationCurrent = true
      const opening = session.loadThread('th-pending', () => navigationCurrent)
      await restorationStarted
      expect(activeThreadId).toBe('th-1')

      if (outcome === 'new-chat') session.newChat()
      if (outcome === 'newer-chat') await session.loadThread('th-newer')
      if (outcome === 'cancelled') navigationCurrent = false
      finishRestoration(outcome !== 'failure')
      expect(await opening).toBe(outcome === 'success')
      expect(activeThreadId).toBe(
        outcome === 'success'
          ? 'th-pending'
          : outcome === 'new-chat'
            ? null
            : outcome === 'newer-chat'
              ? 'th-newer'
              : 'th-1'
      )
      session.stop()
    }
  )

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

  // PM-1776 / PM-1682. (b4) above is the minimize, which abandons the turn
  // locally while the server keeps running it; this is the reopen.
  it('(b4a) a reopen over a turn the server still runs restores it as live', async () => {
    const conversation = useAgentConversationStore()
    const rest = fakeRest({
      getMessages: vi.fn(
        async (): Promise<AgentMessages> => [
          historyRow(1, 'user', 'turn-1', 'add an audio output node'),
          {
            ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
            content: {},
            status: 'streaming'
          }
        ]
      )
    })

    const minimized = useAgentSession({ rest, events: fakeEvents().source })
    minimized.start()
    await minimized.sendMessage('add an audio output node')
    minimized.stop()
    await Promise.resolve()
    expect(conversation.activeTurnId).toBeNull()

    const reopened = useAgentSession({ rest, events: fakeEvents().source })
    reopened.start()

    await vi.waitFor(() => expect(reopened.isStreaming.value).toBe(true))
    expect(conversation.activeTurnId).toBe('msg-1')
  })

  // The other half of (b4a): `subscribe()` runs before the GET resolves, and
  // the reopen dropped its background turns, so a done arriving in that window
  // has nowhere to land. Lost, it would leave the restored turn running for
  // good -- Stop answered 409 and swallowed, Send never offered.
  it('(b4b) a done that lands while the reopen is hydrating still settles the turn', async () => {
    const conversation = useAgentConversationStore()
    let deliverHistory: ((history: AgentMessages) => void) | undefined
    const rest = fakeRest({
      getMessages: vi.fn(
        () =>
          new Promise<AgentMessages>((resolve) => {
            deliverHistory = resolve
          })
      )
    })

    const minimized = useAgentSession({ rest, events: fakeEvents().source })
    minimized.start()
    await minimized.sendMessage('add an audio output node')
    minimized.stop()
    await Promise.resolve()

    const { source, emit } = fakeEvents()
    const reopened = useAgentSession({ rest, events: source })
    reopened.start()

    emit(done('msg-1'))
    assert(deliverHistory !== undefined)
    deliverHistory([
      historyRow(1, 'user', 'turn-1', 'add an audio output node'),
      {
        ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
        content: {},
        status: 'streaming'
      }
    ])

    await vi.waitFor(() =>
      expect(conversation.messages.map((message) => message.id)).toEqual([
        'turn-1'
      ])
    )
    expect(reopened.isStreaming.value).toBe(false)
    expect(conversation.activeTurnId).toBeNull()
  })

  it('(b4u) routes a terminal frame to a background turn before hydration capture', async () => {
    const conversation = useAgentConversationStore()
    const rest = fakeRest({ getMessages: vi.fn(hangingGetMessages) })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    conversation.setThreadId('th-1')
    conversation.startTurn('msg-1' as TurnId)
    conversation.stashActiveTurn()
    void session.loadThread('th-1')
    conversation.setThreadId('th-2')

    emit(done('msg-1'))

    expect(conversation.liveTurns()).toEqual([])
  })

  it('(b4n) isolates a failed replay frame and still delivers the terminal frame after it', async () => {
    const conversation = useAgentConversationStore()
    let deliverHistory: ((history: AgentMessages) => void) | undefined
    const rest = fakeRest({
      getMessages: vi.fn(
        () =>
          new Promise<AgentMessages>((resolve) => {
            deliverHistory = resolve
          })
      )
    })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({
      rest,
      events: source,
      workflow: {
        current: () => undefined,
        adopted: () => undefined,
        activeTab: () => {
          throw new Error('panel was torn down')
        }
      }
    })
    session.start()
    await session.sendMessage('go')
    void session.loadThread('th-1')

    emit(
      wire({
        type: 'agent_active_tab',
        data: {
          thread_id: 'th-1',
          message_id: 'msg-1',
          workflow_id: 'wf-1'
        }
      })
    )
    emit(done('msg-1'))
    assert(deliverHistory !== undefined)
    deliverHistory([
      historyRow(1, 'user', 'turn-1', 'go'),
      {
        ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
        content: {},
        status: 'streaming'
      }
    ])

    await vi.waitFor(() => expect(conversation.activeTurnId).toBeNull())
    expect(session.isStreaming.value).toBe(false)
    expect(
      vi
        .mocked(reportError)
        .mock.calls.filter(
          ([, metadata]) =>
            metadata.errorType === 'agent_hydration_replay_failed'
        )
    ).toHaveLength(1)
    expect(reportError).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ errorType: 'agent_history_load_failed' })
    )
  })

  // A buffered frame defers, it does not disappear: the hydrate that armed the
  // buffer may never reach its own replay, and the background turn waiting on
  // that done is the one `resumeBackgroundTurn` would otherwise restore as
  // permanently running.
  it('(b4c) a superseded hydrate still delivers the done its stashed turn waits on', async () => {
    const conversation = useAgentConversationStore()
    let deliverHistory: ((history: AgentMessages) => void) | undefined
    const rest = fakeRest({
      getMessages: vi.fn(
        () =>
          new Promise<AgentMessages>((resolve) => {
            deliverHistory = resolve
          })
      )
    })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    await session.sendMessage('add an audio output node')
    emit(thinking('msg-1', 'planning'))
    expect(session.isStreaming.value).toBe(true)

    // Re-selecting the open thread stashes the live turn and starts a hydrate;
    // New chat abandons that hydrate while its GET is still in flight.
    const reselect = session.loadThread('th-1')
    session.newChat('new_chat_button')

    emit(done('msg-1'))
    assert(deliverHistory !== undefined)
    deliverHistory([])
    await reselect

    conversation.setThreadId('th-1')
    conversation.resumeBackgroundTurn()

    expect(conversation.isStreaming).toBe(false)
  })

  // A panel can close after the terminal frame was buffered but before its
  // history request installs a transport. The successor must own that frame:
  // replaying it during stop has no active turn to settle.
  it('(b4d) hands a buffered done to the successor when the panel closes mid-fetch', async () => {
    const conversation = useAgentConversationStore()
    const rest = fakeRest({
      getMessages: vi.fn(() => new Promise<AgentMessages>(() => {}))
    })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    await session.sendMessage('go')
    emit(thinking('msg-1', 'planning'))

    void session.loadThread('th-1')
    emit(done('msg-1'))
    session.stop()
    await Promise.resolve()
    expect(conversation.activeTurnId).toBeNull()

    const reopened = useAgentSession({
      rest: fakeRest({
        getMessages: vi.fn(
          async (): Promise<AgentMessages> => [
            historyRow(1, 'user', 'turn-1', 'go'),
            {
              ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
              content: {},
              status: 'streaming'
            }
          ]
        )
      }),
      events: fakeEvents().source
    })
    reopened.start()

    await vi.waitFor(() => {
      expect(conversation.messages.map((message) => message.id)).toEqual([
        'turn-1'
      ])
      expect(reopened.isStreaming.value).toBe(false)
      expect(conversation.activeTurnId).toBeNull()
    })
  })

  it('(b4j) captures a terminal frame after handoff expiry while hydration is pending', async () => {
    vi.useFakeTimers()
    try {
      const conversation = useAgentConversationStore()
      let deliverHistory: ((history: AgentMessages) => void) | undefined
      const rest = fakeRest({
        getMessages: vi.fn(
          () =>
            new Promise<AgentMessages>((resolve) => {
              deliverHistory = resolve
            })
        )
      })
      const { source, emit } = fakeEvents()
      conversation.setThreadId('th-1')
      const session = useAgentSession({ rest, events: source })
      session.start()
      await vi.waitFor(() => expect(rest.getMessages).toHaveBeenCalledOnce())

      await vi.advanceTimersByTimeAsync(30_001)
      emit(done('msg-1'))
      assert(deliverHistory !== undefined)
      deliverHistory([
        historyRow(1, 'user', 'turn-1', 'go'),
        {
          ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
          content: {},
          status: 'streaming'
        }
      ])

      await vi.waitFor(() => expect(conversation.activeTurnId).toBeNull())
      expect(session.isStreaming.value).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('(b4p) captures a terminal frame past the mailbox TTL while hydration is pending', async () => {
    vi.useFakeTimers()
    try {
      const conversation = useAgentConversationStore()
      let deliverHistory: ((history: AgentMessages) => void) | undefined
      const rest = fakeRest({
        getMessages: vi.fn(
          () =>
            new Promise<AgentMessages>((resolve) => {
              deliverHistory = resolve
            })
        )
      })
      const { source, emit } = fakeEvents()
      conversation.setThreadId('th-1')
      const session = useAgentSession({ rest, events: source })
      session.start()
      await vi.waitFor(() => expect(rest.getMessages).toHaveBeenCalledOnce())

      // Past the handoff into the mailbox, then past the mailbox's own TTL --
      // the GET has still not come back, so there is nothing else left to
      // settle the turn the transcript is about to report as streaming.
      await vi.advanceTimersByTimeAsync(30_001)
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 1)
      emit(done('msg-1'))
      assert(deliverHistory !== undefined)
      deliverHistory([
        historyRow(1, 'user', 'turn-1', 'go'),
        {
          ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
          content: {},
          status: 'streaming'
        }
      ])

      await vi.waitFor(() => expect(conversation.activeTurnId).toBeNull())
      expect(session.isStreaming.value).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('(b4o) keeps a pending mailbox when later threads overflow the cap', async () => {
    vi.useFakeTimers()
    try {
      const conversation = useAgentConversationStore()
      const deliver = new Map<string, (history: AgentMessages) => void>()
      const rest = fakeRest({
        getMessages: vi.fn(
          (threadId: string) =>
            new Promise<AgentMessages>((resolve) => {
              deliver.set(threadId, resolve)
            })
        )
      })
      const { source, emit } = fakeEvents()
      conversation.setThreadId('th-1')
      const session = useAgentSession({ rest, events: source })
      session.start()
      await vi.waitFor(() => expect(rest.getMessages).toHaveBeenCalledOnce())

      // A second session for the filler loads: `loadGeneration` is per
      // session, so driving them through this one would supersede th-1's own
      // hydrate and it would never install the transcript at all. Never
      // started, so `sessionGeneration` stays with the session under test.
      const filler = useAgentSession({ rest, events: fakeEvents().source })
      const loads = Array.from({ length: 33 }, (_, i) =>
        filler.loadThread(`filler-${i}`)
      )
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(30_001)
      for (const [threadId, resolve] of deliver)
        if (threadId !== 'th-1') resolve([])
      await Promise.all(loads)

      conversation.setThreadId('th-1')
      emit(done('msg-1'))
      const deliverHistory = deliver.get('th-1')
      assert(deliverHistory !== undefined)
      deliverHistory([
        historyRow(1, 'user', 'turn-1', 'go'),
        {
          ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
          content: {},
          status: 'streaming'
        }
      ])

      await vi.waitFor(() => expect(conversation.activeTurnId).toBeNull())
      expect(session.isStreaming.value).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('(b4q) hands a stopped expired mailbox to the successor once it settles', async () => {
    vi.useFakeTimers()
    try {
      const conversation = useAgentConversationStore()
      let deliverFirst: ((history: AgentMessages) => void) | undefined
      const first = fakeRest({
        getMessages: vi.fn(
          () =>
            new Promise<AgentMessages>((resolve) => {
              deliverFirst = resolve
            })
        )
      })
      const { source, emit } = fakeEvents()
      conversation.setThreadId('th-1')
      const stopping = useAgentSession({ rest: first, events: source })
      stopping.start()
      await vi.waitFor(() => expect(first.getMessages).toHaveBeenCalledOnce())

      // Into the mailbox, holding a terminal frame, then past the TTL that
      // its own pending GET makes it skip -- so settling is the only thing
      // left that can unregister it.
      await vi.advanceTimersByTimeAsync(30_001)
      emit(done('msg-1'))
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 1)
      stopping.stop()
      assert(deliverFirst !== undefined)
      deliverFirst([])
      await vi.advanceTimersByTimeAsync(0)

      // The successor restores that same turn as streaming, so the captured
      // `done` is owed to it -- dropping it is the stranded turn this whole
      // change is against, and (b4d) states the same invariant.
      const second = fakeRest({
        getMessages: vi.fn(
          async (): Promise<AgentMessages> => [
            historyRow(1, 'user', 'turn-1', 'go'),
            {
              ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
              content: {},
              status: 'streaming'
            }
          ]
        )
      })
      conversation.setThreadId('th-1')
      const successor = useAgentSession({
        rest: second,
        events: fakeEvents().source
      })
      successor.start()
      await vi.waitFor(() => expect(second.getMessages).toHaveBeenCalledOnce())
      await vi.advanceTimersByTimeAsync(0)

      await vi.waitFor(() => expect(conversation.activeTurnId).toBeNull())
      expect(successor.isStreaming.value).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  // The other side of (b4q): parking those frames restores the bounds that
  // were suspended while the GET was outstanding, so the mailbox they wait in
  // is a bounded one rather than a permanent registration.
  it('(b4r) expires a stopped mailbox on the TTL its settlement re-arms', async () => {
    vi.useFakeTimers()
    try {
      const conversation = useAgentConversationStore()
      let deliverFirst: ((history: AgentMessages) => void) | undefined
      const first = fakeRest({
        getMessages: vi.fn(
          () =>
            new Promise<AgentMessages>((resolve) => {
              deliverFirst = resolve
            })
        )
      })
      const { source, emit } = fakeEvents()
      conversation.setThreadId('th-1')
      const stopping = useAgentSession({ rest: first, events: source })
      stopping.start()
      await vi.waitFor(() => expect(first.getMessages).toHaveBeenCalledOnce())

      await vi.advanceTimersByTimeAsync(30_001)
      emit(done('msg-1'))
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 1)
      stopping.stop()
      assert(deliverFirst !== undefined)
      deliverFirst([])
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 1)

      const second = fakeRest({
        getMessages: vi.fn(
          async (): Promise<AgentMessages> => [
            historyRow(1, 'user', 'turn-1', 'go'),
            {
              ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
              content: {},
              status: 'streaming'
            }
          ]
        )
      })
      conversation.setThreadId('th-1')
      const successor = useAgentSession({
        rest: second,
        events: fakeEvents().source
      })
      successor.start()
      await vi.waitFor(() => expect(second.getMessages).toHaveBeenCalledOnce())
      await vi.advanceTimersByTimeAsync(0)

      expect(conversation.activeTurnId).toBe('msg-1')
      expect(successor.isStreaming.value).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('(b4t) evicts the oldest stopped mailbox when pending hydrates settle over the cap', async () => {
    vi.useFakeTimers()
    try {
      const conversation = useAgentConversationStore()
      const stopped = await armStoppedCapMailboxes(conversation, 33)
      await settleCapMailboxes(stopped)

      expect(await restoredTurnStaysStreaming(conversation, 0)).toBe(true)
      expect(await restoredTurnStaysStreaming(conversation, 32)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('(b4k) retires stopped thread A while its successor hydrates thread B', async () => {
    vi.useFakeTimers()
    try {
      const conversation = useAgentConversationStore()
      conversation.setThreadId('thread-a')
      const historyFor = (threadId: string): AgentMessages => {
        const suffix = threadId === 'thread-a' ? 'a' : 'b'
        return [
          {
            ...historyRow(1, 'user', `turn-${suffix}`, 'go'),
            thread_id: threadId
          },
          {
            ...historyRow(
              2,
              'assistant',
              `turn-${suffix}`,
              '',
              `msg-${suffix}`
            ),
            thread_id: threadId,
            content: {},
            status: 'streaming'
          }
        ]
      }
      let historyCalls = 0
      const rest = fakeRest({
        getMessages: vi.fn((threadId: string) =>
          threadId === 'thread-a' && ++historyCalls === 1
            ? new Promise<AgentMessages>(() => {})
            : Promise.resolve(historyFor(threadId))
        )
      })
      const first = useAgentSession({ rest, events: fakeEvents().source })
      first.start()
      first.stop()
      await Promise.resolve()

      conversation.setThreadId('thread-b')
      const { source, emit } = fakeEvents()
      const reopened = useAgentSession({ rest, events: source })
      reopened.start()
      await vi.waitFor(() => expect(conversation.activeTurnId).toBe('msg-b'))

      emit(doneIn('thread-a', 'msg-a'))
      await vi.advanceTimersByTimeAsync(30_001)
      await reopened.loadThread('thread-a')

      expect(conversation.activeTurnId).toBeNull()
      expect(reopened.isStreaming.value).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('(b4l) preserves a same-thread handoff through 29,999 ms', async () => {
    vi.useFakeTimers()
    try {
      const conversation = useAgentConversationStore()
      const rest = fakeRest({
        getMessages: vi
          .fn<(threadId: string) => Promise<AgentMessages>>()
          .mockImplementationOnce(() => new Promise(() => {}))
          .mockResolvedValueOnce([
            historyRow(1, 'user', 'turn-1', 'go'),
            {
              ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
              content: {},
              status: 'streaming'
            }
          ])
      })
      const { source, emit } = fakeEvents()
      const first = useAgentSession({ rest, events: source })
      first.start()
      await first.sendMessage('go')
      void first.loadThread('th-1')
      emit(done('msg-1'))
      first.stop()

      await vi.advanceTimersByTimeAsync(29_999)
      const reopened = useAgentSession({ rest, events: fakeEvents().source })
      reopened.start()

      await vi.waitFor(() => {
        expect(conversation.messages).toHaveLength(1)
        expect(conversation.activeTurnId).toBeNull()
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('(b4m) bounds a hung hydrate queue without dropping its terminal frame', async () => {
    const conversation = useAgentConversationStore()
    let deliverHistory: ((history: AgentMessages) => void) | undefined
    const rest = fakeRest({
      getMessages: vi.fn(
        () =>
          new Promise<AgentMessages>((resolve) => {
            deliverHistory = resolve
          })
      )
    })
    const { source, emit } = fakeEvents()
    conversation.setThreadId('th-1')
    const session = useAgentSession({ rest, events: source })
    session.start()
    await vi.waitFor(() => expect(rest.getMessages).toHaveBeenCalledOnce())
    emit(done('msg-1'))
    emitDeltaBurst(emit, 300)

    assert(deliverHistory !== undefined)
    deliverHistory([
      historyRow(1, 'user', 'turn-1', 'go'),
      {
        ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
        content: {},
        status: 'streaming'
      }
    ])

    await vi.waitFor(() => expect(conversation.activeTurnId).toBeNull())
    expect(session.isStreaming.value).toBe(false)
  })

  it('(b4s) retains the newest delta window when a hung hydrate queue overflows', async () => {
    const conversation = useAgentConversationStore()
    let deliverHistory: ((history: AgentMessages) => void) | undefined
    const rest = fakeRest({
      getMessages: vi.fn(
        () =>
          new Promise<AgentMessages>((resolve) => {
            deliverHistory = resolve
          })
      )
    })
    const { source, emit } = fakeEvents()
    conversation.setThreadId('th-1')
    const session = useAgentSession({ rest, events: source })
    session.start()
    await vi.waitFor(() => expect(rest.getMessages).toHaveBeenCalledOnce())
    emitDeltaBurst(emit, 300)

    assert(deliverHistory !== undefined)
    deliverHistory([
      historyRow(1, 'user', 'turn-1', 'go'),
      {
        ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
        content: {},
        status: 'streaming'
      }
    ])

    await vi.waitFor(() => expect(session.isStreaming.value).toBe(true))
    expect(conversation.messages[0]).toMatchObject({
      parts: [
        {
          type: 'text',
          text: Array.from(
            { length: 256 },
            (_, index) => `chunk-${index + 44} `
          ).join('')
        }
      ]
    })
  })

  it('(b4i) replays a buffered done after history hydration rejects', async () => {
    const conversation = useAgentConversationStore()
    let rejectHistory: ((error: Error) => void) | undefined
    const rest = fakeRest({
      getMessages: vi.fn(
        () =>
          new Promise<AgentMessages>((_, reject) => {
            rejectHistory = reject
          })
      )
    })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    await session.sendMessage('go')
    emit(thinking('msg-1', 'planning'))

    void session.loadThread('th-1')
    emit(done('msg-1'))
    assert(rejectHistory !== undefined)
    rejectHistory(new Error('history unavailable'))

    await vi.waitFor(() => expect(reportError).toHaveBeenCalled())
    conversation.setThreadId('th-1')
    conversation.resumeBackgroundTurn()
    expect(conversation.isStreaming).toBe(false)
    expect(conversation.activeTurnId).toBeNull()
  })

  // Both halves of the hazard at once, which (b4c)/(b4d) and (b4e) only cover
  // apart: a stash owns the turn, so the replay is a candidate for buffering
  // again, and hydrates of that thread are stacked with only the newest
  // resolving. Nothing bounds the older ones -- `loadThread` discards a stale
  // response but never aborts its request.
  it('(b4f) delivers a done through stacked hydrates of a stashed turn', async () => {
    const conversation = useAgentConversationStore()
    const deliver: ((history: AgentMessages) => void)[] = []
    const rest = fakeRest({
      getMessages: vi.fn(
        () =>
          new Promise<AgentMessages>((resolve) => {
            deliver.push(resolve)
          })
      )
    })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    await session.sendMessage('go')
    emit(thinking('msg-1', 'planning'))

    // Each re-select stashes the live turn and stacks another hydrate of the
    // same thread on the one still fetching.
    const reselects = [
      session.loadThread('th-1'),
      session.loadThread('th-1'),
      session.loadThread('th-1')
    ]
    emit(done('msg-1'))

    deliver[2]([
      historyRow(1, 'user', 'turn-1', 'go'),
      {
        ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
        content: {},
        status: 'streaming'
      }
    ])
    await reselects[2]

    expect(conversation.isStreaming).toBe(false)
    expect(conversation.activeTurnId).toBeNull()
  })

  // Two overlapping hydrates of one thread, which `onSelectHistory` reaches on
  // a double-click. Both resolution orders assert the same outcome, and that
  // symmetry is the point: arming moves the superseded buffer's frames, so
  // neither GET resolving first may change what is replayed. (b4g) below is
  // what fails if that move degrades to a copy; these two only fail together.
  it.for([
    ['superseded hydrate first', [0, 1]],
    ['newer hydrate first', [1, 0]]
  ] as const)(
    '(b4e) replays both hydrates in arrival order, %s',
    async ([, [first, second]]) => {
      const deliver: ((history: AgentMessages) => void)[] = []
      const history: AgentMessages = [
        historyRow(1, 'user', 'turn-1', 'go'),
        {
          ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
          content: {},
          status: 'streaming'
        }
      ]
      const rest = fakeRest({
        getMessages: vi.fn(
          () =>
            new Promise<AgentMessages>((resolve) => {
              deliver.push(resolve)
            })
        )
      })

      const minimized = useAgentSession({ rest, events: fakeEvents().source })
      minimized.start()
      await minimized.sendMessage('go')
      minimized.stop()
      await Promise.resolve()

      const { source, emit } = fakeEvents()
      const session = useAgentSession({ rest, events: source })
      session.start()
      emit(delta('msg-1', 'first half'))

      const reselect = session.loadThread('th-1')
      emit(done('msg-1'))

      deliver[first](history)
      deliver[second](history)
      await reselect

      const assistant = session.entries.value.at(-1)
      assert(assistant !== undefined && 'parts' in assistant)
      expect(
        assistant.parts
          .flatMap((part) => (part.type === 'text' ? [part.text] : []))
          .join('')
      ).toBe('first half')
      expect(session.isStreaming.value).toBe(false)
    }
  )

  // (b4e) cannot see a frame left behind on the superseded buffer: whichever
  // order it resolves in, the stray replay is either re-buffered and then
  // dropped past the done, or arrives with nothing to land on. Here the stash
  // is resumed between the two drains, so the turn is live and accepts it.
  it('(b4g) does not replay a frame the superseding hydrate already took', async () => {
    const deliver: ((history: AgentMessages) => void)[] = []
    const history: AgentMessages = [
      historyRow(1, 'user', 'turn-1', 'go'),
      {
        ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
        content: {},
        status: 'streaming'
      }
    ]
    const rest = fakeRest({
      getMessages: vi.fn(
        () =>
          new Promise<AgentMessages>((resolve) => {
            deliver.push(resolve)
          })
      )
    })

    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    await session.sendMessage('go')

    const superseded = session.loadThread('th-1')
    emit(delta('msg-1', 'half '))
    const reselect = session.loadThread('th-1')

    deliver[1](history)
    await reselect
    deliver[0](history)
    await superseded

    const assistant = session.entries.value.at(-1)
    assert(assistant !== undefined && 'parts' in assistant)
    expect(
      assistant.parts
        .flatMap((part) => (part.type === 'text' ? [part.text] : []))
        .join('')
    ).toBe('half ')
  })

  // The mirror of (b4g): there the superseding hydrate drains first, here the
  // superseded one does, while its replacement is still fetching. Retiring a
  // thread's registration on that drain takes the live buffer with it, and the
  // `done` arriving in the window left behind reaches a turn that is stashed
  // rather than active, so `ingest` drops it -- restoring the turn for good.
  it('(b4h) keeps buffering for a hydrate whose superseded twin drained first', async () => {
    const conversation = useAgentConversationStore()
    const deliver: ((history: AgentMessages) => void)[] = []
    const history: AgentMessages = [
      historyRow(1, 'user', 'turn-1', 'go'),
      {
        ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
        content: {},
        status: 'streaming'
      }
    ]
    const rest = fakeRest({
      getMessages: vi.fn(
        () =>
          new Promise<AgentMessages>((resolve) => {
            deliver.push(resolve)
          })
      )
    })

    const minimized = useAgentSession({ rest, events: fakeEvents().source })
    minimized.start()
    await minimized.sendMessage('go')
    minimized.stop()
    await Promise.resolve()

    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    const superseded = session.loadThread('th-1')
    const reselect = session.loadThread('th-1')

    deliver[1](history)
    await superseded

    emit(done('msg-1'))

    deliver[2](history)
    await reselect

    expect(conversation.isStreaming).toBe(false)
    expect(conversation.activeTurnId).toBeNull()
  })

  it('does not persist a send that resolves after the session stops', async () => {
    let resolvePost: (value: AgentTurnAccepted) => void = () => {}
    const postMessage = vi.fn(
      () =>
        new Promise<AgentTurnAccepted>((resolve) => {
          resolvePost = resolve
        })
    )
    const session = useAgentSession({
      rest: fakeRest({ postMessage }),
      events: fakeEvents().source
    })
    session.start()

    const send = session.sendMessage('late reply')
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledOnce())
    session.stop()
    resolvePost({ thread_id: 'th-late', message_id: 'msg-late' })

    await expect(send).resolves.toBe(false)
    expect(localStorage.getItem(StorageKeys.agentThread('personal'))).toBeNull()
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
    localStorage.setItem(StorageKeys.agentThread('personal'), 'th-9')
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

  it('answers a run approval once and stays busy until its resolution event', async () => {
    const answerAsk = vi.fn(
      async (): Promise<AgentAnswerAccepted> => ({
        status: 'answered'
      })
    )
    const rest = fakeRest({ answerAsk })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    await session.sendMessage('build it')
    emit(runApproval('msg-1'))

    const first = session.answerAsk('turn-1:call-1', 'run')
    const duplicate = session.answerAsk('turn-1:call-1', 'run')

    expect(session.answeringAskIds.value.has('turn-1:call-1')).toBe(true)
    await expect(Promise.all([first, duplicate])).resolves.toEqual([
      true,
      false
    ])
    expect(answerAsk).toHaveBeenCalledTimes(1)
    expect(answerAsk).toHaveBeenCalledWith('th-1', 'turn-1:call-1', ['run'])
    expect(session.answeringAskIds.value.has('turn-1:call-1')).toBe(true)

    emit(askResolved('msg-1'))
    expect(session.answeringAskIds.value.has('turn-1:call-1')).toBe(false)
    expect(
      useAgentConversationStore().messages[0].parts.some(
        (part) => part.type === 'runApproval'
      )
    ).toBe(false)
  })

  it('collapses a stale approval on 409 without surfacing an error', async () => {
    const answerAsk = vi
      .fn<AgentRestClient['answerAsk']>()
      .mockRejectedValue(new AgentApiError('already answered', 409, undefined))
    const { source, emit } = fakeEvents()
    const session = useAgentSession({
      rest: fakeRest({ answerAsk }),
      events: source
    })
    session.start()
    await session.sendMessage('build it')
    emit(runApproval('msg-1'))

    await session.answerAsk('turn-1:call-1', 'cancel')

    expect(reportError).not.toHaveBeenCalled()
    expect(session.notices.value).toEqual([])
    expect(session.answeringAskIds.value.has('turn-1:call-1')).toBe(false)
    expect(
      useAgentConversationStore().messages[0].parts.some(
        (part) => part.type === 'runApproval'
      )
    ).toBe(false)
  })

  it('retains and re-enables an approval after a non-409 answer failure', async () => {
    const answerAsk = vi
      .fn<AgentRestClient['answerAsk']>()
      .mockRejectedValue(new AgentApiError('backend blip', 500, undefined))
    const { source, emit } = fakeEvents()
    const session = useAgentSession({
      rest: fakeRest({ answerAsk }),
      events: source
    })
    session.start()
    await session.sendMessage('build it')
    emit(runApproval('msg-1'))

    await session.answerAsk('turn-1:call-1', 'run')

    expect(reportError).toHaveBeenCalledWith(expect.any(AgentApiError), {
      surface: 'agent',
      errorType: 'agent_ask_answer_failed'
    })
    expect(session.notices.value).toEqual([
      { level: 'error', text: 'backend blip' }
    ])
    expect(session.answeringAskIds.value.has('turn-1:call-1')).toBe(false)
    expect(
      useAgentConversationStore().messages[0].parts.some(
        (part) => part.type === 'runApproval'
      )
    ).toBe(true)
  })

  it('renders no_funds as the paywall reply while keeping the rejected prompt', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockRejectedValue(
        admissionError(
          'no_funds',
          "You're out of credits. Add credits to keep running the agent."
        )
      )
    const session = useAgentSession({
      rest: fakeRest({ postMessage }),
      events: fakeEvents().source
    })
    session.start()

    expect(await session.sendMessage('make a cat')).toBe(false)
    expect(session.entries.value).toMatchObject([
      { role: 'user', text: 'make a cat' },
      {
        role: 'assistant',
        streaming: false,
        parts: [
          {
            type: 'paywall',
            message:
              "You're out of credits. Add credits to keep running the agent."
          }
        ]
      }
    ])
    expect(session.threadId.value).toBeNull()
    expect(session.isStreaming.value).toBe(false)
  })

  it.for(['paywall', 'notice'] as const)(
    'preserves both rejected prompts and distinct %s replies across a panel remount',
    async (partType) => {
      const error =
        partType === 'paywall'
          ? admissionError('no_funds', 'Out of credits')
          : new AgentApiError('Request failed', 500, undefined)
      const rest = fakeRest({
        postMessage: vi
          .fn<AgentRestClient['postMessage']>()
          .mockRejectedValue(error)
      })
      const first = useAgentSession({ rest, events: fakeEvents().source })
      first.start()
      expect(await first.sendMessage('first prompt')).toBe(false)
      const firstReplyId = first.entries.value[1].id
      first.stop()
      await Promise.resolve()

      const second = useAgentSession({ rest, events: fakeEvents().source })
      second.start()
      expect(await second.sendMessage('second prompt')).toBe(false)

      expect(second.entries.value).toMatchObject([
        { role: 'user', text: 'first prompt' },
        { role: 'assistant', streaming: false, parts: [{ type: partType }] },
        { role: 'user', text: 'second prompt' },
        { role: 'assistant', streaming: false, parts: [{ type: partType }] }
      ])
      expect(second.entries.value[3].id).not.toBe(firstReplyId)
      second.stop()
      await Promise.resolve()
    }
  )

  it('renders manual_block as its contact-support error instead of a paywall', async () => {
    const message =
      'This workspace is blocked. Contact support to restore access.'
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockRejectedValue(admissionError('manual_block', message))
    const session = useAgentSession({
      rest: fakeRest({ postMessage }),
      events: fakeEvents().source
    })
    session.start()

    expect(await session.sendMessage('make a cat')).toBe(false)
    const assistant = session.entries.value.at(-1)
    expect(assistant).toMatchObject({
      role: 'assistant',
      parts: [{ type: 'notice', level: 'error', text: message }]
    })
  })

  it('does not retry a funds_unavailable denial even when a draft is attached', async () => {
    const message = 'Billing status is temporarily unavailable; please retry.'
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockRejectedValue(admissionError('funds_unavailable', message))
    const session = useAgentSession({
      rest: fakeRest({ postMessage }),
      events: fakeEvents().source,
      workflow: {
        current: () => undefined,
        adopted: () => {},
        draft: () => ({ content: { nodes: [] } })
      }
    })
    session.start()

    expect(await session.sendMessage('make a cat')).toBe(false)
    expect(postMessage).toHaveBeenCalledOnce()
    expect(session.entries.value.at(-1)).toMatchObject({
      role: 'assistant',
      parts: [{ type: 'notice', level: 'error', text: message }]
    })
  })

  it.for([
    { reason: 'no_funds' as const, status: 500 },
    { reason: 'funds_unavailable' as const, status: 402 }
  ])(
    'rejects a mismatched admission status for $reason',
    async ({ reason, status }) => {
      const valid = admissionError(reason, 'Server denial')
      const session = useAgentSession({
        rest: fakeRest({
          postMessage: vi
            .fn()
            .mockRejectedValue(
              new AgentApiError(valid.message, status, valid.body)
            )
        }),
        events: fakeEvents().source
      })
      session.start()
      expect(await session.sendMessage('try again')).toBe(false)
      expect(session.entries.value.at(-1)).toMatchObject({
        parts: [
          {
            type: 'notice',
            level: 'error',
            text: 'Message failed to send: Server denial'
          }
        ]
      })
    }
  )

  it('carries retryAfterSeconds through on a funds_unavailable denial so the UI can honour Retry-After', async () => {
    const message = 'Billing status is temporarily unavailable; please retry.'
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockRejectedValue(admissionError('funds_unavailable', message, 30))
    const session = useAgentSession({
      rest: fakeRest({ postMessage }),
      events: fakeEvents().source
    })
    session.start()

    expect(await session.sendMessage('make a cat')).toBe(false)
    expect(session.entries.value.at(-1)).toMatchObject({
      role: 'assistant',
      parts: [
        { type: 'notice', level: 'error', text: message, retryAfterSeconds: 30 }
      ]
    })
  })

  it('never attaches retryAfterSeconds to a manual_block denial, even if the transport carried one', async () => {
    const message =
      'This workspace is blocked. Contact support to restore access.'
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      // A 402 has no standard Retry-After semantics; assert the reason gate,
      // not merely the header's absence, in case a proxy ever forwards one.
      .mockRejectedValue(admissionError('manual_block', message, 30))
    const session = useAgentSession({
      rest: fakeRest({ postMessage }),
      events: fakeEvents().source
    })
    session.start()

    expect(await session.sendMessage('make a cat')).toBe(false)
    const notice = session.entries.value.at(-1)
    expect(notice).toMatchObject({
      role: 'assistant',
      parts: [{ type: 'notice', level: 'error', text: message }]
    })
    expect(
      (notice as { parts: Array<{ retryAfterSeconds?: number }> }).parts[0]
        .retryAfterSeconds
    ).toBeUndefined()
  })

  it('does not infer no_funds from a 402 without an admission reason', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockRejectedValue(
        new AgentApiError('payment required', 402, {
          error: { message: 'payment required', type: 'PAYMENT_REQUIRED' }
        })
      )
    const session = useAgentSession({
      rest: fakeRest({ postMessage }),
      events: fakeEvents().source
    })
    session.start()

    await session.sendMessage('make a cat')
    expect(session.entries.value.at(-1)).toMatchObject({
      role: 'assistant',
      parts: [
        {
          type: 'notice',
          level: 'error',
          text: 'Message failed to send: payment required'
        }
      ]
    })
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
    expect(telemetry.trackAgentStopClicked).not.toHaveBeenCalled()

    emit(delta('msg-1', ' Stopped at your request.'))
    expect(session.isStreaming.value).toBe(true)
    expect(session.editableTurnId.value).toBeNull()

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

  it('tracks one committed stop with its method, turn, and elapsed time', async () => {
    let currentTime = 1_000
    const now = vi.spyOn(Date, 'now').mockImplementation(() => currentTime)
    const cancelMessage = vi.fn(
      async (): Promise<AgentCancelAccepted> => ({
        status: 'cancelling'
      })
    )
    const { source } = fakeEvents()
    const session = useAgentSession({
      rest: fakeRest({ cancelMessage }),
      events: source
    })
    session.start()

    await session.sendMessage('go')
    currentTime = 1_450
    await session.stopTurn('escape')

    expect(telemetry.trackAgentStopClicked).toHaveBeenCalledExactlyOnceWith({
      method: 'escape',
      turn_id: 'msg-1',
      turn_elapsed_ms: 450
    })
    now.mockRestore()
  })

  // PM-1776's other end. Reading `streaming` as live restores a row whose
  // worker died too, and the server only reclaims those on a boot at least
  // `staleStreamingCutoff` later -- so the row outlives its process by a long
  // way. 404 is how the server says the row is an orphan rather than that the
  // stop landed; ignoring it leaves the indicator up and Stop offered for a
  // turn no frame will ever settle, which no reopen or refresh escapes.
  it('settles a restored turn the server reports as no longer running', async () => {
    const cancelMessage = vi
      .fn()
      .mockRejectedValue(
        new AgentApiError('turn is no longer running', 404, undefined)
      )
    const rest = fakeRest({
      cancelMessage,
      getMessages: vi.fn(
        async (): Promise<AgentMessages> => [
          historyRow(1, 'user', 'turn-1', 'go'),
          {
            ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
            content: {},
            status: 'streaming'
          }
        ]
      )
    })
    const conversation = useAgentConversationStore()

    const minimized = useAgentSession({ rest, events: fakeEvents().source })
    minimized.start()
    await minimized.sendMessage('go')
    minimized.stop()
    await Promise.resolve()

    const reopened = useAgentSession({ rest, events: fakeEvents().source })
    reopened.start()
    await vi.waitFor(() => expect(reopened.isStreaming.value).toBe(true))

    await reopened.stopTurn('button')

    expect(cancelMessage).toHaveBeenCalledWith('th-1', 'msg-1')
    expect(reopened.isStreaming.value).toBe(false)
    expect(conversation.activeTurnId).toBeNull()
  })

  // The launch window: `Launch` commits the `streaming` row and then starts
  // the run from a goroutine, so a Stop that beats it there names a workflow
  // that does not exist yet and is answered exactly like one that finished.
  // A turn this client started has its own stream and must survive that --
  // abandoning it hands the user a thread the server goes on to run and then
  // answers with 409, which is the state this change exists to remove.
  it('keeps a turn it started when a stop reports the run missing', async () => {
    const cancelMessage = vi
      .fn()
      .mockRejectedValue(
        new AgentApiError('turn is no longer running', 404, undefined)
      )
    const conversation = useAgentConversationStore()
    const { source, emit } = fakeEvents()
    const session = useAgentSession({
      rest: fakeRest({ cancelMessage }),
      events: source
    })
    session.start()
    await session.sendMessage('go')
    emit(delta('msg-1', 'working'))

    await session.stopTurn('button')

    expect(cancelMessage).toHaveBeenCalledWith('th-1', 'msg-1')
    expect(session.isStreaming.value).toBe(true)
    expect(conversation.activeTurnId).toBe('msg-1')
  })

  // The done-before-open ordering, which (b4b) cannot reach because it emits
  // through a listener already installed. Here the turn ends while this
  // session's socket is still attaching, so the frame reaches nobody and is
  // never replayed -- yet the GET, taken at an earlier instant, still reports
  // `streaming`. Nothing will settle the turn it restores, so the 409 that
  // Stop earns against the now-terminal row has to be the thing that does.
  it('settles a snapshot-restored turn whose completion was never delivered', async () => {
    const cancelMessage = vi
      .fn()
      .mockRejectedValue(
        new AgentApiError('turn is not running', 409, undefined)
      )
    const rest = fakeRest({
      cancelMessage,
      getMessages: vi.fn(
        async (): Promise<AgentMessages> => [
          historyRow(1, 'user', 'turn-1', 'go'),
          {
            ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
            content: {},
            status: 'streaming'
          }
        ]
      )
    })
    const conversation = useAgentConversationStore()

    const minimized = useAgentSession({ rest, events: fakeEvents().source })
    minimized.start()
    await minimized.sendMessage('go')
    minimized.stop()
    await Promise.resolve()

    const reopened = useAgentSession({ rest, events: fakeEvents().source })
    reopened.start()
    await vi.waitFor(() => expect(reopened.isStreaming.value).toBe(true))

    await reopened.stopTurn('button')

    expect(reopened.isStreaming.value).toBe(false)
    expect(conversation.activeTurnId).toBeNull()
    expect(reopened.notices.value).toHaveLength(0)
  })

  // A snapshot only says how the turn was restored, not that it stayed
  // stream-less. One frame delivered to it proves this session has a stream
  // after all, and from then on a stop failure has to leave it alone -- the
  // stop is awaited while frames keep arriving, so the frame really can land
  // first. Both statuses, because both retire a snapshot turn.
  it.for([404, 409] as const)(
    'keeps a restored turn a live frame reached when a stop fails with %i',
    async (status) => {
      const cancelMessage = vi
        .fn()
        .mockRejectedValue(new AgentApiError('no turn', status, undefined))
      const rest = fakeRest({
        cancelMessage,
        getMessages: vi.fn(
          async (): Promise<AgentMessages> => [
            historyRow(1, 'user', 'turn-1', 'go'),
            {
              ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
              content: {},
              status: 'streaming'
            }
          ]
        )
      })
      const conversation = useAgentConversationStore()

      const minimized = useAgentSession({ rest, events: fakeEvents().source })
      minimized.start()
      await minimized.sendMessage('go')
      minimized.stop()
      await Promise.resolve()

      const { source, emit } = fakeEvents()
      const reopened = useAgentSession({ rest, events: source })
      reopened.start()
      await vi.waitFor(() => expect(reopened.isStreaming.value).toBe(true))

      const stopping = reopened.stopTurn('button')
      emit(delta('msg-1', 'still here'))
      await stopping

      expect(conversation.activeTurnId).toBe('msg-1')
      expect(reopened.isStreaming.value).toBe(true)
    }
  )

  it.for([404, 409] as const)(
    'keeps a snapshot-restored background turn after live delivery when Stop fails with %i',
    async (status) => {
      const streamingHistory: AgentMessages = [
        historyRow(1, 'user', 'turn-1', 'go'),
        {
          ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
          content: {},
          status: 'streaming'
        }
      ]
      const getMessages = vi.fn(
        async (threadId: string): Promise<AgentMessages> =>
          threadId === 'th-1' ? streamingHistory : []
      )
      const cancelMessage = vi
        .fn()
        .mockRejectedValue(new AgentApiError('no turn', status, undefined))
      const rest = fakeRest({ getMessages, cancelMessage })
      const conversation = useAgentConversationStore()

      const minimized = useAgentSession({ rest, events: fakeEvents().source })
      minimized.start()
      await minimized.sendMessage('go')
      minimized.stop()
      await Promise.resolve()

      const { source, emit } = fakeEvents()
      const reopened = useAgentSession({ rest, events: source })
      reopened.start()
      await vi.waitFor(() => expect(conversation.activeTurnId).toBe('msg-1'))

      await reopened.loadThread('th-2')
      emit(delta('msg-1', 'still live'))
      await reopened.loadThread('th-1')
      expect(conversation.activeTurnId).toBe('msg-1')

      await reopened.stopTurn('button')

      expect(conversation.activeTurnId).toBe('msg-1')
      expect(reopened.isStreaming.value).toBe(true)
    }
  )

  // The rejection can outlive the turn it was issued for: the stop is awaited
  // while frames keep arriving, so by the time a 404 lands the user may have
  // sent again. Settling whatever is active then would abandon a turn that is
  // genuinely running -- the very state this change exists to prevent.
  it.for([
    [
      'not running',
      new AgentApiError('turn is no longer running', 404, undefined)
    ],
    [
      'already finished',
      new AgentApiError('turn is not running', 409, undefined)
    ],
    ['server error', new AgentApiError('boom', 500, undefined)],
    ['network failure', new Error('network down')]
  ] as const)(
    'leaves a newer turn alone when a stale stop reports %s',
    async ([, rejection]) => {
      let rejectCancel: ((error: unknown) => void) | undefined
      const cancelMessage = vi.fn(
        () =>
          new Promise<AgentCancelAccepted>((_resolve, reject) => {
            rejectCancel = reject
          })
      )
      const postMessage = vi
        .fn<
          (
            threadId: string,
            req: PostMessageInput
          ) => Promise<AgentTurnAccepted>
        >()
        .mockResolvedValueOnce({ thread_id: 'th-1', message_id: 'msg-1' })
        .mockResolvedValueOnce({ thread_id: 'th-1', message_id: 'msg-2' })
      const conversation = useAgentConversationStore()
      const { source, emit } = fakeEvents()
      const session = useAgentSession({
        rest: fakeRest({ cancelMessage, postMessage }),
        events: source
      })
      session.start()

      await session.sendMessage('go')
      const stopping = session.stopTurn('button')
      emit(done('msg-1'))

      await session.sendMessage('go again')
      emit(delta('msg-2', 'working'))
      expect(conversation.activeTurnId).toBe('msg-2')

      assert(rejectCancel !== undefined)
      rejectCancel(rejection)
      await stopping

      expect(conversation.activeTurnId).toBe('msg-2')
      expect(session.isStreaming.value).toBe(true)
      expect(session.notices.value).toEqual([])
      expect(vi.mocked(reportError)).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ errorType: 'agent_cancel_turn_failed' })
      )
    }
  )

  // The reconciliation GET outlives the turn that asked for it: the restored
  // turn settles and the user sends again while it is in flight, so the
  // snapshot it returns describes a turn nobody is showing. Applied anyway it
  // overwrites the newer transport, and the abort that follows takes the live
  // turn down with it.
  it('discards a reconciliation snapshot a newer turn has outrun', async () => {
    const streamingHistory: AgentMessages = [
      historyRow(1, 'user', 'turn-1', 'go'),
      {
        ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
        content: {},
        status: 'streaming'
      }
    ]
    let deliverReconcile: ((history: AgentMessages) => void) | undefined
    const getMessages = vi
      .fn<(threadId: string) => Promise<AgentMessages>>()
      .mockResolvedValueOnce(streamingHistory)
      .mockImplementationOnce(
        () =>
          new Promise<AgentMessages>((resolve) => {
            deliverReconcile = resolve
          })
      )
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockResolvedValueOnce({ thread_id: 'th-1', message_id: 'msg-1' })
      .mockResolvedValueOnce({ thread_id: 'th-1', message_id: 'msg-2' })
    const cancelMessage = vi
      .fn()
      .mockRejectedValue(
        new AgentApiError('turn is no longer running', 404, undefined)
      )
    const rest = fakeRest({ getMessages, postMessage, cancelMessage })
    const conversation = useAgentConversationStore()

    const minimized = useAgentSession({ rest, events: fakeEvents().source })
    minimized.start()
    await minimized.sendMessage('go')
    minimized.stop()
    await Promise.resolve()

    const { source, emit } = fakeEvents()
    const reopened = useAgentSession({ rest, events: source })
    reopened.start()
    await vi.waitFor(() => expect(conversation.activeTurnId).toBe('msg-1'))

    const stopping = reopened.stopTurn('button')
    await vi.waitFor(() => assert(deliverReconcile !== undefined))

    emit(done('msg-1'))
    await reopened.sendMessage('go again')
    emit(delta('msg-2', 'working'))
    expect(conversation.activeTurnId).toBe('msg-2')

    assert(deliverReconcile !== undefined)
    deliverReconcile(streamingHistory)
    await stopping

    expect(conversation.activeTurnId).toBe('msg-2')
    expect(reopened.isStreaming.value).toBe(true)
  })

  it('retires a restored turn when reconciliation times out', async () => {
    vi.useFakeTimers()
    try {
      const streamingHistory: AgentMessages = [
        historyRow(1, 'user', 'turn-1', 'go'),
        {
          ...historyRow(2, 'assistant', 'turn-1', '', 'msg-1'),
          content: {},
          status: 'streaming'
        }
      ]
      let deliverReconcile: ((history: AgentMessages) => void) | undefined
      const getMessages = vi
        .fn<(threadId: string) => Promise<AgentMessages>>()
        .mockResolvedValueOnce(streamingHistory)
        .mockImplementationOnce(
          () =>
            new Promise<AgentMessages>((resolve) => {
              deliverReconcile = resolve
            })
        )
      const rest = fakeRest({
        getMessages,
        cancelMessage: vi
          .fn()
          .mockRejectedValue(
            new AgentApiError('turn is no longer running', 404, undefined)
          )
      })
      const conversation = useAgentConversationStore()

      const minimized = useAgentSession({
        rest,
        events: fakeEvents().source
      })
      minimized.start()
      await minimized.sendMessage('go')
      minimized.stop()
      await Promise.resolve()

      const reopened = useAgentSession({
        rest,
        events: fakeEvents().source
      })
      reopened.start()
      await vi.waitFor(() => expect(conversation.activeTurnId).toBe('msg-1'))

      const stopping = reopened.stopTurn('button')
      await vi.waitFor(() => assert(deliverReconcile !== undefined))
      await vi.advanceTimersByTimeAsync(5_000)
      await stopping

      expect(conversation.activeTurnId).toBeNull()
      expect(reopened.isStreaming.value).toBe(false)

      assert(deliverReconcile !== undefined)
      deliverReconcile(streamingHistory)
      await Promise.resolve()

      expect(conversation.activeTurnId).toBeNull()
      expect(reopened.isStreaming.value).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('tracks a stop when completion arrives before cancellation responds', async () => {
    let currentTime = 2_000
    const now = vi.spyOn(Date, 'now').mockImplementation(() => currentTime)
    let resolveCancellation!: (accepted: AgentCancelAccepted) => void
    const cancelMessage = vi.fn(
      () =>
        new Promise<AgentCancelAccepted>((resolve) => {
          resolveCancellation = resolve
        })
    )
    const { source, emit } = fakeEvents()
    const session = useAgentSession({
      rest: fakeRest({ cancelMessage }),
      events: source
    })
    session.start()
    await session.sendMessage('go')

    currentTime = 2_300
    const stopping = session.stopTurn('button')
    emit(done('msg-1'))
    currentTime = 2_900
    resolveCancellation({ status: 'cancelling' })
    await stopping

    expect(telemetry.trackAgentStopClicked).toHaveBeenCalledExactlyOnceWith({
      method: 'button',
      turn_id: 'msg-1',
      turn_elapsed_ms: 300
    })
    now.mockRestore()
  })

  it.for(['button', 'escape'] as const)(
    'tracks a %s stop after restoring a pending approval without a start time',
    async (method) => {
      const history: AgentMessages = [
        historyRow(1, 'user', 'restored-turn', 'Run it'),
        {
          ...historyRow(
            2,
            'assistant',
            'restored-turn',
            '',
            'restored-approval'
          ),
          status: 'streaming',
          pending_ask: {
            message_id: 'restored-approval',
            ask_id: 'restored-turn:call-1',
            kind: 'run_approval',
            context: { workflow_id: 'wf-1' },
            prompt: 'Run it?',
            options: [
              { id: 'run', label: 'Run' },
              { id: 'cancel', label: 'Cancel' }
            ],
            min_selections: 1,
            max_selections: 1,
            allow_other: false
          }
        }
      ]
      const rest = fakeRest({ getMessages: vi.fn(async () => history) })
      const session = useAgentSession({ rest, events: fakeEvents().source })
      session.start()

      await session.loadThread('th-1')
      expect(session.isStreaming.value).toBe(true)
      await session.stopTurn(method)

      expect(rest.cancelMessage).toHaveBeenCalledExactlyOnceWith(
        'th-1',
        'restored-approval'
      )
      expect(telemetry.trackAgentStopClicked).toHaveBeenCalledExactlyOnceWith({
        method,
        turn_id: 'restored-turn',
        turn_elapsed_ms: null
      })
    }
  )

  it('tracks one stop while cancellation is already in flight', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(3_000)
    let resolveCancellation!: (accepted: AgentCancelAccepted) => void
    const cancelMessage = vi.fn(
      () =>
        new Promise<AgentCancelAccepted>((resolve) => {
          resolveCancellation = resolve
        })
    )
    const session = useAgentSession({
      rest: fakeRest({ cancelMessage }),
      events: fakeEvents().source
    })
    session.start()
    await session.sendMessage('go')

    const firstStop = session.stopTurn('button')
    await session.stopTurn('escape')
    resolveCancellation({ status: 'cancelling' })
    await firstStop

    expect(cancelMessage).toHaveBeenCalledExactlyOnceWith('th-1', 'msg-1')
    expect(telemetry.trackAgentStopClicked).toHaveBeenCalledExactlyOnceWith({
      method: 'button',
      turn_id: 'msg-1',
      turn_elapsed_ms: 0
    })
    now.mockRestore()
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

  it.for([
    { method: undefined, expectedStops: [] },
    {
      method: 'button' as const,
      expectedStops: [
        { method: 'button', turn_id: 'msg-1', turn_elapsed_ms: 0 }
      ]
    },
    {
      method: 'escape' as const,
      expectedStops: [
        { method: 'escape', turn_id: 'msg-1', turn_elapsed_ms: 0 }
      ]
    }
  ])(
    '(d3) preserves a $method stop before the POST acknowledgement',
    async ({ method, expectedStops }) => {
      vi.spyOn(Date, 'now').mockReturnValue(1_000)
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
      await session.stopTurn(method)
      expect(cancelMessage).not.toHaveBeenCalled()

      resolvePost?.({ thread_id: 'th-1', message_id: 'msg-1' })
      await sending

      expect(cancelMessage).toHaveBeenCalledTimes(1)
      expect(cancelMessage).toHaveBeenCalledWith('th-1', 'msg-1')
      expect(
        telemetry.trackAgentStopClicked.mock.calls.map(([metadata]) => metadata)
      ).toEqual(expectedStops)
    }
  )

  it('(g) a socket blip keeps the turn live and re-checks the server once on the way back up', async () => {
    // PM-1199 / PM-1200. The server never learns the socket went away: it
    // keeps running the turn and keeps the row `streaming`. Aborting locally
    // on `false` therefore strands the user behind a 409 with a reply that
    // looks finished.
    const rest = fakeRest()
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))
    expect(session.isStreaming.value).toBe(true)
    const postsBefore = vi.mocked(rest.postMessage).mock.calls.length
    const getsBefore = vi.mocked(rest.getMessages).mock.calls.length

    status(false)
    expect(session.isStreaming.value).toBe(true)

    status(true)
    await vi.waitFor(() =>
      expect(vi.mocked(rest.getMessages).mock.calls.length).toBe(getsBefore + 1)
    )
    expect(vi.mocked(rest.getMessages).mock.calls.at(-1)?.[0]).toBe('th-1')
    expect(vi.mocked(rest.postMessage).mock.calls.length).toBe(postsBefore)

    emit(done('msg-1'))
    expect(session.isStreaming.value).toBe(false)
  })

  it('(g2) an initial onStatus(false) snapshot does not abort a surviving turn', async () => {
    // agentEventSource.onStatus reports the current socket state synchronously
    // on subscribe, so the very first callback can be `false` before any real
    // reconnect transition (e.g. the socket hasn't opened yet). That must not
    // abort a turn that survived a remount.
    const rest = fakeRest({
      getMessages: vi.fn(
        async (): Promise<AgentMessages> => [
          historyRow(1, 'user', 'msg-1', 'go'),
          historyRow(2, 'assistant', 'msg-1', 'recovered', 'msg-1')
        ]
      )
    })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()

    status(false)
    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))
    expect(session.isStreaming.value).toBe(true)

    status(true)
    await vi.waitFor(() => expect(session.isStreaming.value).toBe(false))
    expect(rest.getMessages).toHaveBeenCalledWith('th-1', expect.anything())
  })

  // Backend invariant (cloud `newAssistantMessage` + the complete/fail writes):
  // an assistant row carries content only once it goes terminal, so a live turn
  // has nothing to re-hydrate from. Keep this row contentless — giving it text
  // would let a repair that re-hydrates mid-turn pass these, when that repair
  // blanks the reply on screen.
  const streamingTurnRest = () =>
    fakeRest({
      getMessages: vi.fn(
        async (): Promise<AgentMessages> => [
          historyRow(1, 'user', 'msg-1', 'go'),
          {
            ...historyRow(2, 'assistant', 'msg-1', '', 'msg-1'),
            content: {},
            status: 'streaming'
          }
        ]
      )
    })

  it('(g3) a reconnect leaves the turn running instead of settling it', async () => {
    const rest = streamingTurnRest()
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))
    expect(session.isStreaming.value).toBe(true)

    status(false)
    status(true)

    await vi.waitFor(() =>
      expect(rest.getMessages).toHaveBeenCalledWith('th-1', expect.anything())
    )
    expect(session.isStreaming.value).toBe(true)
  })

  it('(g4) deltas that arrive after a reconnect still reach the turn', async () => {
    const rest = streamingTurnRest()
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))

    status(false)
    status(true)
    emit(delta('msg-1', ' and the rest'))

    await vi.waitFor(() =>
      expect(rest.getMessages).toHaveBeenCalledWith('th-1', expect.anything())
    )
    const assistant = session.entries.value.at(-1)
    assert(assistant !== undefined && 'parts' in assistant)
    expect(assistant.parts).toEqual([
      { type: 'text', text: 'partial and the rest', state: 'streaming' }
    ])
  })

  it('(g5) a turn that ended during the drop is settled from its persisted row and its stale approval card is dropped', async () => {
    const rest = fakeRest({
      getMessages: vi.fn(
        async (): Promise<AgentMessages> => [
          historyRow(1, 'user', 'msg-1', 'go'),
          historyRow(2, 'assistant', 'msg-1', 'final answer', 'msg-1')
        ]
      )
    })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(thinking('msg-1', 'planning'))
    emit(delta('msg-1', 'partial'))
    emit(runApproval('msg-1'))

    status(false)
    status(true)

    await vi.waitFor(() => expect(session.isStreaming.value).toBe(false))
    const assistant = session.entries.value.at(-1)
    assert(assistant?.role === 'assistant')
    expect(assistant.parts.map((part) => part.type)).toEqual([
      'thinking',
      'text'
    ])
    expect(assistant.parts.at(-1)).toEqual({
      type: 'text',
      text: 'final answer',
      state: 'done'
    })
    expect(session.notices.value).toEqual([])
  })

  it('(g5a) recovery preserves every persisted assistant row in a turn', async () => {
    const rest = fakeRest({
      getMessages: vi.fn(
        async (): Promise<AgentMessages> => [
          historyRow(1, 'user', 'msg-1', 'go'),
          historyRow(2, 'assistant', 'msg-1', 'first ', 'msg-1'),
          historyRow(3, 'assistant', 'msg-1', 'second')
        ]
      )
    })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))
    status(false)
    status(true)

    await vi.waitFor(() => expect(session.isStreaming.value).toBe(false))
    const assistant = session.entries.value.at(-1)
    assert(assistant?.role === 'assistant')
    expect(assistant.parts).toEqual([
      { type: 'text', text: 'first second', state: 'done' }
    ])
  })

  it('(g5b) recovery preserves text around a persisted tool call', async () => {
    const toolRow = historyRow(3, 'assistant', 'msg-1', '')
    toolRow.content = {
      tool_calls: [
        {
          id: 'tool-1',
          tool_call_id: 'tool-1',
          tool_name: 'add_node',
          status: 'success'
        }
      ]
    }
    const rest = fakeRest({
      getMessages: vi.fn(
        async (): Promise<AgentMessages> => [
          historyRow(1, 'user', 'msg-1', 'go'),
          historyRow(2, 'assistant', 'msg-1', 'before ', 'msg-1'),
          toolRow,
          historyRow(4, 'assistant', 'msg-1', 'after')
        ]
      )
    })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))
    status(false)
    status(true)

    await vi.waitFor(() => expect(session.isStreaming.value).toBe(false))
    const assistant = session.entries.value.at(-1)
    assert(assistant?.role === 'assistant')
    expect(assistant.parts.map((part) => part.type)).toEqual([
      'text',
      'tool',
      'text'
    ])
    expect(assistant.parts).toMatchObject([
      { type: 'text', text: 'before ' },
      { type: 'tool', callId: 'tool-1' },
      { type: 'text', text: 'after' }
    ])
  })

  it('(g6) a row still streaming on the first check is polled with backoff until it goes terminal', async () => {
    const getMessages = vi
      .fn<() => Promise<AgentMessages>>()
      .mockResolvedValueOnce([
        historyRow(1, 'user', 'msg-1', 'go'),
        {
          ...historyRow(2, 'assistant', 'msg-1', '', 'msg-1'),
          content: {},
          status: 'streaming'
        }
      ])
      .mockResolvedValue([
        historyRow(1, 'user', 'msg-1', 'go'),
        historyRow(2, 'assistant', 'msg-1', 'late answer', 'msg-1')
      ])
    const rest = fakeRest({ getMessages })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))

    status(false)
    status(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(getMessages).toHaveBeenCalledTimes(1)
    expect(session.isStreaming.value).toBe(true)

    await vi.advanceTimersByTimeAsync(999)
    expect(getMessages).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(getMessages).toHaveBeenCalledTimes(2)
    expect(session.isStreaming.value).toBe(false)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(getMessages).toHaveBeenCalledTimes(2)
  })

  it('(g6a) a stopped turn settled from REST becomes editable after reconnect', async () => {
    const rest = fakeRest({
      getMessages: vi.fn(
        async (): Promise<AgentMessages> => [
          historyRow(1, 'user', 'msg-1', 'go'),
          {
            ...historyRow(2, 'assistant', 'msg-1', 'interrupted', 'msg-1'),
            status: 'interrupted'
          }
        ]
      )
    })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))
    await session.stopTurn()
    expect(session.editableTurnId.value).toBeNull()

    status(false)
    status(true)

    await vi.waitFor(() => expect(session.isStreaming.value).toBe(false))
    expect(session.editableTurnId.value).toBe('msg-1')
  })

  it('(g7) a flapping socket starts one recovery job per turn, not one per reconnect', async () => {
    const rest = streamingTurnRest()
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))

    status(false)
    status(true)
    status(false)
    status(true)
    await vi.waitFor(() => expect(rest.getMessages).toHaveBeenCalledTimes(1))
  })

  it('(g8) a recovery result landing after the session stopped touches nothing', async () => {
    const pendingHistory: Array<(rows: AgentMessages) => void> = []
    let deliveredResponses = 0
    const getMessages = vi.fn(() =>
      new Promise<AgentMessages>((resolve) => {
        pendingHistory.push(resolve)
      }).then((rows) => {
        deliveredResponses += 1
        return rows
      })
    )
    const rest = fakeRest({ getMessages })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))

    status(false)
    status(true)
    await vi.waitFor(() => expect(getMessages).toHaveBeenCalledTimes(1))

    const successorEvents = fakeEvents()
    const successor = useAgentSession({
      rest,
      events: successorEvents.source
    })
    session.stop()
    successor.start()
    await vi.waitFor(() => expect(pendingHistory).toHaveLength(2))
    const [staleRecovery, remountHydrate] = pendingHistory
    assert.exists(staleRecovery)
    assert.exists(remountHydrate)

    remountHydrate([])
    await vi.waitFor(() => expect(successor.isStreaming.value).toBe(true))
    successorEvents.emit(delta('msg-1', ' still going'))

    staleRecovery([
      historyRow(1, 'user', 'msg-1', 'go'),
      historyRow(2, 'assistant', 'msg-1', 'stale', 'msg-1')
    ])
    await vi.waitFor(() => expect(deliveredResponses).toBe(2))
    const assistant = successor.entries.value.at(-1)
    assert(assistant?.role === 'assistant')
    expect(assistant.parts).toEqual([
      { type: 'text', text: 'partial still going', state: 'streaming' }
    ])
  })

  it('(g9) every backgrounded turn is checked on reconnect, each against its own thread', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockResolvedValueOnce({ thread_id: 'th-1', message_id: 'msg-1' })
      .mockResolvedValueOnce({ thread_id: 'th-2', message_id: 'msg-2' })
    const rest = fakeRest({ postMessage })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('first')
    emit(deltaIn('th-1', 'msg-1', 'one'))
    session.newChat()
    await session.sendMessage('second')
    emit(deltaIn('th-2', 'msg-2', 'two'))
    session.newChat()
    const getsBefore = vi.mocked(rest.getMessages).mock.calls.length

    status(false)
    status(true)

    await vi.waitFor(() =>
      expect(
        vi
          .mocked(rest.getMessages)
          .mock.calls.slice(getsBefore)
          .map(([threadId]) => threadId)
          .sort()
      ).toEqual(['th-1', 'th-2'])
    )
  })

  it('(g10) a failing recovery fetch stays silent and leaves the turn live for the socket', async () => {
    const rest = fakeRest({
      getMessages: vi.fn(async (): Promise<AgentMessages> => {
        throw new TypeError('Failed to fetch')
      })
    })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))

    status(false)
    status(true)
    await vi.advanceTimersByTimeAsync(60_000)

    expect(rest.getMessages).toHaveBeenCalledTimes(6)
    expect(session.notices.value).toEqual([])
    expect(session.isStreaming.value).toBe(true)

    emit(done('msg-1'))
    expect(session.isStreaming.value).toBe(false)
  })

  it('(g11) a thread that no longer exists on the server settles its turn without inventing text', async () => {
    const rest = fakeRest({
      getMessages: vi.fn(async (): Promise<AgentMessages> => {
        throw new AgentApiError('gone', 404, undefined)
      })
    })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))

    status(false)
    status(true)

    await vi.waitFor(() => expect(session.isStreaming.value).toBe(false))
    expect(rest.getMessages).toHaveBeenCalledTimes(2)
    expect(session.entries.value).toEqual([])
    expect(session.notices.value).toEqual([])
  })

  it('(g15) a deleted team-workspace thread is forgotten without touching another workspace', async () => {
    sessionStorage.setItem(
      'Comfy.Workspace.Current',
      JSON.stringify({ type: 'team', id: 'workspace-b' })
    )
    localStorage.setItem(StorageKeys.agentThread('workspace-a'), 'th-a')
    const rest = fakeRest({
      getMessages: vi.fn(async (): Promise<AgentMessages> => {
        throw new AgentApiError('gone', 404, undefined)
      })
    })
    const { source, emit, status } = fakeEvents()
    const onThreadActivated = vi.fn()
    const session = useAgentSession({ rest, events: source, onThreadActivated })
    session.start()
    status(true)
    session.bindWorkflow('wf-1')

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))
    expect(localStorage.getItem(StorageKeys.agentThread('workspace-b'))).toBe(
      'th-1'
    )

    status(false)
    status(true)

    await vi.waitFor(() => expect(session.isStreaming.value).toBe(false))
    expect(session.threadId.value).toBeNull()
    expect(onThreadActivated).toHaveBeenLastCalledWith(null)
    expect(session.boundWorkflowId.value).toBeNull()
    expect(
      localStorage.getItem(StorageKeys.agentThread('workspace-b'))
    ).toBeNull()
    expect(localStorage.getItem(StorageKeys.agentThread('workspace-a'))).toBe(
      'th-a'
    )

    await session.sendMessage('again')
    expect(vi.mocked(rest.postMessage).mock.calls.at(-1)?.[0]).toBe('new')
  })

  it('(g16) a deleted backgrounded thread settles its turn without touching the current thread', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockResolvedValueOnce({ thread_id: 'th-1', message_id: 'msg-1' })
      .mockResolvedValueOnce({ thread_id: 'th-2', message_id: 'msg-2' })
    const getMessages = vi.fn<(threadId: string) => Promise<AgentMessages>>(
      async () => []
    )
    const rest = fakeRest({
      postMessage,
      getMessages
    })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('first')
    emit(deltaIn('th-1', 'msg-1', 'one'))
    session.newChat()
    await session.sendMessage('second')
    emit(deltaIn('th-2', 'msg-2', 'two'))
    emit(doneIn('th-2', 'msg-2'))

    getMessages.mockReset()
    getMessages.mockRejectedValue(new AgentApiError('gone', 404, undefined))
    status(false)
    status(true)

    await vi.waitFor(() =>
      expect(getMessages.mock.calls.map(([threadId]) => threadId)).toEqual([
        'th-1'
      ])
    )
    await vi.waitFor(() =>
      expect(
        useAgentConversationStore()
          .liveTurns()
          .map((turn) => turn.threadId)
      ).toEqual([])
    )
    expect(session.threadId.value).toBe('th-2')
    expect(session.entries.value.at(-1)).toMatchObject({
      role: 'assistant',
      parts: [{ type: 'text', text: 'two', state: 'done' }]
    })
    expect(localStorage.getItem(StorageKeys.agentThread('personal'))).toBe(
      'th-2'
    )
  })

  it('(g18) a history fetch that never answers is abandoned at the recovery deadline', async () => {
    const getMessages = vi.fn(hangingGetMessages)
    const rest = fakeRest({ getMessages })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))

    status(false)
    status(true)
    await vi.advanceTimersByTimeAsync(59_999)
    expect(getMessages).toHaveBeenCalledTimes(1)
    const signal = getMessages.mock.calls[0]?.[1]?.signal
    assert.exists(signal)
    expect(signal.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(signal.aborted).toBe(true)
    expect(session.isStreaming.value).toBe(true)
    expect(reportError).not.toHaveBeenCalled()

    status(false)
    status(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(getMessages).toHaveBeenCalledTimes(2)
  })

  it('(g19) stopping the session cancels its in-flight history fetch', async () => {
    const getMessages = vi.fn(hangingGetMessages)
    const rest = fakeRest({ getMessages })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))

    status(false)
    status(true)
    await vi.waitFor(() => expect(getMessages).toHaveBeenCalledTimes(1))
    const signal = getMessages.mock.calls[0]?.[1]?.signal
    assert.exists(signal)

    session.stop()

    expect(signal.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(getMessages).toHaveBeenCalledTimes(1)
    expect(session.notices.value).toEqual([])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('(g20) finishing one recovery does not unmark a sibling turn whose ids concatenate identically', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockResolvedValueOnce({ thread_id: 'th/1', message_id: 'msg-1' })
      .mockResolvedValueOnce({ thread_id: 'th', message_id: '1/msg-1' })
    const pendingHistory = new Map<string, (rows: AgentMessages) => void>()
    const getMessages = vi.fn(
      (threadId: string) =>
        new Promise<AgentMessages>((resolve) => {
          pendingHistory.set(threadId, resolve)
        })
    )
    const rest = fakeRest({ postMessage, getMessages })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    try {
      session.start()
      status(true)

      await session.sendMessage('first')
      emit(deltaIn('th/1', 'msg-1', 'one'))
      session.newChat()
      await session.sendMessage('second')
      emit(deltaIn('th', '1/msg-1', 'two'))
      session.newChat()
      getMessages.mockClear()

      status(false)
      status(true)
      await vi.waitFor(() =>
        expect(getMessages.mock.calls.map(([id]) => id).sort()).toEqual([
          'th',
          'th/1'
        ])
      )

      pendingHistory.get('th/1')?.([
        { ...historyRow(1, 'user', 'msg-1', 'first'), thread_id: 'th/1' },
        {
          ...historyRow(2, 'assistant', 'msg-1', 'one done', 'msg-1'),
          thread_id: 'th/1'
        }
      ])
      await vi.waitFor(() =>
        expect(
          useAgentConversationStore()
            .liveTurns()
            .map((turn) => turn.threadId)
        ).toEqual(['th'])
      )

      status(false)
      status(true)
      await vi.waitFor(() => expect(getMessages).toHaveBeenCalledTimes(2))
    } finally {
      session.stop()
    }
  })

  it('(g21) a terminal event that beats the pending history fetch keeps the socket transcript', async () => {
    const pendingHistory: Array<(rows: AgentMessages) => void> = []
    let deliveredResponses = 0
    const getMessages = vi.fn(() =>
      new Promise<AgentMessages>((resolve) => {
        pendingHistory.push(resolve)
      }).then((rows) => {
        deliveredResponses += 1
        return rows
      })
    )
    const rest = fakeRest({ getMessages })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))

    status(false)
    status(true)
    await vi.waitFor(() => expect(pendingHistory).toHaveLength(1))
    const [recovery] = pendingHistory
    assert.exists(recovery)

    emit(delta('msg-1', ' from socket'))
    emit(done('msg-1'))
    expect(session.isStreaming.value).toBe(false)

    recovery([
      historyRow(1, 'user', 'msg-1', 'go'),
      historyRow(2, 'assistant', 'msg-1', 'rest wins', 'msg-1')
    ])
    await vi.waitFor(() => {
      expect(deliveredResponses).toBe(1)
      expect(getMessages).toHaveBeenCalledTimes(1)
      const assistant = session.entries.value.at(-1)
      assert(assistant?.role === 'assistant')
      expect(assistant.parts).toEqual([
        { type: 'text', text: 'partial from socket', state: 'done' }
      ])
    })
  })

  it('(g22) a settlement failure after the fetch is reported, not floated as an unhandled rejection', async () => {
    const storageFailure = new Error('conversation reset failed')
    const rest = fakeRest({
      getMessages: vi.fn(async (): Promise<AgentMessages> => {
        throw new AgentApiError('gone', 404, undefined)
      })
    })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    const conversationStore = useAgentConversationStore()
    vi.spyOn(conversationStore, 'reset').mockImplementationOnce(() => {
      throw storageFailure
    })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))

    status(false)
    status(true)

    await vi.waitFor(() => expect(rest.getMessages).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(1000)
    await vi.waitFor(() => expect(rest.getMessages).toHaveBeenCalledTimes(2))
    await vi.waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(storageFailure, {
        surface: 'agent',
        errorType: 'failure_recovering_agent_turn'
      })
    )
    expect(conversationStore.liveTurns()).toHaveLength(1)
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
      workflowReferences: [],
      selection: undefined,
      attachments: ['upload_a.png', 'upload_b.png']
    })
  })

  it('serializes stable attachment refs without unrelated fields', async () => {
    const { postedBody, send } = wireSend()

    await send('upscale this', [
      { ref: storedAttachmentRef, name: 'Beach photo.png' }
    ])

    const body = zAgentPostMessageRequest.parse(postedBody())
    expect(body).toMatchObject({
      content: 'upscale this',
      attachments: [storedAttachmentRef]
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

  it('(h2b) identifies the workflow that owns the selected nodes', async () => {
    const rest = fakeRest()
    const session = useAgentSession({ rest, events: fakeEvents().source })
    const tags: SelectedNode[] = [{ id: '5', title: 'KSampler' }]
    session.start()

    await session.sendMessage(
      'explain',
      undefined,
      tags,
      undefined,
      () => 'wf-selected'
    )

    const body = vi.mocked(rest.postMessage).mock.calls[0][1]
    expect(body.selection).toEqual({
      node_ids: ['5'],
      workflow_id: 'wf-selected'
    })
  })

  it('(h3) sends workflow references separately and keeps them in the local turn', async () => {
    const rest = fakeRest()
    const session = useAgentSession({ rest, events: fakeEvents().source })
    const references = [
      { id: 'wf-context', name: 'Context workflow', textOffset: 0 }
    ]
    session.start()

    await session.sendMessage('compare this', undefined, undefined, references)

    expect(vi.mocked(rest.postMessage).mock.calls[0][1]).toEqual({
      content: '[Context workflow](workflow://wf-context)compare this',
      workflowReferences: [
        { workflow_id: 'wf-context', name: 'Context workflow' }
      ],
      selection: undefined,
      attachments: undefined
    })
    expect(useAgentConversationStore().entries[0]).toMatchObject({
      role: 'user',
      workflowReferences: references
    })
  })

  it('sends inline workflow identities in sentence order while retaining the local chip draft', async () => {
    const rest = fakeRest()
    const session = useAgentSession({ rest, events: fakeEvents().source })
    const references = [
      { id: 'wf-a', name: 'A', textOffset: 5 },
      { id: 'wf-b', name: 'B', textOffset: 11 }
    ]
    session.start()

    await session.sendMessage('Copy  into .', undefined, undefined, references)

    expect(rest.postMessage).toHaveBeenCalledWith(
      'new',
      expect.objectContaining({
        content: 'Copy [A](workflow://wf-a) into [B](workflow://wf-b).',
        workflowReferences: [
          { workflow_id: 'wf-a', name: 'A' },
          { workflow_id: 'wf-b', name: 'B' }
        ]
      })
    )
    expect(useAgentConversationStore().entries[0]).toMatchObject({
      role: 'user',
      text: 'Copy  into .',
      workflowReferences: references
    })
  })

  it('(h4) the turn post never carries a draft field (upload retired)', async () => {
    const postMessage = vi.fn<AgentRestClient['postMessage']>(async () => ({
      thread_id: 'th-1',
      message_id: 'msg-1',
      workflow_id: 'wf-1'
    }))
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
    expect(adopted).toHaveBeenCalledWith('wf-1', undefined, null)
    expect(session.boundWorkflowId.value).toBe('wf-1')
  })

  it('(h5) a workflow.draft() snapshot is forwarded on the turn (PM-813/ecw-128)', async () => {
    const postMessage = vi.fn<AgentRestClient['postMessage']>(async () => ({
      thread_id: 'th-1',
      message_id: 'msg-1',
      workflow_id: 'wf-1'
    }))
    const rest = fakeRest({ postMessage })
    const { source } = fakeEvents()
    const draftSnapshot = {
      content: { nodes: [{ id: 1, type: 'LoadImage' }], links: [] }
    }
    const session = useAgentSession({
      rest,
      events: source,
      workflow: {
        current: () => undefined,
        adopted: vi.fn(),
        draft: () => draftSnapshot
      }
    })
    session.start()

    await session.sendMessage('what is on my canvas')

    const body = postMessage.mock.calls[0][1]
    expect(body.draft).toEqual(draftSnapshot)
  })

  it('(h6) no draft field is sent when workflow.draft() returns undefined (e.g. detached tab)', async () => {
    const postMessage = vi.fn<AgentRestClient['postMessage']>(async () => ({
      thread_id: 'th-1',
      message_id: 'msg-1',
      workflow_id: 'wf-1'
    }))
    const rest = fakeRest({ postMessage })
    const { source } = fakeEvents()
    const session = useAgentSession({
      rest,
      events: source,
      workflow: {
        current: () => undefined,
        adopted: vi.fn(),
        draft: () => undefined
      }
    })
    session.start()

    await session.sendMessage('what is on my canvas')

    expect(vi.mocked(postMessage).mock.calls[0][1]).not.toHaveProperty('draft')
  })

  // PM-1429/PM-1430: an unbound target (a tab with no cloud id yet) must be
  // flagged as such - and carry its draft, since the server mints a
  // workflow for it and an empty mint would drop whatever is already on
  // the tab's canvas. This must hold even once the thread already exists
  // (started elsewhere, or an earlier turn already exists), not only on the
  // very first "new" turn - canSendDraft's own threadId==='new' clause would
  // otherwise drop the draft here.
  it('(h9) an unbound target on an existing thread is flagged unbound and keeps its draft', async () => {
    const postMessage = vi.fn<AgentRestClient['postMessage']>(async () => ({
      thread_id: 'th-9',
      message_id: 'msg-1',
      workflow_id: 'wf-fresh'
    }))
    const rest = fakeRest({ postMessage })
    const { source } = fakeEvents()
    const conversation = useAgentConversationStore()
    const draftSnapshot = {
      content: { nodes: [{ id: 1, type: 'TextInput' }], links: [] }
    }
    const session = useAgentSession({
      rest,
      events: source,
      workflow: {
        current: () => ({ tabPath: 'workflows/scratch.json' }),
        adopted: vi.fn(),
        draft: () => draftSnapshot
      }
    })
    session.start()
    conversation.setThreadId('th-9')

    await session.sendMessage('add a text input node')

    const body = postMessage.mock.calls[0][1]
    expect(body).not.toHaveProperty('workflowId')
    expect(body.currentTabUnbound).toBe(true)
    expect(body.draft).toEqual(draftSnapshot)
  })

  // Once a workflow has been bound this session (turn 1's ack), a still-
  // unbound tab must NOT keep re-minting: the second turn falls back to
  // today's pre-existing behaviour (no signal at all) rather than asking
  // the server to mint yet another empty workflow every turn.
  it('(h10) a second turn on a still-unbound tab does not re-flag it as unbound', async () => {
    const postMessage = vi
      .fn<AgentRestClient['postMessage']>()
      .mockResolvedValueOnce({
        thread_id: 'th-9',
        message_id: 'msg-1',
        workflow_id: 'wf-fresh'
      })
      .mockResolvedValueOnce({
        thread_id: 'th-9',
        message_id: 'msg-2',
        workflow_id: 'wf-fresh'
      })
    const rest = fakeRest({ postMessage })
    const { source } = fakeEvents()
    const session = useAgentSession({
      rest,
      events: source,
      workflow: {
        current: () => ({ tabPath: 'workflows/scratch.json' }),
        adopted: vi.fn(),
        draft: () => ({ content: { nodes: [], links: [] } })
      }
    })
    session.start()

    await session.sendMessage('add a text input node')
    await session.sendMessage('and a load image node')

    expect(postMessage.mock.calls[0][1].currentTabUnbound).toBe(true)
    expect(postMessage.mock.calls[1][1]).not.toHaveProperty('currentTabUnbound')
  })

  it.for(['new-chat', 'history'])(
    'cancels preparation after switching conversation: %s',
    async (context) => {
      const rest = fakeRest()
      const { source } = fakeEvents()
      let releasePrepare = () => {}
      const prepare = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            releasePrepare = resolve
          })
      )
      const adopted = vi.fn()
      const session = useAgentSession({
        rest,
        events: source,
        workflow: {
          current: () => ({ id: 'wf-a', tabPath: 'tab-a' }),
          prepare,
          adopted
        }
      })
      session.start()
      const sending = session.sendMessage('Old draft')
      expect(prepare).toHaveBeenCalledOnce()
      if (context === 'new-chat') session.newChat()
      else await session.loadThread('th-history')
      releasePrepare()
      expect(await sending).toBe(false)
      expect(rest.postMessage).not.toHaveBeenCalled()
      expect(adopted).not.toHaveBeenCalled()
      expect(session.entries.value).toEqual([])
      expect(session.threadId.value).toBe(
        context === 'new-chat' ? null : 'th-history'
      )
      expect(session.isSending.value).toBe(false)
      session.stop()
    }
  )

  it('(h7) a tab switch while prepare() is pending does not reattribute the send to the new tab', async () => {
    const postMessage = vi.fn<AgentRestClient['postMessage']>(async () => ({
      thread_id: 'th-1',
      message_id: 'msg-1',
      workflow_id: 'wf-1'
    }))
    const rest = fakeRest({ postMessage })
    const { source } = fakeEvents()
    const adopted = vi.fn()
    let releasePrepare: () => void = () => undefined
    const prepare = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releasePrepare = resolve
        })
    )
    let activePath = 'tab-a'
    const idForPath = (path: string) => (path === 'tab-a' ? 'wf-a' : 'wf-b')
    const session = useAgentSession({
      rest,
      events: source,
      workflow: {
        // Mirrors the real deps: honor an explicit origin (resolved
        // post-prepare) and fall back to whatever tab is active right now
        // when called with no argument (the pre-await identity capture).
        current: (origin) => {
          const path = pathFor(origin, activePath)
          return path === undefined
            ? undefined
            : { id: idForPath(path), tabPath: path }
        },
        adopted,
        prepare,
        tabs: (origin) => {
          const path = pathFor(origin, activePath)
          return {
            open_tabs: [{ workflow_id: 'wf-a', name: 'tab-a' }],
            current_tab: path === undefined ? undefined : idForPath(path)
          }
        }
      }
    })
    session.start()

    const sendPromise = session.sendMessage('hello')
    // Simulate the user switching tabs while prepare() is still in flight.
    activePath = 'tab-b'
    releasePrepare()
    await sendPromise

    expect(adopted).toHaveBeenCalledWith(
      'wf-1',
      {
        id: 'wf-a',
        tabPath: 'tab-a'
      },
      null
    )
    expect(vi.mocked(postMessage).mock.calls[0][1]).toMatchObject({
      workflowId: 'wf-a',
      tabs: { current_tab: 'wf-a' }
    })
  })

  it('(h8) the draft snapshot follows the originating tab, not the tab switched to during prepare()', async () => {
    const postMessage = vi.fn<AgentRestClient['postMessage']>(async () => ({
      thread_id: 'th-1',
      message_id: 'msg-1',
      workflow_id: 'wf-1'
    }))
    const rest = fakeRest({ postMessage })
    const { source } = fakeEvents()
    let releasePrepare: () => void = () => undefined
    const prepare = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releasePrepare = resolve
        })
    )
    let activePath = 'tab-a'
    const idForPath = (path: string) => (path === 'tab-a' ? 'wf-a' : 'wf-b')
    const session = useAgentSession({
      rest,
      events: source,
      workflow: {
        current: (origin) => {
          const path = pathFor(origin, activePath)
          return path === undefined
            ? undefined
            : { id: idForPath(path), tabPath: path }
        },
        adopted: vi.fn(),
        prepare,
        // The draft is read on the same post-await leg as current()/tabs(), so
        // it has to honor the same pinned identity or the turn ships one tab's
        // canvas under another tab's workflow id.
        draft: (origin) => {
          const path = pathFor(origin, activePath)
          return path === undefined
            ? undefined
            : { content: { nodes: [{ id: 1, type: path }], links: [] } }
        }
      }
    })
    session.start()

    const sendPromise = session.sendMessage('what is on my canvas')
    activePath = 'tab-b'
    releasePrepare()
    await sendPromise

    expect(vi.mocked(postMessage).mock.calls[0][1]).toMatchObject({
      workflowId: 'wf-a',
      draft: { content: { nodes: [{ id: 1, type: 'tab-a' }], links: [] } }
    })
  })

  it('(h9) a send that starts with no origin tab is not reattributed to a tab attached during prepare()', async () => {
    const postMessage = vi.fn<AgentRestClient['postMessage']>(async () => ({
      thread_id: 'th-1',
      message_id: 'msg-1',
      workflow_id: 'wf-b'
    }))
    const rest = fakeRest({ postMessage })
    const { source } = fakeEvents()
    const adopted = vi.fn()
    let releasePrepare: () => void = () => undefined
    const prepare = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releasePrepare = resolve
        })
    )
    // The panel is detached when the user hits send, so there is no origin
    // tab: activeWorkflowTurnContext() returns undefined for every lookup
    // while `detached` holds, exactly like the real deps.
    let detached = true
    let activePath: string | undefined = undefined
    const resolve = (origin: TurnOrigin | undefined) =>
      detached ? undefined : pathFor(origin, activePath)
    const session = useAgentSession({
      rest,
      events: source,
      workflow: {
        current: (origin) => {
          const path = resolve(origin)
          return path === undefined ? undefined : { id: 'wf-b', tabPath: path }
        },
        adopted,
        prepare,
        tabs: (origin) => {
          const path = resolve(origin)
          return {
            open_tabs: [{ workflow_id: 'wf-b', name: 'tab-b' }],
            current_tab: path === undefined ? undefined : 'wf-b'
          }
        },
        draft: (origin) => {
          const path = resolve(origin)
          return path === undefined
            ? undefined
            : { content: { nodes: [{ id: 1, type: path }], links: [] } }
        }
      }
    })
    session.start()

    const sendPromise = session.sendMessage('hello')
    // The user re-attaches (onSelectTab clears workflowDetached) and selects
    // tab-b while prepare() is still in flight.
    detached = false
    activePath = 'tab-b'
    releasePrepare()
    await sendPromise

    const sent = vi.mocked(postMessage).mock.calls[0][1]
    expect(sent).not.toHaveProperty('workflowId')
    expect(sent).not.toHaveProperty('draft')
    expect(sent.tabs?.current_tab).toBeUndefined()
    // open_tabs is context, not attribution, so it still travels.
    expect(sent.tabs?.open_tabs).toEqual([
      { workflow_id: 'wf-b', name: 'tab-b' }
    ])
    // The ack echoes wf-b; with no origin tab there is nothing to bind it to.
    expect(adopted).toHaveBeenCalledWith('wf-b', undefined, null)
  })

  it('(h6) a bind landing in the prepare()/POST window makes an echoed id read as an echo', async () => {
    // Regression for the r3929083595 race: priorWorkflowId was snapshotted
    // before prepare(), so a bindWorkflow() landing in that window (a late
    // agent_active_tab frame, loadThread, an overlapping send) left the guard
    // comparing the echoed id against a stale pre-turn binding and
    // re-binding the origin tab to a workflow the mid-turn event had already
    // bound elsewhere.
    const postMessage = vi.fn<AgentRestClient['postMessage']>(
      () =>
        new Promise<AgentTurnAccepted>((resolve) =>
          resolve({
            thread_id: 'th-1',
            message_id: 'msg-1',
            workflow_id: 'wf-x'
          })
        )
    )
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

    const sendPromise = session.sendMessage('hello')
    // The mid-turn bind establishes the thread's existing workflow while the
    // POST is in flight; the ack then echoes exactly that id.
    session.bindWorkflow('wf-x')
    await sendPromise

    // An echo of the current binding is not a mint: no re-adoption.
    expect(adopted).not.toHaveBeenCalled()
    expect(session.boundWorkflowId.value).toBe('wf-x')
  })

  it('(h10) reload does not adopt a resumed thread workflow onto an unsaved tab', async () => {
    useAgentWorkflowTabBindingStore().bind(
      'wf-existing',
      'workflows/existing.json'
    )
    await nextTick()
    useAgentWorkflowTabBindingStore().$dispose()
    localStorage.setItem(StorageKeys.agentThread('personal'), 'th-existing')

    const postMessage = vi.fn<AgentRestClient['postMessage']>(async () => ({
      thread_id: 'th-existing',
      message_id: 'msg-1',
      workflow_id: 'wf-existing'
    }))
    const getMessages = vi.fn<AgentRestClient['getMessages']>(async () => [])
    const adopted = vi.fn()
    const session = useAgentSession({
      rest: fakeRest({ postMessage, getMessages }),
      events: fakeEvents().source,
      workflow: {
        current: () => ({ tabPath: 'workflows/scratch.json' }),
        adopted
      }
    })
    session.start()
    await vi.waitFor(() =>
      expect(getMessages).toHaveBeenCalledWith('th-existing')
    )
    await session.loadThread('th-existing')

    expect(session.boundWorkflowId.value).toBeNull()
    await session.sendMessage('resume here')

    expect(postMessage).toHaveBeenCalledWith(
      'th-existing',
      expect.not.objectContaining({ workflowId: expect.anything() })
    )
    expect(adopted).not.toHaveBeenCalled()
    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-existing')).toBe(
      'workflows/existing.json'
    )
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

  // FE-2501: the tab -> workflow binding is persisted, so a workflow the
  // backend refuses to serve poisons its tab for good - every later turn from
  // that tab re-posts the same dead id, and a reload re-affirms the binding
  // from the thread's own workflow pointer. Only the workflow-scoped refusal
  // releases the binding; the thread-scoped one names a different resource.
  it.for([
    { refusal: 'workflow not found or access denied', released: true },
    { refusal: 'thread not found or access denied', released: false }
  ])('(k2) 403 $refusal releases the binding: $released', async (scenario) => {
    const tabPath = 'workflows/portrait.json'
    useAgentWorkflowTabBindingStore().bind('wf-dead', tabPath)
    const postMessage = vi
      .fn<AgentRestClient['postMessage']>()
      .mockRejectedValue(
        new AgentApiError(scenario.refusal, 403, { error: scenario.refusal })
      )
    const session = useAgentSession({
      rest: fakeRest({ postMessage }),
      events: fakeEvents().source,
      workflow: {
        current: () => ({ id: 'wf-dead', tabPath }),
        adopted: vi.fn()
      }
    })
    session.start()
    session.bindWorkflow('wf-dead')

    expect(await session.sendMessage('run it')).toBe(false)

    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-dead')).toBe(
      scenario.released ? undefined : tabPath
    )
    expect(session.boundWorkflowId.value).toBe(
      scenario.released ? null : 'wf-dead'
    )
    expect(session.entries.value.at(-1)).toMatchObject({
      role: 'assistant',
      parts: [
        {
          type: 'notice',
          level: 'error',
          text: `Message failed to send: ${scenario.refusal}`
        }
      ]
    })
  })

  // The refusal names a workflow, so the release must be keyed by that id.
  // `agent_active_tab`, reference navigation and commitWorkflowTarget all
  // rebind the same tab path mid-flight without bumping the send generation,
  // and a path-keyed release would delete whichever binding won that race.
  it('(k3) a late refusal does not disturb a binding the tab was rebound to', async () => {
    const tabPath = 'workflows/portrait.json'
    const bindings = useAgentWorkflowTabBindingStore()
    bindings.bind('wf-dead', tabPath)
    const postMessage = vi.fn<AgentRestClient['postMessage']>(async () => {
      bindings.bind('wf-live', tabPath)
      throw new AgentApiError('workflow not found or access denied', 403, {
        error: 'workflow not found or access denied'
      })
    })
    const session = useAgentSession({
      rest: fakeRest({ postMessage }),
      events: fakeEvents().source,
      workflow: {
        current: () => ({ id: 'wf-dead', tabPath }),
        adopted: vi.fn()
      }
    })
    session.start()
    session.bindWorkflow('wf-dead')

    expect(await session.sendMessage('run it')).toBe(false)

    expect(bindings.tabPathFor('wf-dead')).toBeUndefined()
    expect(bindings.tabPathFor('wf-live')).toBe(tabPath)
    expect(bindings.workflowIdFor(tabPath)).toBe('wf-live')
  })

  // The binding store is page-global and persisted, so it outlives the send
  // generation. A refusal that lands after newChat()/loadThread() has moved on
  // must still release, or the dead id survives exactly as before the fix.
  it('(k4) releases the binding even when the send generation moved on', async () => {
    const tabPath = 'workflows/portrait.json'
    const bindings = useAgentWorkflowTabBindingStore()
    bindings.bind('wf-dead', tabPath)
    const disowned = vi.fn()
    let abandon: () => void = () => {}
    const postMessage = vi.fn<AgentRestClient['postMessage']>(async () => {
      abandon()
      throw new AgentApiError('workflow not found or access denied', 403, {
        error: 'workflow not found or access denied'
      })
    })
    const session = useAgentSession({
      rest: fakeRest({ postMessage }),
      events: fakeEvents().source,
      workflow: {
        current: () => ({ id: 'wf-dead', tabPath }),
        adopted: vi.fn(),
        disowned
      }
    })
    session.start()
    session.bindWorkflow('wf-dead')
    abandon = () => session.newChat()

    expect(await session.sendMessage('run it')).toBe(false)

    expect(bindings.tabPathFor('wf-dead')).toBeUndefined()
    // The resolver prefers its name-derived cloud index over the binding
    // store, so the refused id has to leave that index too.
    expect(disowned).toHaveBeenCalledWith('wf-dead')
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

  it('(l8) a background turn that finished during a socket drop is settled from REST on reconnect', async () => {
    const getMessages = vi.fn(
      async (threadId: string): Promise<AgentMessages> =>
        threadId === 'th-1'
          ? [
              historyRow(1, 'user', 'msg-1', 'go'),
              historyRow(2, 'assistant', 'msg-1', 'from server', 'msg-1')
            ]
          : []
    )
    const rest = fakeRest({ getMessages })
    const { source, emit, status } = fakeEvents()
    const session = useAgentSession({ rest, events: source })
    session.start()
    status(true)

    await session.sendMessage('go')
    emit(delta('msg-1', 'partial'))
    await session.loadThread('th-2')
    const getsBefore = getMessages.mock.calls.length

    status(false)
    status(true)
    await vi.waitFor(() =>
      expect(
        getMessages.mock.calls.slice(getsBefore).map(([threadId]) => threadId)
      ).toEqual(['th-1'])
    )

    await session.loadThread('th-1')
    expect(session.isStreaming.value).toBe(false)
    expect(session.entries.value.map((e) => e.role)).toEqual([
      'user',
      'assistant'
    ])
    const assistant = session.entries.value.at(-1)
    assert(assistant?.role === 'assistant')
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
    expect(localStorage.getItem(StorageKeys.agentThread('personal'))).toBe(
      'th-1'
    )

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

  beforeEach(() => {
    localStorage.clear()
  })

  it('restores the persisted thread and hydrates its transcript on start', async () => {
    localStorage.setItem(StorageKeys.agentThread('personal'), 'th-9')
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

  it('reconciles a hydrated streaming turn without waiting for a socket transition', async () => {
    localStorage.setItem(StorageKeys.agentThread('personal'), 'th-9')
    const streaming = HISTORY.map((row) =>
      row.role === 'assistant'
        ? { ...row, status: 'streaming' as const, content: {} }
        : row
    )
    const getMessages = vi
      .fn<() => Promise<AgentMessages>>()
      .mockResolvedValueOnce(streaming)
      .mockResolvedValueOnce(HISTORY)
    const session = useAgentSession({
      rest: fakeRest({ getMessages }),
      events: fakeEvents().source
    })

    session.start()

    await vi.waitFor(() => expect(getMessages).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(session.isStreaming.value).toBe(false))
    expect(session.entries.value.at(-1)).toMatchObject({
      role: 'assistant',
      parts: [{ type: 'text', text: 'Duck workflow ready.' }]
    })
  })

  it('forgets a stale persisted thread on 404 without surfacing an error', async () => {
    localStorage.setItem(StorageKeys.agentThread('personal'), 'th-gone')
    const onThreadActivated = vi.fn()
    const getMessages = vi.fn(async (): Promise<AgentMessages> => {
      throw new AgentApiError('not found', 404, null)
    })
    const session = useAgentSession({
      rest: fakeRest({ getMessages }),
      events: fakeEvents().source,
      onThreadActivated
    })
    session.start()
    await vi.waitFor(() =>
      expect(
        localStorage.getItem(StorageKeys.agentThread('personal'))
      ).toBeNull()
    )
    expect(session.threadId.value).toBeNull()
    expect(session.entries.value).toHaveLength(0)
    expect(session.notices.value).toHaveLength(0)
    await vi.waitFor(() =>
      expect(onThreadActivated).toHaveBeenLastCalledWith(null)
    )
  })

  it('persists the thread on send and clears it on newChat', async () => {
    const session = useAgentSession({
      rest: fakeRest(),
      events: fakeEvents().source
    })
    session.start()
    await session.sendMessage('hello')
    expect(localStorage.getItem(StorageKeys.agentThread('personal'))).toBe(
      'th-1'
    )

    session.newChat()
    expect(localStorage.getItem(StorageKeys.agentThread('personal'))).toBeNull()
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
    expect(localStorage.getItem(StorageKeys.agentThread('personal'))).toBe(
      'th-9'
    )
    await vi.waitFor(() => expect(session.entries.value).toHaveLength(2))
    expect(session.entries.value[0]).toMatchObject({
      role: 'user',
      text: 'build a duck'
    })
  })

  it('ignores an unscoped thread from an unknown account', () => {
    localStorage.setItem('Comfy.Agent.ThreadId', 'th-other-account')
    const getMessages = vi.fn(async (): Promise<AgentMessages> => HISTORY)
    const session = useAgentSession({
      rest: fakeRest({ getMessages }),
      events: fakeEvents().source
    })

    session.start()

    expect(getMessages).not.toHaveBeenCalled()
    expect(session.threadId.value).toBeNull()
    expect(localStorage.getItem('Comfy.Agent.ThreadId')).toBeNull()
  })

  it('restores only the active team workspace thread', async () => {
    sessionStorage.setItem(
      'Comfy.Workspace.Current',
      JSON.stringify({ type: 'team', id: 'workspace-b' })
    )
    localStorage.setItem(StorageKeys.agentThread('workspace-a'), 'th-a')
    localStorage.setItem(StorageKeys.agentThread('workspace-b'), 'th-b')
    const getMessages = vi.fn(async (): Promise<AgentMessages> => HISTORY)
    const session = useAgentSession({
      rest: fakeRest({ getMessages }),
      events: fakeEvents().source
    })

    session.start()

    await vi.waitFor(() => expect(getMessages).toHaveBeenCalledWith('th-b'))
    expect(session.threadId.value).toBe('th-b')
    expect(localStorage.getItem(StorageKeys.agentThread('workspace-a'))).toBe(
      'th-a'
    )
  })

  it('invalidates an in-flight workflow restoration when starting a new chat', async () => {
    let finishRestore = () => {}
    let stillCurrent = () => true
    const restored = vi.fn(
      async (_id: string | undefined, isCurrent: () => boolean) => {
        stillCurrent = isCurrent
        await new Promise<void>((resolve) => {
          finishRestore = resolve
        })
        return true
      }
    )
    const session = useAgentSession({
      rest: fakeRest({
        getMessages: vi.fn(async () => [
          historyRow(1, 'user', 'turn-a', 'Prompt')
        ])
      }),
      events: fakeEvents().source,
      workflow: { current: () => undefined, adopted: vi.fn(), restored }
    })
    session.start()
    const first = session.loadThread('first')
    await vi.waitFor(() => expect(restored).toHaveBeenCalledOnce())
    expect(stillCurrent()).toBe(true)
    session.newChat()
    expect(stillCurrent()).toBe(false)
    finishRestore()
    await first
  })

  it('keeps the first restoration stale when a later thread finishes loading', async () => {
    let releaseFirst = () => {}
    let firstIsCurrent = () => true
    const restored = vi
      .fn(async (_id: string | undefined, _isCurrent: () => boolean) => true)
      .mockImplementationOnce(
        async (_id: string | undefined, isCurrent: () => boolean) => {
          firstIsCurrent = isCurrent
          await new Promise<void>((resolve) => {
            releaseFirst = resolve
          })
          return true
        }
      )
    const session = useAgentSession({
      rest: fakeRest({
        getMessages: vi.fn(async () => [
          historyRow(1, 'user', 'turn', 'Prompt')
        ])
      }),
      events: fakeEvents().source,
      workflow: { current: () => undefined, adopted: vi.fn(), restored }
    })
    session.start()
    const first = session.loadThread('first')
    await vi.waitFor(() => expect(restored).toHaveBeenCalledOnce())
    await session.loadThread('second')
    expect(firstIsCurrent()).toBe(false)
    releaseFirst()
    await first
    expect(session.threadId.value).toBe('second')
  })

  it('restores the target from the latest persisted user message', async () => {
    const older = historyRow(1, 'user', 'turn-a', 'First')
    older.workflow_id = 'wf-a'
    const latest = historyRow(3, 'user', 'turn-b', 'Second')
    latest.workflow_id = 'wf-b'
    const restored = vi.fn()
    const session = useAgentSession({
      rest: fakeRest({
        getMessages: vi.fn(
          async (): Promise<AgentMessages> => [
            latest,
            historyRow(2, 'assistant', 'turn-a', 'Done'),
            older
          ]
        )
      }),
      events: fakeEvents().source,
      workflow: {
        current: () => undefined,
        adopted: vi.fn(),
        restored
      }
    })
    session.start()

    await session.loadThread('th-9')

    expect(restored).toHaveBeenCalledWith('wf-b', expect.any(Function))
  })

  it('reports an unsuccessful history selection when its workflow cannot open', async () => {
    const session = useAgentSession({
      rest: fakeRest({
        getMessages: vi.fn(async () => [
          historyRow(1, 'user', 'turn', 'Prompt')
        ])
      }),
      events: fakeEvents().source,
      workflow: {
        current: () => undefined,
        adopted: vi.fn(),
        restored: async () => false
      }
    })
    session.start()

    expect(await session.loadThread('th-history')).toBe(false)
  })

  it('listThreads returns the REST client thread list', async () => {
    const listThreads = vi.fn(
      async (): Promise<AgentThreadSummary[]> => [
        {
          created_at: '2026-07-07T00:00:00Z',
          id: 'th-9',
          last_message_at: '2026-07-07T00:00:00Z',
          message_count: 2,
          preview: 'build a duck',
          status: 'active',
          title: 'build a duck',
          updated_at: '2026-07-07T00:00:00Z',
          workflow_id: 'wf-9'
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

describe('app:agent_error telemetry (TEL-8)', () => {
  beforeEach(() => {
    localStorage.clear()
    telemetry.trackAgentError.mockClear()
    vi.mocked(reportError).mockClear()
  })

  it('reports unexpected agent failures to the unified error sinks', async () => {
    const { source, emit } = fakeEvents()
    const session = useAgentSession({
      rest: fakeRest({
        getMessages: vi.fn(async () => {
          throw new Error('history boom')
        }),
        cancelMessage: vi.fn(async () => {
          throw new AgentApiError('cancel boom', 500, null)
        })
      }),
      events: source
    })
    session.start()
    await session.loadThread('th-9')
    await session.sendMessage('go')
    await session.stopTurn()
    emit({ type: 'agent_message_done', data: { thread_id: 'th-1' } })

    const errorTypes = vi
      .mocked(reportError)
      .mock.calls.map(([, options]) => options.errorType)
    expect(errorTypes).toEqual([
      'agent_history_load_failed',
      'agent_cancel_turn_failed',
      'agent_malformed_stream_event'
    ])
  })

  it('dedupes interleaved malformed frames per turn in A-B-A order', async () => {
    const postMessage = vi
      .fn<
        (threadId: string, req: PostMessageInput) => Promise<AgentTurnAccepted>
      >()
      .mockResolvedValueOnce({ thread_id: 'th-1', message_id: 'msg-1' })
      .mockResolvedValueOnce({ thread_id: 'th-2', message_id: 'msg-2' })
    const { source, emit } = fakeEvents()
    const session = useAgentSession({
      rest: fakeRest({ postMessage }),
      events: source
    })
    session.start()
    await session.sendMessage('first')
    await session.loadThread('th-2')
    await session.sendMessage('second')
    telemetry.trackAgentError.mockClear()

    emit({ type: 'agent_message_delta', data: { message_id: 'msg-2' } })
    emit({ type: 'agent_message_delta', data: { message_id: 'msg-1' } })
    emit({ type: 'agent_message_delta', data: { message_id: 'msg-2' } })

    expect(telemetry.trackAgentError).toHaveBeenCalledTimes(2)
  })

  it('reports idle malformed frames again after switching threads', async () => {
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest: fakeRest(), events: source })
    session.start()

    emit({ type: 'agent_message_done', data: { thread_id: 'th-1' } })
    await session.loadThread('th-2')
    emit({ type: 'agent_message_done', data: { thread_id: 'th-2' } })

    expect(telemetry.trackAgentError).toHaveBeenCalledTimes(2)
  })

  it('groups malformed frames under one Sentry issue, detail in context', async () => {
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest: fakeRest(), events: source })
    session.start()

    emit({ type: 'agent_message_done', data: { thread_id: 'th-1' } })

    const [error, options] = vi.mocked(reportError).mock.calls[0]
    expect((error as Error).message).toBe('Malformed agent stream event')
    expect(options.tags?.event_type).toBe('agent_message_done')
    expect(options.context?.issues).toEqual(expect.any(Array))
  })

  it('reports a rejected send to the unified error sinks', async () => {
    const rest = fakeRest({
      postMessage: vi.fn(async () => {
        throw new AgentApiError('boom', 500, null)
      })
    })
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()

    await session.sendMessage('make me a cat')

    expect(reportError).toHaveBeenCalledWith(expect.any(AgentApiError), {
      surface: 'agent',
      errorType: 'agent_send_message_failed'
    })
  })

  it('keeps the expected 404 history and 409 cancel races out of the sinks', async () => {
    const session = useAgentSession({
      rest: fakeRest({
        getMessages: vi.fn(async () => {
          throw new AgentApiError('gone', 404, null)
        }),
        cancelMessage: vi.fn(async () => {
          throw new AgentApiError('already done', 409, null)
        })
      }),
      events: fakeEvents().source
    })
    session.start()
    await session.loadThread('th-gone')
    await session.sendMessage('go')
    await session.stopTurn()

    expect(reportError).not.toHaveBeenCalled()
  })

  it('tracks a pre-acceptance request failure from a rejected postMessage', async () => {
    const rest = fakeRest({
      postMessage: vi.fn(async () => {
        throw new AgentApiError('boom', 500, null)
      })
    })
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()

    const ok = await session.sendMessage('make me a cat')

    expect(ok).toBe(false)
    expect(telemetry.trackAgentError).toHaveBeenCalledWith({
      error_class: 'request_failed',
      failure_stage: 'pre_acceptance',
      retryable: true,
      turn_accepted: false,
      ui_treatment: 'inline_notice'
    })
  })

  it('marks a deterministic send rejection unretryable', async () => {
    const rest = fakeRest({
      postMessage: vi.fn(async () => {
        throw new AgentApiError('unprocessable', 422, null)
      })
    })
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()

    await session.sendMessage('make me a cat')

    expect(telemetry.trackAgentError).toHaveBeenCalledWith({
      error_class: 'request_failed',
      failure_stage: 'pre_acceptance',
      retryable: false,
      turn_accepted: false,
      ui_treatment: 'inline_notice'
    })
  })

  it('classifies a failure after the ack as post-acceptance and unretryable', async () => {
    const rest = fakeRest()
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()
    const setItem = vi
      .spyOn(globalThis.localStorage, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError')
      })

    try {
      const ok = await session.sendMessage('make me a cat')
      expect(ok).toBe(false)
    } finally {
      setItem.mockRestore()
    }

    expect(rest.postMessage).toHaveBeenCalledTimes(1)
    expect(telemetry.trackAgentError).toHaveBeenCalledWith({
      error_class: 'request_failed',
      failure_stage: 'post_acceptance',
      retryable: false,
      turn_accepted: true,
      ui_treatment: 'inline_notice'
    })
  })

  it('treats an unreadable ack body as an accepted turn', async () => {
    const rest = fakeRest({
      postMessage: vi.fn(async () => {
        // What a 2xx with an unexpected body raises past `response.ok`.
        return zAgentTurnAccepted.parse({ thread_id: 'th-1' })
      })
    })
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()

    await session.sendMessage('make me a cat')

    expect(telemetry.trackAgentError).toHaveBeenCalledWith({
      error_class: 'request_failed',
      failure_stage: 'post_acceptance',
      retryable: false,
      turn_accepted: true,
      ui_treatment: 'inline_notice'
    })
  })

  it('treats an ack body the client could not read as an accepted turn', async () => {
    const rest = fakeRest({
      postMessage: vi.fn(async () => {
        throw new AgentResponseUnreadableError(
          '/agent/threads/new/messages',
          new SyntaxError('Unexpected end of JSON input')
        )
      })
    })
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()

    await session.sendMessage('make me a cat')

    expect(telemetry.trackAgentError).toHaveBeenCalledWith({
      error_class: 'request_failed',
      failure_stage: 'post_acceptance',
      retryable: false,
      turn_accepted: true,
      ui_treatment: 'inline_notice'
    })
  })

  it('reports a stashed live turn when the resume history load fails', async () => {
    const getMessages = vi
      .fn<AgentRestClient['getMessages']>()
      .mockRejectedValue(new Error('history boom'))
    const session = useAgentSession({
      rest: fakeRest({ getMessages }),
      events: fakeEvents().source
    })
    session.start()
    await session.sendMessage('go')
    expect(useAgentConversationStore().activeTurnId).not.toBeNull()

    await session.loadThread('th-other')

    expect(telemetry.trackAgentError).toHaveBeenCalledWith({
      error_class: 'history_load_failed',
      failure_stage: 'pre_acceptance',
      retryable: true,
      turn_accepted: true,
      ui_treatment: 'error_overlay'
    })
  })

  it('does not count a busy-state double-submit as an agent error', async () => {
    let resolvePost: (value: AgentTurnAccepted) => void = () => undefined
    const rest = fakeRest({
      postMessage: vi.fn(
        () =>
          new Promise<AgentTurnAccepted>((resolve) => {
            resolvePost = resolve
          })
      )
    })
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()

    const first = session.sendMessage('first')
    const ok = await session.sendMessage('second')

    expect(ok).toBe(false)
    expect(telemetry.trackAgentError).not.toHaveBeenCalled()
    resolvePost({ thread_id: 'th-1', message_id: 'msg-1' })
    await first
  })

  it('tracks a post-acceptance cancel failure', async () => {
    const rest = fakeRest({
      cancelMessage: vi.fn(async () => {
        throw new AgentApiError('cancel boom', 500, null)
      })
    })
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()
    await session.sendMessage('go')

    await session.stopTurn()

    expect(telemetry.trackAgentError).toHaveBeenCalledWith({
      error_class: 'cancel_failed',
      failure_stage: 'post_acceptance',
      retryable: true,
      turn_accepted: true,
      ui_treatment: 'error_overlay'
    })
  })

  it('does not track a 409 cancel race as an error', async () => {
    const rest = fakeRest({
      cancelMessage: vi.fn(async () => {
        throw new AgentApiError('already done', 409, null)
      })
    })
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()
    await session.sendMessage('go')

    await session.stopTurn()

    expect(telemetry.trackAgentError).not.toHaveBeenCalled()
  })

  it('tracks a post-acceptance malformed stream event for the active turn', async () => {
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest: fakeRest(), events: source })
    session.start()
    await session.sendMessage('go')

    emit({ type: 'agent_message_done', data: { thread_id: 'th-1' } })

    expect(telemetry.trackAgentError).toHaveBeenCalledWith({
      error_class: 'malformed_stream_event',
      failure_stage: 'post_acceptance',
      retryable: false,
      turn_accepted: true,
      ui_treatment: 'error_overlay'
    })
  })

  it('does not claim an accepted turn for a malformed frame on an idle session', async () => {
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest: fakeRest(), events: source })
    session.start()

    emit({ type: 'agent_message_done', data: { thread_id: 'th-1' } })

    expect(telemetry.trackAgentError).toHaveBeenCalledWith({
      error_class: 'malformed_stream_event',
      failure_stage: 'pre_acceptance',
      retryable: false,
      turn_accepted: false,
      ui_treatment: 'error_overlay'
    })
  })

  it('bounds a repeating malformed stream to one report per turn', async () => {
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest: fakeRest(), events: source })
    session.start()
    await session.sendMessage('go')

    for (let i = 0; i < 20; i++)
      emit({ type: 'agent_message_done', data: { thread_id: 'th-1' } })

    // The aborted turn, then the idle session the other nineteen arrived into.
    expect(telemetry.trackAgentError).toHaveBeenCalledTimes(2)
  })

  it('tracks malformed frames of event types that never reach the user', async () => {
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest: fakeRest(), events: source })
    session.start()
    await session.sendMessage('go')

    emit({ type: 'agent_message_delta', data: { thread_id: 'th-1' } })

    expect(telemetry.trackAgentError).toHaveBeenCalledWith({
      error_class: 'malformed_stream_event',
      failure_stage: 'post_acceptance',
      retryable: false,
      turn_accepted: true,
      ui_treatment: 'none'
    })
    expect(session.notices.value).toEqual([])
  })

  it('still reports the frame that escalates to the user after a silent one', async () => {
    const { source, emit } = fakeEvents()
    const session = useAgentSession({ rest: fakeRest(), events: source })
    session.start()
    await session.sendMessage('go')

    emit({ type: 'agent_message_delta', data: { thread_id: 'th-1' } })
    emit({ type: 'agent_message_done', data: { thread_id: 'th-1' } })

    expect(telemetry.trackAgentError).toHaveBeenCalledTimes(2)
    expect(telemetry.trackAgentError).toHaveBeenLastCalledWith({
      error_class: 'malformed_stream_event',
      failure_stage: 'post_acceptance',
      retryable: false,
      turn_accepted: true,
      ui_treatment: 'error_overlay'
    })
  })

  it('tracks a pre-acceptance thread-history load failure', async () => {
    const rest = fakeRest({
      getMessages: vi.fn(async () => {
        throw new Error('history boom')
      })
    })
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()

    await session.loadThread('th-9')

    expect(telemetry.trackAgentError).toHaveBeenCalledWith({
      error_class: 'history_load_failed',
      failure_stage: 'pre_acceptance',
      retryable: true,
      turn_accepted: false,
      ui_treatment: 'error_overlay'
    })
  })

  it('tracks a failed ask answer, which leaves the running turn blocked', async () => {
    const answerAsk = vi
      .fn<AgentRestClient['answerAsk']>()
      .mockRejectedValue(new AgentApiError('ask boom', 500, null))
    const { source, emit } = fakeEvents()
    const session = useAgentSession({
      rest: fakeRest({ answerAsk }),
      events: source
    })
    session.start()
    await session.sendMessage('build it')
    emit(runApproval('msg-1'))
    telemetry.trackAgentError.mockClear()

    await session.answerAsk('turn-1:call-1', 'run')

    expect(telemetry.trackAgentError).toHaveBeenCalledWith({
      error_class: 'ask_answer_failed',
      failure_stage: 'post_acceptance',
      retryable: true,
      turn_accepted: true,
      ui_treatment: 'error_overlay'
    })
  })

  it('does not track a 409 stale ask answer as an error', async () => {
    const answerAsk = vi
      .fn<AgentRestClient['answerAsk']>()
      .mockRejectedValue(new AgentApiError('already answered', 409, undefined))
    const { source, emit } = fakeEvents()
    const session = useAgentSession({
      rest: fakeRest({ answerAsk }),
      events: source
    })
    session.start()
    await session.sendMessage('build it')
    emit(runApproval('msg-1'))
    telemetry.trackAgentError.mockClear()

    await session.answerAsk('turn-1:call-1', 'cancel')

    expect(telemetry.trackAgentError).not.toHaveBeenCalled()
  })

  it('marks a 403 ask-answer failure as non-retryable', async () => {
    const answerAsk = vi
      .fn<AgentRestClient['answerAsk']>()
      .mockRejectedValue(new AgentApiError('forbidden', 403, undefined))
    const { source, emit } = fakeEvents()
    const session = useAgentSession({
      rest: fakeRest({ answerAsk }),
      events: source
    })
    session.start()
    await session.sendMessage('build it')
    emit(runApproval('msg-1'))
    telemetry.trackAgentError.mockClear()

    await session.answerAsk('turn-1:call-1', 'run')

    expect(telemetry.trackAgentError).toHaveBeenCalledWith({
      error_class: 'ask_answer_failed',
      failure_stage: 'post_acceptance',
      retryable: false,
      turn_accepted: true,
      ui_treatment: 'error_overlay'
    })
  })

  it('derives history-load retryability from the status, as request_failed does', async () => {
    const rest = fakeRest({
      getMessages: vi.fn(async () => {
        throw new AgentApiError('access denied', 403, null)
      })
    })
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()

    await session.loadThread('th-9')

    expect(telemetry.trackAgentError).toHaveBeenCalledWith({
      error_class: 'history_load_failed',
      failure_stage: 'pre_acceptance',
      retryable: false,
      turn_accepted: false,
      ui_treatment: 'error_overlay'
    })
  })

  it('does not track a 404 thread-not-found history load as an error', async () => {
    const rest = fakeRest({
      getMessages: vi.fn(async () => {
        throw new AgentApiError('gone', 404, null)
      })
    })
    const session = useAgentSession({ rest, events: fakeEvents().source })
    session.start()

    await session.loadThread('th-gone')

    expect(telemetry.trackAgentError).not.toHaveBeenCalled()
    expect(localStorage.getItem('Comfy.Agent.ThreadId')).toBeNull()
  })
})
