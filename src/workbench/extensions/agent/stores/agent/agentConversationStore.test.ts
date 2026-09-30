import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref, watch } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'

import type { AgentMessages, TurnId } from '../../schemas/agentApiSchema'
import { zAgentMessages, zAgentWsEvent } from '../../schemas/agentApiSchema'
import type { AgentChatEvent } from '../../services/agent/agentEventTransport'

import { useAgentConversationStore } from './agentConversationStore'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const chat = (raw: unknown): AgentChatEvent => zAgentWsEvent.parse(raw)
const thinking = (id: string, delta: string): AgentChatEvent =>
  chat({
    type: 'agent_thinking',
    data: { delta, message_id: id, thread_id: 'th' }
  })
const delta = (id: string, text: string): AgentChatEvent =>
  chat({
    type: 'agent_message_delta',
    data: { delta: text, message_id: id, thread_id: 'th' }
  })
const toolCall = (id: string, name: string, status: string): AgentChatEvent =>
  chat({
    type: 'agent_tool_call',
    data: {
      tool_call_id: `call-${name}`,
      tool_name: name,
      status,
      message_id: id,
      thread_id: 'th'
    }
  })
const done = (id: string): AgentChatEvent =>
  chat({
    type: 'agent_message_done',
    data: { message_id: id, thread_id: 'th', usage: null }
  })
const runApproval = (
  id: string,
  askId: string,
  overrides: Record<string, unknown> = {}
): AgentChatEvent =>
  chat({
    type: 'agent_ask',
    data: {
      message_id: id,
      thread_id: 'th',
      ask_id: askId,
      kind: 'run_approval',
      prompt: 'Run workflow?',
      options: [
        { id: 'run', label: 'Run' },
        { id: 'cancel', label: 'Cancel' }
      ],
      min_selections: 1,
      max_selections: 1,
      allow_other: false,
      ...overrides
    }
  })
const askResolved = (id: string, askId: string): AgentChatEvent =>
  chat({
    type: 'agent_ask_resolved',
    data: {
      message_id: id,
      thread_id: 'th',
      ask_id: askId,
      status: 'answered',
      selected: ['run']
    }
  })

const T1 = 't1' as TurnId
const T2 = 't2' as TurnId

const historyRow = (
  seq: number,
  role: 'user' | 'assistant',
  turnId: string,
  text: string,
  id: string = `row-${seq}`
): AgentMessages[number] => ({
  id,
  thread_id: 'th',
  seq,
  role,
  status: 'complete',
  turn_id: turnId,
  content: { text }
})

const activeTab = (
  workflowId: string,
  id?: string,
  threadId = 'th'
): AgentChatEvent =>
  chat({
    type: 'agent_active_tab',
    data: { workflow_id: workflowId, message_id: id, thread_id: threadId }
  })

const tabLinkIds = (store: ReturnType<typeof useAgentConversationStore>) =>
  store.messages.flatMap((m) =>
    m.parts.flatMap((p) => (p.type === 'tabLink' ? [p.workflowId] : []))
  )

const partTexts = (store: ReturnType<typeof useAgentConversationStore>) =>
  store.messages.flatMap((m) =>
    m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : []))
  )

function messageTexts(
  store: ReturnType<typeof useAgentConversationStore>,
  id: TurnId
): string[] | undefined {
  return store.messages
    .find((m) => m.id === id)
    ?.parts.flatMap((p) => (p.type === 'text' ? [p.text] : []))
}

describe('useAgentConversationStore', () => {
  it('publishes a turn identity before its live status', () => {
    const store = useAgentConversationStore()
    const observations: [typeof store.status, TurnId | null][] = []
    watch(
      () => [store.status, store.activeTurnId] as const,
      ([status, turnId]) => observations.push([status, turnId]),
      { flush: 'sync' }
    )

    store.startTurn(T1)

    expect(observations.filter(([status]) => status !== 'idle')).toEqual([
      ['streaming', T1]
    ])
  })

  it('(M1) fires a deep watch on messages when a MID-turn delta event lands', async () => {
    const store = useAgentConversationStore()
    const spy = vi.fn()
    watch(() => store.messages, spy, { deep: true })

    store.startTurn(T1)
    await nextTick()
    spy.mockClear()

    store.ingest(delta('t1', 'streaming delta'))
    await nextTick()

    expect(spy).toHaveBeenCalled()
    expect(store.messages[0].parts.map((p) => p.type)).toEqual(['text'])
  })

  it('records a tab link on the live turn for the wire shape carrying a message id', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)

    store.ingest(activeTab('wf-1', 't1'))

    expect(tabLinkIds(store)).toEqual(['wf-1'])
  })

  it('records a tab link on the live turn when the optional message id is absent', () => {
    // message_id is optional on agent_active_tab alone, so the thread has to be
    // enough to place the link.
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)

    store.ingest(activeTab('wf-1'))

    expect(tabLinkIds(store)).toEqual(['wf-1'])
  })

  it('records a tab link on a stashed background thread, not on the displayed one', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.recordUser(T1, 'work in the background')
    store.stashActiveTurn()
    store.setThreadId('th-other')
    store.hydrate([])
    store.startTurn(T2)

    store.ingest(activeTab('wf-9', undefined, 'th'))

    expect(tabLinkIds(store)).toEqual([])
    store.setThreadId('th')
    store.hydrate([])
    store.resumeBackgroundTurn()
    expect(tabLinkIds(store)).toEqual(['wf-9'])
  })

  it('places no tab link when two live stashes on the thread could have sent it', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.ingest(delta('t1', 'older'))
    store.stashActiveTurn()
    store.startTurn(T2)
    store.ingest(delta('t2', 'newer'))
    store.stashActiveTurn()
    store.setThreadId('th-other')
    store.hydrate([])

    store.ingest(activeTab('wf-9', undefined, 'th'))

    store.ingest(delta('t2', ' and more'))
    store.setThreadId('th')
    store.hydrate([])
    store.resumeBackgroundTurn()
    store.ingest(done('t2'))
    store.resumeBackgroundTurn()
    store.ingest(done('t1'))
    expect(tabLinkIds(store)).toEqual([])
    expect(messageTexts(store, T2)).toEqual(['newer and more'])
  })

  it('(M2) isStreaming is false after abortActiveTurn() with no done', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(delta('t1', 'half a th'))
    expect(store.isStreaming).toBe(true)

    store.abortActiveTurn()

    expect(store.isStreaming).toBe(false)
    expect(store.messages[0].streaming).toBe(false)
    expect(store.messages).toHaveLength(1)
    store.abortActiveTurn()
    expect(store.messages).toHaveLength(1)
  })

  it('settles the turn on done and reports idle', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(delta('t1', 'answer'))
    store.ingest(done('t1'))

    expect(store.isStreaming).toBe(false)
    expect(store.status).toBe('idle')
    expect(store.activeTurnId).toBeNull()
  })

  it('reports thinking vs streaming status', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(thinking('t1', 'planning'))
    expect(store.status).toBe('thinking')
    store.ingest(delta('t1', 'go'))
    expect(store.status).toBe('streaming')
  })

  it('drops events for a foreign message_id (store owns turn filtering)', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(delta('t1', 'keep'))

    store.ingest(delta('t2', 'DROP ME'))

    const parts = store.messages[0].parts
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ type: 'text', text: 'keep' })
  })

  it('starting a new turn aborts a prior in-flight turn', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(delta('t1', 'unfinished'))

    store.startTurn(T2)

    expect(store.messages).toHaveLength(2)
    expect(store.messages[0].streaming).toBe(false)
    expect(store.messages[1].streaming).toBe(true)
    expect(store.activeTurnId).toBe(T2)
  })

  it('ignores ingest with no active turn', () => {
    const store = useAgentConversationStore()
    store.ingest(delta('t1', 'orphan'))
    expect(store.messages).toHaveLength(0)
  })

  it('folds a tool_call into the active turn', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(toolCall('t1', 'add_node', 'success'))
    expect(store.messages[0].parts[0]).toMatchObject({
      type: 'tool',
      name: 'add_node',
      ok: true
    })
  })

  // PM-1575 regression: a tool call held back pending canvas catch-up must
  // still receive notifyCanvasCaughtUp() after its turn settles.
  // agent_message_done drops the active-turn transport out of the `transport`
  // slot (clearActive()) the instant it lands, which used to leave the held
  // part with no reachable transport for notifyCanvasCaughtUp() to forward
  // to -- stranding it until its own STALE_AFTER_MS fallback fired, tens of
  // seconds later than the canvas actually caught up.
  it('still settles a canvas-sync-pending tool call after its turn has settled', () => {
    const store = useAgentConversationStore()
    store.setCanvasSyncGate(() => true)
    store.startTurn(T1)
    store.ingest(toolCall('t1', 'add_node', 'success'))
    store.ingest(done('t1'))

    // The turn is settled (message.streaming is false), but the tool part
    // itself is held at 'streaming' -- the spinner -- pending canvas catch-up.
    expect(store.messages[0].streaming).toBe(false)
    expect(store.messages[0].parts[0]).toMatchObject({
      type: 'tool',
      state: 'streaming'
    })

    store.notifyCanvasCaughtUp()

    expect(store.messages[0].parts[0]).toMatchObject({
      type: 'tool',
      state: 'done'
    })
  })

  // PM-1575 regression (finding #1/#9, high): the normal ordering on a
  // healthy doc host is the matching doc_update applying WHILE the tool is
  // still running, with the success frame landing after -- so by the time
  // the terminal frame arrives there is nothing left to wait on. Threads the
  // outcome-count getter end to end (store -> transport), unlike the
  // transport-level unit test for the same finding.
  it('settles a held tool call immediately when the canvas catches up while it is still running', () => {
    const store = useAgentConversationStore()
    let outcomeCount = 0
    store.setCanvasSyncGate(
      () => true,
      () => outcomeCount
    )
    store.startTurn(T1)

    store.ingest(toolCall('t1', 'add_node', 'running'))
    outcomeCount += 1
    store.ingest(toolCall('t1', 'add_node', 'success'))

    expect(store.messages[0].parts[0]).toMatchObject({
      type: 'tool',
      state: 'done'
    })
  })

  // PM-1575 regression (finding #3, medium): settleActiveTurn used to keep
  // only a single "settled but still holding" transport reachable. A second
  // turn settling within the same window while ALSO holding a part
  // overwrote that slot, stranding the first turn's held part until its own
  // STALE_AFTER_MS fallback.
  it('keeps an earlier settled turn reachable after a second turn also settles with a held part', () => {
    const store = useAgentConversationStore()
    store.setCanvasSyncGate(() => true)

    store.startTurn(T1)
    store.ingest(toolCall('t1', 'add_node', 'success'))
    store.ingest(done('t1'))

    store.startTurn(T2)
    store.ingest(toolCall('t2', 'add_node', 'success'))
    store.ingest(done('t2'))

    store.notifyCanvasCaughtUp()

    expect(store.messages[0].parts[0]).toMatchObject({
      type: 'tool',
      state: 'done'
    })
    expect(store.messages[1].parts[0]).toMatchObject({
      type: 'tool',
      state: 'done'
    })
  })

  // PM-1575 regression (finding #4, medium): abortActiveTurn() used to drop
  // the transport out of every reachable slot without flushing what it was
  // still holding, stranding the part at 'streaming' until its own 30s
  // fallback even though nothing will ever call notifyCanvasCaughtUp() for
  // a turn nobody is tracking anymore.
  it('flushes a held tool-call part immediately when its turn is aborted', () => {
    const store = useAgentConversationStore()
    store.setCanvasSyncGate(() => true)
    store.startTurn(T1)
    store.ingest(toolCall('t1', 'add_node', 'success'))
    expect(store.messages[0].parts[0]).toMatchObject({ state: 'streaming' })

    store.abortActiveTurn()

    expect(store.messages[0].parts[0]).toMatchObject({
      state: 'done',
      ok: true
    })
  })

  // A multi-row turn names itself three ways: the acknowledgement row the
  // stash holds, the newest persisted row `pending` points at, and the
  // `turn_id` the transcript keys its message by. No pair of those is equal,
  // so the snapshot installs a live row of its own that the stash is about to
  // displace -- and a transport nothing can reach again leaves that row
  // streaming for good.
  it('settles a snapshot row the resumed stash displaces', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.ingest(delta('t1', 'partial'))
    store.stashActiveTurn()

    store.hydrate([
      historyRow(1, 'user', 'turn-a', 'go', 'u1'),
      historyRow(2, 'assistant', 'turn-a', 'partial', 't1'),
      { ...historyRow(3, 'assistant', 'turn-a', '', 't2'), status: 'streaming' }
    ])
    store.resumeBackgroundTurn()

    expect(store.activeTurnId).toBe('t1')
    expect(
      store.messages.filter(
        (message) => message.id !== 't1' && message.streaming
      )
    ).toEqual([])
  })

  // Retiring the displaced row must not reach a turn this client started. A
  // send can take the active slot between the hydrate and the resume -- both
  // of `resumeBackgroundTurn`'s callers reach it across an await -- and that
  // turn is genuinely live, unlike the snapshot row the retirement is for.
  it('leaves a newer local turn alone when a stash resumes', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.ingest(delta('t1', 'partial'))
    store.stashActiveTurn()
    store.hydrate([
      historyRow(1, 'user', 'turn-a', 'go', 'u1'),
      {
        ...historyRow(2, 'assistant', 'turn-a', '', 't1'),
        content: {},
        status: 'streaming'
      }
    ])
    store.startTurn(T2)
    store.ingest(delta('t2', 'newer'))

    store.resumeBackgroundTurn()

    expect(store.activeTurnId).toBe('t2')
    store.ingest(delta('t2', ' and more'))
    store.ingest(done('t2'))
    const newer = store.messages.find((message) => message.id === 't2')
    expect(newer?.streaming).toBe(false)
    expect(
      newer?.parts.flatMap((part) => (part.type === 'text' ? [part.text] : []))
    ).toEqual(['newer and more'])
  })

  it('keeps an older same-thread stash routable after stashing a newer turn', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.ingest(delta('t1', 'older'))
    store.stashActiveTurn()

    store.hydrate([
      historyRow(1, 'user', 'turn-a', 'go', 'u1'),
      {
        ...historyRow(2, 'assistant', 'turn-a', '', 't1'),
        content: {},
        status: 'streaming'
      }
    ])
    store.startTurn(T2)
    store.ingest(delta('t2', 'newer'))
    store.resumeBackgroundTurn()
    store.stashActiveTurn()

    store.ingest(delta('t1', ' and complete'))
    store.ingest(done('t1'))
    store.ingest(done('t2'))
    store.resumeBackgroundTurn()
    store.resumeBackgroundTurn()

    expect(store.messages.find((m) => m.id === 't1')?.streaming).toBe(false)
    expect(messageTexts(store, T1)).toEqual(['older and complete'])
    expect(store.messages.find((m) => m.id === 't2')?.streaming).toBe(false)
    expect(messageTexts(store, T2)).toEqual(['newer'])

    store.ingest(runApproval('t1', 'late-old-ask'))
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ reason: 'settled-turn' })
      })
    )
  })

  // Resumed unsettled on purpose. The replaced row's index is read twice --
  // once to seat the message, once as the active slot -- and a settled stash
  // returns before the second, leaving half the index unproven. The trailing
  // user row stands for a shape the current server does not emit; without a
  // row after the live turn the replaced and appended indexes coincide.
  it('restores an unsettled stash where the snapshot it replaces stood', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.recordUser(T1, 'go')
    store.ingest(delta('t1', 'older'))
    store.stashActiveTurn()
    store.setThreadId('th-other')
    store.hydrate([])

    store.setThreadId('th')
    store.hydrate([
      historyRow(1, 'user', 'turn-a', 'go', 'u1'),
      {
        ...historyRow(2, 'assistant', 'turn-a', '', 't1'),
        content: {},
        status: 'streaming'
      },
      historyRow(3, 'user', 'turn-b', 'second', 'u2')
    ])
    store.resumeBackgroundTurn()

    expect(store.messages.map((m) => m.id)).toEqual(['t1', 'turn-b'])
    expect(store.activeMessageId).toBe('t1')
    expect(store.isStreaming).toBe(true)
    expect(store.entries.map((e) => `${e.role}:${e.id}`)).toEqual([
      'user:t1',
      'assistant:t1',
      'user:turn-b',
      'assistant:turn-b'
    ])
    expect(messageTexts(store, T1)).toEqual(['older'])
  })

  // The older stash lands below the newer one: a resume with no demoted
  // snapshot to replace appends, which predates the replacement fix and
  // reverses a distinct-prompt pair the same way. Pinned, not corrected --
  // what this guards is that the newer exchange still exists at all, which
  // dropping the immunity makes fail by popping it as a duplicate of the
  // older turn's identical prompt.
  it('keeps an already restored turn when the next same-prompt stash resumes', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.recordUser(T1, 'same prompt')
    store.ingest(delta('t1', 'first'))
    store.stashActiveTurn()
    store.startTurn(T2)
    store.recordUser(T2, 'same prompt')
    store.ingest(delta('t2', 'second'))
    store.stashActiveTurn()

    store.ingest(done('t1'))
    store.ingest(done('t2'))
    store.setThreadId('th-other')
    store.hydrate([])
    store.setThreadId('th')
    store.hydrate([])
    store.resumeBackgroundTurn()
    store.resumeBackgroundTurn()

    expect(store.entries.map((e) => `${e.role}:${e.id}`)).toEqual([
      'user:t2',
      'assistant:t2',
      'user:t1',
      'assistant:t1'
    ])
    expect(messageTexts(store, T1)).toEqual(['first'])
    expect(messageTexts(store, T2)).toEqual(['second'])
  })

  it('keeps the text a stash received while its thread was off screen', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.ingest(delta('t1', 'older'))
    store.stashActiveTurn()
    store.setThreadId('th-other')
    store.hydrate([])

    store.ingest(delta('t1', ' and complete'))
    store.ingest(done('t1'))

    store.setThreadId('th')
    store.hydrate([])
    store.resumeBackgroundTurn()

    expect(messageTexts(store, T1)).toEqual(['older and complete'])
    expect(store.messages.find((m) => m.id === 't1')?.streaming).toBe(false)
  })

  // Provenance has to expire with the slot it describes. Here the snapshot row
  // really is installed -- its id matches neither the stash's nor the turn's --
  // and then settles, so the send that follows owns a slot no resume may
  // retire. Left set, the stale flag makes the resume abort a live local turn.
  it('forgets snapshot provenance once that turn settles', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.ingest(delta('t1', 'partial'))
    store.stashActiveTurn()

    store.hydrate([
      historyRow(1, 'user', 'turn-a', 'go', 'u1'),
      { ...historyRow(2, 'assistant', 'turn-a', '', 't3'), status: 'streaming' }
    ])
    expect(store.activeTurnId).toBe('t3')
    store.ingest(done('t3'))

    store.startTurn(T2)
    store.ingest(delta('t2', 'newer'))
    store.resumeBackgroundTurn()

    expect(store.activeTurnId).toBe('t2')
  })

  // PM-1575 regression (finding #4, medium): resumeBackgroundTurn()'s SECOND
  // early return -- reached when a settled background turn's message is
  // kept on screen but not reactivated as the live turn -- dropped the
  // transport the same way as the paths above, leaving a held part
  // reachable only via its own 30s STALE_AFTER_MS fallback instead of
  // settling the moment it is clear nothing will ever resume it.
  it('flushes a held tool-call part immediately when a settled background turn is resumed but not reactivated', () => {
    const store = useAgentConversationStore()
    store.setCanvasSyncGate(() => true)
    store.setThreadId('th')
    store.startTurn(T1)
    store.ingest(toolCall('t1', 'add_node', 'success'))
    store.stashActiveTurn()
    store.ingest(done('t1'))
    expect(store.messages[0].parts[0]).toMatchObject({ state: 'streaming' })

    store.resumeBackgroundTurn()

    expect(store.messages[0].parts[0]).toMatchObject({ state: 'done' })
  })

  // PM-1575 regression (finding #5, medium): nothing cancelled a held tool
  // call's 30s timer when hydrate() discarded its transport. The orphaned
  // timer could fire after hydrate() replaced the transcript with
  // authoritative server content under the SAME turn id, overwriting it
  // with the disposed transport's own stale snapshot.
  it('does not let an orphaned canvas-sync timer overwrite hydrated content under the same turn id', () => {
    const store = useAgentConversationStore()
    store.setCanvasSyncGate(() => true)
    store.startTurn(T1)
    store.ingest(toolCall('t1', 'add_node', 'success'))
    store.ingest(done('t1'))

    store.hydrate([
      historyRow(1, 'user', 't1', 'go'),
      historyRow(2, 'assistant', 't1', 'authoritative reply')
    ])

    vi.advanceTimersByTime(30_000)

    expect(partTexts(store)).toEqual(['authoritative reply'])
  })

  // PM-1575 regression (finding #7, medium): canvasSyncGate used to be
  // captured BY VALUE at transport-creation time, so a later
  // setCanvasSyncGate() call (e.g. AgentPanelRoot.vue re-registering after a
  // remount) never reached a transport created before it.
  it('routes a later setCanvasSyncGate() call to a transport created before it', () => {
    const store = useAgentConversationStore()
    store.setCanvasSyncGate(() => false)
    store.startTurn(T1)

    store.setCanvasSyncGate(() => true)
    store.ingest(toolCall('t1', 'add_node', 'success'))

    expect(store.messages[0].parts[0]).toMatchObject({ state: 'streaming' })
  })

  // PM-1575 regression (finding #10, medium): the source watcher this
  // guards -- AgentPanelRoot.vue's `watch(() => crdtStatus.value.outcomes
  // .applied, ...)` -- treated ANY change to the counter as catch-up,
  // including a decrease. `useAgentCrdtFollower` resets `outcomes.applied`
  // to 0 when its follower is torn down (e.g. toggling the panel mid-turn)
  // and a restarted follower counts from 0 again, so that watcher's own
  // guard, reproduced here against the real store, is what stops a mere
  // reset from incorrectly releasing every held tool call.
  it('does not release a held tool call when the applied counter decreases, only when it increases', () => {
    const store = useAgentConversationStore()
    const applied = ref(5)
    store.setCanvasSyncGate(
      () => true,
      () => applied.value
    )
    store.startTurn(T1)
    store.ingest(toolCall('t1', 'add_node', 'success'))
    expect(store.messages[0].parts[0]).toMatchObject({ state: 'streaming' })

    watch(
      applied,
      (value, previous) => {
        if (value > previous) store.notifyCanvasCaughtUp()
      },
      { flush: 'sync' }
    )

    applied.value = 0
    expect(store.messages[0].parts[0]).toMatchObject({ state: 'streaming' })

    applied.value = 6
    expect(store.messages[0].parts[0]).toMatchObject({ state: 'done' })
  })

  it('restores a pending run approval as the live turn and continues after it resolves', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.hydrate([
      historyRow(1, 'user', 'turn-1', 'Run it', 'user-message-1'),
      zAgentMessages.parse([
        {
          id: 'assistant-message-1',
          thread_id: 'th',
          seq: 2,
          role: 'assistant',
          status: 'streaming',
          turn_id: 'turn-1',
          pending_ask: {
            message_id: 'assistant-message-1',
            ask_id: 'turn-1:call-1',
            kind: 'run_approval',
            context: {
              workflow_id: 'workflow-1',
              workflow_name: 'Portrait workflow'
            },
            prompt: 'Run workflow “Portrait workflow”?',
            options: [
              { id: 'run', label: 'Run' },
              { id: 'cancel', label: 'Cancel' }
            ],
            min_selections: 1,
            max_selections: 1,
            allow_other: false
          }
        }
      ])[0]
    ])

    expect(store.activeTurnId).toBe('assistant-message-1')
    expect(store.isStreaming).toBe(true)
    expect(store.messages[0].parts).toContainEqual({
      type: 'runApproval',
      askId: 'turn-1:call-1',
      workflowId: 'workflow-1',
      workflowName: 'Portrait workflow'
    })

    store.ingest(askResolved('assistant-message-1', 'turn-1:call-1'))
    store.ingest(delta('assistant-message-1', 'Running now.'))

    expect(
      store.messages[0].parts.some((part) => part.type === 'runApproval')
    ).toBe(false)
    expect(partTexts(store)).toContain('Running now.')
    expect(store.isStreaming).toBe(true)

    store.ingest(done('assistant-message-1'))
    expect(store.isStreaming).toBe(false)
  })

  it('drops a pending run approval when the turn is aborted', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.hydrate([
      historyRow(1, 'user', 'turn-1', 'Run it', 'user-message-1'),
      zAgentMessages.parse([
        {
          id: 'assistant-message-1',
          thread_id: 'th',
          seq: 2,
          role: 'assistant',
          status: 'streaming',
          turn_id: 'turn-1',
          pending_ask: {
            message_id: 'assistant-message-1',
            ask_id: 'turn-1:call-1',
            kind: 'run_approval',
            context: { workflow_id: 'workflow-1' },
            prompt: 'Run it?',
            options: [{ id: 'run', label: 'Run' }],
            min_selections: 1,
            max_selections: 1,
            allow_other: false
          }
        }
      ])[0]
    ])
    expect(store.messages[0].parts).toContainEqual({
      type: 'runApproval',
      askId: 'turn-1:call-1',
      workflowId: 'workflow-1'
    })

    store.abortActiveTurn()

    expect(
      store.messages[0].parts.some((part) => part.type === 'runApproval')
    ).toBe(false)
    expect(store.isStreaming).toBe(false)
  })

  it('recordFailedSend renders [user, assistant(notice)] and leaves the turn idle', () => {
    const store = useAgentConversationStore()
    store.recordFailedSend('local-error-1' as TurnId, 'boom', 'send failed')

    const entries = store.entries
    expect(entries.map((e) => e.role)).toEqual(['user', 'assistant'])
    expect(entries[0]).toMatchObject({ role: 'user', text: 'boom' })
    const assistant = entries[1]
    expect(assistant.role).toBe('assistant')
    if (assistant.role === 'assistant') {
      expect(assistant.streaming).toBe(false)
      expect(assistant.parts).toEqual([
        { type: 'notice', level: 'error', text: 'send failed' }
      ])
    }
    expect(store.activeTurnId).toBeNull()
    expect(store.isStreaming).toBe(false)
  })

  it('recordFailedSend does not disturb an already-active turn', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(delta('t1', 'live'))

    store.recordFailedSend('local-error-1' as TurnId, 'oops', 'send failed')

    expect(store.activeTurnId).toBe(T1)
    expect(store.isStreaming).toBe(true)
  })

  it('reset wipes the whole conversation, distinct from abortActiveTurn', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(delta('t1', 'gone'))
    store.reset()
    expect(store.messages).toHaveLength(0)
    expect(store.activeTurnId).toBeNull()
    expect(store.isStreaming).toBe(false)
  })

  it('holds the thread id and clears it on reset', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th-7')
    expect(store.threadId).toBe('th-7')
    store.reset()
    expect(store.threadId).toBeNull()
  })

  it('scopes approval dedupe and timing to the conversation that owns them', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    expect(store.recordApprovalShown('ask-1', 1_000)).toBe(true)
    expect(store.recordApprovalShown('ask-1', 2_000)).toBe(false)
    expect(store.approvalShownAt('ask-1')).toBe(1_000)

    // Remount hydration of the same thread keeps the shown state: a replayed
    // approval card must not re-emit or restart the decision timer.
    store.setThreadId('th')
    store.hydrate([])
    expect(store.approvalShownAt('ask-1')).toBe(1_000)
    expect(store.recordApprovalShown('ask-1', 3_000)).toBe(false)

    // Leaving the thread drops its abandoned asks with it.
    store.setThreadId('th-other')
    expect(store.approvalShownAt('ask-1')).toBeUndefined()
    expect(store.recordApprovalShown('ask-1', 4_000)).toBe(true)

    store.reset()
    expect(store.approvalShownAt('ask-1')).toBeUndefined()
    expect(store.recordApprovalShown('ask-1', 5_000)).toBe(true)
  })

  it('snapshots local workflow references on the submitted turn', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    Reflect.apply(store.recordUser, store, [
      T1,
      'compare these',
      undefined,
      undefined,
      [
        { id: 'wf-1', name: 'Workflow 1' },
        { id: 'wf-2', name: 'Workflow 2' }
      ]
    ])

    expect(store.entries[0]).toMatchObject({
      role: 'user',
      workflowReferences: [
        { id: 'wf-1', name: 'Workflow 1' },
        { id: 'wf-2', name: 'Workflow 2' }
      ]
    })
  })

  it('revokes transcript blob previews on reset and on hydrate', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.recordUser(T1, 'with picture', [
      { name: 'a.png', previewUrl: 'blob:a' }
    ])
    store.reset()
    expect(revoke).toHaveBeenCalledWith('blob:a')

    revoke.mockClear()
    store.startTurn(T2)
    store.recordUser(T2, 'again', [{ name: 'b.png', previewUrl: 'blob:b' }])
    store.hydrate([])
    expect(revoke).toHaveBeenCalledWith('blob:b')
    expect(
      store.entries.every(
        (entry) => entry.role !== 'user' || entry.attachments === undefined
      )
    ).toBe(true)
    revoke.mockRestore()
  })

  it('keeps attachment labels scoped to their thread after blob previews expire', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const store = useAgentConversationStore()
    const storageRef = 'a'.repeat(64)
    const history = (turn: string) => {
      const user = historyRow(1, 'user', turn, 'use this')
      user.content = {
        text: 'use this',
        attachments: [storageRef],
        attachment_refs: [{ name: storageRef, kind: 'image' }]
      }
      return [user, historyRow(2, 'assistant', turn, 'Done')]
    }

    store.setThreadId('thread-a')
    store.recordUser(T1, 'use this', [
      { name: 'Beach photo.png', ref: storageRef, previewUrl: 'blob:beach' }
    ])
    store.hydrate(history('turn-a'))

    expect(revoke).toHaveBeenCalledWith('blob:beach')
    expect(store.entries[0]).toMatchObject({
      role: 'user',
      attachments: [
        {
          name: 'Beach photo.png',
          ref: storageRef,
          kind: 'image'
        }
      ]
    })

    store.setThreadId('thread-b')
    store.hydrate(history('turn-b'))
    expect(store.entries[0]).toMatchObject({
      role: 'user',
      attachments: [{ name: storageRef, ref: storageRef, kind: 'image' }]
    })
  })

  it('keeps a persisted display name ahead of a remembered label', () => {
    const store = useAgentConversationStore()
    const storageRef = 'a'.repeat(64)
    const user = historyRow(1, 'user', T1, 'use this')
    user.content = {
      text: 'use this',
      attachments: [storageRef],
      attachment_refs: [
        {
          name: storageRef,
          display_name: 'first.png',
          kind: 'image'
        }
      ]
    }

    store.setThreadId('thread-a')
    store.recordUser(T1, 'use this', [{ name: 'second.png', ref: storageRef }])
    store.hydrate([user, historyRow(2, 'assistant', T1, 'Done')])

    expect(store.entries[0]).toMatchObject({
      role: 'user',
      attachments: [{ name: 'first.png', ref: storageRef, kind: 'image' }]
    })
  })

  it('clears remembered attachment labels on reset', () => {
    const store = useAgentConversationStore()
    const storageRef = 'a'.repeat(64)
    const user = historyRow(1, 'user', T1, 'use this')
    user.content = {
      text: 'use this',
      attachments: [storageRef],
      attachment_refs: [{ name: storageRef, kind: 'image' }]
    }

    store.setThreadId('thread-a')
    store.recordUser(T1, 'use this', [
      { name: 'Beach photo.png', ref: storageRef }
    ])
    store.reset()
    store.setThreadId('thread-a')
    store.hydrate([user, historyRow(2, 'assistant', T1, 'Done')])

    expect(store.entries[0]).toMatchObject({
      role: 'user',
      attachments: [{ name: storageRef, ref: storageRef, kind: 'image' }]
    })
  })

  it('keeps a stashed background turn across reset so returning to the thread resumes it', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.recordUser(T1, 'go')
    store.ingest(delta('t1', 'work'))
    store.stashActiveTurn()

    store.reset()
    expect(store.messages).toHaveLength(0)

    store.setThreadId('th')
    store.resumeBackgroundTurn()

    expect(store.entries.map((e) => e.role)).toEqual(['user', 'assistant'])
    expect(store.messages.map((m) => m.id)).toEqual([T1])
    expect(store.isStreaming).toBe(true)
  })

  it('keeps a stashed background turn across hydrate so returning to the thread resumes it', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.recordUser(T1, 'go')
    store.ingest(delta('t1', 'work'))
    store.stashActiveTurn()

    store.setThreadId('th-other')
    store.hydrate([])
    expect(store.messages).toHaveLength(0)

    store.setThreadId('th')
    store.hydrate([])
    store.resumeBackgroundTurn()

    expect(store.entries.map((e) => e.role)).toEqual(['user', 'assistant'])
    expect(store.messages.map((m) => m.id)).toEqual([T1])
    expect(store.isStreaming).toBe(true)
  })

  // PM-1776: hydrate restores a `streaming` row as the live turn, but the
  // stash is the copy that kept this turn's parts and never stopped taking its
  // frames. Letting the snapshot take the active slot would route the rest of
  // the stream to the wrong copy, and the entry `resumeBackgroundTurn` restores
  // would never have seen its own done.
  it('leaves a still-streaming row to the background turn already stashed for it', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.recordUser(T1, 'go')
    store.ingest(delta('t1', 'work'))
    store.stashActiveTurn()

    store.setThreadId('th-other')
    store.hydrate([])

    store.setThreadId('th')
    store.hydrate([
      historyRow(1, 'user', 'turn-a', 'go'),
      {
        ...historyRow(2, 'assistant', 'turn-a', '', 't1'),
        status: 'streaming'
      }
    ])

    expect(store.activeTurnId).toBeNull()
    expect(store.messages[0].streaming).toBe(false)
    expect(store.messages[0].parts).toEqual([])

    // Ingested before the resume, which is the ordering the defect takes: the
    // done has to reach the stash through `ingestBackgroundTurnEvent`, and it
    // only can while the snapshot has not claimed the active slot. Resuming
    // first instead settles the reactivated stash through the active path,
    // which holds whether or not the snapshot was demoted.
    store.ingest(done('t1'))
    store.resumeBackgroundTurn()

    expect(store.isStreaming).toBe(false)
    // One row, not two: settled with its own row id already hydrated, the
    // stash defers to the persisted copy instead of pushing a second.
    expect(
      store.entries.filter((entry) => entry.role === 'assistant')
    ).toHaveLength(1)
  })

  it('demotes a hydrated live copy that shares the stashed message identity', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.recordUser(T1, 'go')
    store.ingest(delta('t1', 'work'))
    store.stashActiveTurn()

    store.setThreadId('th-other')
    store.hydrate([])
    store.setThreadId('th')
    store.hydrate([
      historyRow(1, 'user', 't1', 'go', 'user-row'),
      historyRow(2, 'assistant', 't1', 'partial', 'older-row'),
      {
        ...historyRow(3, 'assistant', 't1', '', 'newest-row'),
        status: 'streaming'
      }
    ])

    // The acknowledgement row (`t1`) and newest persisted row differ, so
    // only the shared message identity can associate this snapshot with the
    // stash. The snapshot must not install its own competing transport.
    expect(store.activeTurnId).toBeNull()
    expect(store.messages.at(-1)?.streaming).toBe(false)

    store.ingest(done('t1'))
    store.resumeBackgroundTurn()

    expect(store.isStreaming).toBe(false)
    expect(store.activeTurnId).toBeNull()
  })

  it('keeps a settled background reply when an earlier history turn shares its prompt text', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T2)
    store.recordUser(T2, 'go')
    store.ingest(delta('t2', 'the awaited reply'))
    store.stashActiveTurn()
    store.ingest(done('t2'))

    store.hydrate([
      historyRow(1, 'user', 'turn-a', 'go'),
      historyRow(2, 'assistant', 'turn-a', 'older reply'),
      historyRow(3, 'user', 'turn-b', 'different'),
      historyRow(4, 'assistant', 'turn-b', 'other reply')
    ])
    store.resumeBackgroundTurn()

    expect(partTexts(store)).toContain('the awaited reply')
  })

  it('hydrates transcript turns in sequence order', () => {
    const store = useAgentConversationStore()

    store.hydrate([
      historyRow(4, 'assistant', 'turn-b', 'Second reply'),
      historyRow(2, 'assistant', 'turn-a', 'First reply'),
      historyRow(1, 'user', 'turn-a', 'First prompt'),
      historyRow(3, 'user', 'turn-b', 'Second prompt')
    ])

    expect(store.entries.map((entry) => entry.id)).toEqual([
      'turn-a',
      'turn-a',
      'turn-b',
      'turn-b'
    ])
    expect(partTexts(store)).toEqual(['First reply', 'Second reply'])
  })

  it('hydrates persisted workflow reference chips on their original user turn', () => {
    const user = historyRow(1, 'user', 'turn-a', 'Compare these')
    user.content = {
      text: 'Compare these',
      workflow_references: [
        { workflow_id: 'wf-reference', name: 'Reference workflow' }
      ]
    }
    const store = useAgentConversationStore()

    store.hydrate([user, historyRow(2, 'assistant', 'turn-a', 'Done')])

    expect(store.entries[0]).toMatchObject({
      role: 'user',
      workflowReferences: [{ id: 'wf-reference', name: 'Reference workflow' }]
    })
  })

  it('hydrates a persisted user attachment preview on its original turn', () => {
    const user = historyRow(1, 'user', 'turn-a', 'check this image')
    user.content = {
      text: 'check this image',
      attachments: ['ComfyUI_00002_.png'],
      attachment_refs: [
        { name: 'ComfyUI_00002_.png', id: 'asset-1', kind: 'image' }
      ]
    }
    const store = useAgentConversationStore()

    store.hydrate([user, historyRow(2, 'assistant', 'turn-a', 'Looks good.')])

    expect(store.entries[0]).toMatchObject({
      role: 'user',
      attachments: [{ name: 'ComfyUI_00002_.png', ref: 'ComfyUI_00002_.png' }]
    })
  })

  it('hydrates persisted tool calls into the same parts array the live work-summary UI reads', () => {
    const assistant = historyRow(2, 'assistant', 'turn-a', 'Done')
    assistant.content = {
      text: 'Done',
      tool_calls: [
        {
          id: 'audit-1',
          tool_call_id: 'call-1',
          tool_name: 'search_nodes',
          status: 'success'
        }
      ]
    }
    const store = useAgentConversationStore()

    store.hydrate([historyRow(1, 'user', 'turn-a', 'Find a node'), assistant])

    expect(store.messages[0].parts).toContainEqual({
      type: 'tool',
      callId: 'call-1',
      name: 'search_nodes',
      state: 'done',
      ok: true
    })
  })

  it('does not bleed a tool-call summary onto a different chat, and restores it when switching back', () => {
    const store = useAgentConversationStore()
    const threadAAssistant = historyRow(2, 'assistant', 'turn-a', 'Done A')
    threadAAssistant.content = {
      text: 'Done A',
      tool_calls: [
        {
          id: 'audit-a',
          tool_call_id: 'call-a',
          tool_name: 'search_nodes',
          status: 'success'
        }
      ]
    }
    const threadA = [
      historyRow(1, 'user', 'turn-a', 'Find a node'),
      threadAAssistant
    ]
    const threadB = [
      historyRow(1, 'user', 'turn-b', 'Just chat'),
      historyRow(2, 'assistant', 'turn-b', 'Done B')
    ]
    const hasToolPart = () =>
      store.messages.some((message) =>
        message.parts.some((part) => part.type === 'tool')
      )

    store.hydrate(threadA)
    expect(hasToolPart()).toBe(true)

    store.hydrate(threadB)
    expect(hasToolPart()).toBe(false)

    store.hydrate(threadA)
    expect(hasToolPart()).toBe(true)
  })

  it('keeps hydrated turn identity stable when persisted row ids change', () => {
    const store = useAgentConversationStore()
    const firstRows = [
      historyRow(1, 'user', 'turn-a', 'Prompt', 'user-row-v1'),
      historyRow(2, 'assistant', 'turn-a', 'Reply', 'assistant-row-v1')
    ]

    store.hydrate(firstRows)
    const firstMessage = store.messages[0]
    store.hydrate([
      historyRow(1, 'user', 'turn-a', 'Prompt', 'user-row-v2'),
      historyRow(2, 'assistant', 'turn-a', 'Reply', 'assistant-row-v2')
    ])

    expect(store.messages[0].id).toBe(firstMessage.id)
    expect(store.messages[0].id).toBe('turn-a')
  })

  it('keeps an earlier completed turn when a returning live turn repeats its prompt text', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T2)
    store.recordUser(T2, 'go')
    store.ingest(delta('t2', 'second reply'))
    store.stashActiveTurn()

    store.hydrate([
      historyRow(1, 'user', 'turn-a', 'go'),
      historyRow(2, 'assistant', 'turn-a', 'first reply')
    ])
    store.resumeBackgroundTurn()

    const texts = partTexts(store)
    expect(texts).toContain('first reply')
    expect(texts).toContain('second reply')
    expect(store.isStreaming).toBe(true)
  })

  it('does not duplicate a settled background turn persisted under a server turn id', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.recordUser(T1, 'go')
    store.ingest(delta('t1', 'live reply'))
    store.stashActiveTurn()
    store.ingest(done('t1'))

    store.hydrate([
      historyRow(1, 'user', 'server-turn', 'go'),
      historyRow(2, 'assistant', 'server-turn', 'persisted reply', 't1')
    ])
    store.resumeBackgroundTurn()

    expect(store.messages.map((message) => message.id)).toEqual(['server-turn'])
    expect(partTexts(store)).toEqual(['persisted reply'])
    expect(store.isStreaming).toBe(false)
  })

  it('resolves existing paywalls without resurrecting them', () => {
    const store = useAgentConversationStore()
    store.recordPaywall(T1, 'subscribe')
    store.resolvePaywalls()

    expect(store.entries).toMatchObject([{ role: 'user', text: 'subscribe' }])
    expect(store.messages[0].parts).toEqual([
      { type: 'paywall', message: undefined }
    ])

    store.recordPaywall(T2, 'continue')
    expect(store.entries.map((entry) => entry.role)).toEqual([
      'user',
      'user',
      'assistant'
    ])
  })
  describe('a dropped approval ask is reported', () => {
    it('reports when the socket-drop teardown left nothing to route the ask to', () => {
      const store = useAgentConversationStore()
      store.setThreadId('th')
      store.startTurn(T1)
      store.ingest(delta('t1', 'building your workflow'))

      // What onStatus(false) does today: settle the active turn locally and
      // empty the background map, while the server keeps running the turn.
      store.abortActiveTurn()
      store.dropBackgroundTurns()

      // The server, still running, now asks the user to approve the run.
      store.ingest(runApproval('t1', 'turn-1:call-1'))

      expect(
        store.messages.some((message) =>
          message.parts.some((part) => part.type === 'runApproval')
        )
      ).toBe(false)
      expect(reportError).toHaveBeenCalledTimes(1)
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'failure_delivering_agent_approval_ask',
          level: 'warning',
          tags: expect.objectContaining({
            reason: 'no-live-turn',
            ask_kind: 'run_approval'
          })
        })
      )
    })

    it('stays quiet when the ask reaches its turn', () => {
      const store = useAgentConversationStore()
      store.setThreadId('th')
      store.startTurn(T1)
      store.ingest(delta('t1', 'building your workflow'))

      store.ingest(runApproval('t1', 'turn-1:call-1'))

      expect(store.messages[0].parts).toContainEqual(
        expect.objectContaining({
          type: 'runApproval',
          askId: 'turn-1:call-1'
        })
      )
      expect(reportError).not.toHaveBeenCalled()
    })

    it('stays quiet for every non-ask frame the same routing drops', () => {
      const store = useAgentConversationStore()
      store.setThreadId('th')
      store.startTurn(T1)
      store.abortActiveTurn()
      store.dropBackgroundTurns()

      store.ingest(delta('t1', 'more text'))
      store.ingest(thinking('t1', 'still thinking'))
      store.ingest(done('t1'))

      expect(reportError).not.toHaveBeenCalled()
    })

    it('stays quiet for an ask belonging to an untracked thread', () => {
      const store = useAgentConversationStore()
      store.setThreadId('th')
      store.startTurn(T1)
      store.abortActiveTurn()

      store.ingest(
        chat({
          ...runApproval('t1', 'turn-1:call-1'),
          data: {
            ...runApproval('t1', 'turn-1:call-1').data,
            thread_id: 'another-thread'
          }
        })
      )

      expect(reportError).not.toHaveBeenCalled()
    })

    it('reports the same dropped ask only once', () => {
      const store = useAgentConversationStore()
      store.setThreadId('th')
      store.startTurn(T1)
      store.abortActiveTurn()

      const ask = runApproval('t1', 'turn-1:call-1')
      store.ingest(ask)
      store.ingest(ask)

      expect(reportError).toHaveBeenCalledTimes(1)
    })

    it('dedupes one ask across the transport and store routing paths', () => {
      const store = useAgentConversationStore()
      store.setThreadId('th')
      store.startTurn(T1)
      store.stashActiveTurn()
      store.ingest(done('t1'))

      const ask = runApproval('t1', 'turn-1:call-1')
      store.ingest(ask)
      store.dropBackgroundTurns()
      store.ingest(ask)

      expect(reportError).toHaveBeenCalledTimes(1)
    })

    it('reports a late ask after hydrate retires an active turn', () => {
      const store = useAgentConversationStore()
      store.setThreadId('th')
      store.startTurn(T1)

      store.hydrate([])
      store.ingest(runApproval('t1', 'turn-1:call-1'))

      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({ reason: 'no-live-turn' })
        })
      )
    })

    it('reports a late ask after resume discards a settled turn', () => {
      const store = useAgentConversationStore()
      store.setThreadId('th')
      store.startTurn(T1)
      store.stashActiveTurn()
      store.ingest(done('t1'))

      store.hydrate([])
      store.resumeBackgroundTurn()
      store.ingest(runApproval('t1', 'turn-1:call-1'))

      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({ reason: 'settled-turn' })
        })
      )
    })

    it('reports after a dropped background turn', () => {
      const store = useAgentConversationStore()
      store.setThreadId('th')
      store.startTurn(T1)
      store.stashActiveTurn()
      store.dropBackgroundTurns()

      store.ingest(runApproval('t1', 'turn-1:call-1'))

      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({ reason: 'no-live-turn' })
        })
      )
    })

    it('preserves the settled reason when dropping background turns', () => {
      const store = useAgentConversationStore()
      store.setThreadId('th')
      store.startTurn(T1)
      store.stashActiveTurn()
      store.ingest(done('t1'))
      store.dropBackgroundTurns()

      store.ingest(runApproval('t1', 'turn-1:call-1'))

      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({ reason: 'settled-turn' })
        })
      )
    })

    it('records malformed background settlement before deleting the turn', () => {
      const store = useAgentConversationStore()
      store.setThreadId('th')
      store.startTurn(T1)
      store.stashActiveTurn()
      store.settleBackgroundTurn(T1)

      store.ingest(runApproval('t1', 'turn-1:call-1'))

      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({ reason: 'settled-turn' })
        })
      )
    })

    it('reports after a settled active turn', () => {
      const store = useAgentConversationStore()
      store.setThreadId('th')
      store.startTurn(T1)
      store.ingest(done('t1'))

      store.ingest(runApproval('t1', 'turn-1:call-1'))

      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({ reason: 'settled-turn' })
        })
      )
    })

    it('keeps an aborted identity after an unrelated turn starts', () => {
      const store = useAgentConversationStore()
      store.setThreadId('th')
      store.startTurn(T1)
      store.abortActiveTurn()
      store.startTurn(T2)

      store.ingest(runApproval('t1', 'turn-1:call-1'))

      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({ reason: 'no-live-turn' })
        })
      )
    })

    it('records an aborted turn under the thread that owns its transport', () => {
      const store = useAgentConversationStore()
      store.setThreadId('original-thread')
      store.startTurn(T1)
      store.setThreadId('replacement-thread')
      store.abortActiveTurn()

      store.ingest(
        chat({
          ...runApproval('t1', 'turn-1:call-1'),
          data: {
            ...runApproval('t1', 'turn-1:call-1').data,
            thread_id: 'original-thread'
          }
        })
      )

      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({ reason: 'no-live-turn' })
        })
      )
    })

    it('reports an ask kind the panel has no card for', () => {
      const store = useAgentConversationStore()
      store.setThreadId('th')
      store.startTurn(T1)
      store.ingest(delta('t1', 'building your workflow'))

      store.ingest(runApproval('t1', 'turn-1:call-1', { kind: 'pick_a_model' }))

      expect(
        store.messages[0].parts.some((part) => part.type === 'runApproval')
      ).toBe(false)
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'failure_delivering_agent_approval_ask',
          tags: expect.objectContaining({
            reason: 'unknown-kind',
            ask_kind: 'pick_a_model'
          })
        })
      )
    })
  })
})
