import { assert, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, watch } from 'vue'

import type { AgentMessages, TurnId } from '../../schemas/agentApiSchema'
import { zAgentMessages, zAgentWsEvent } from '../../schemas/agentApiSchema'
import type { AgentChatEvent } from '../../services/agent/agentEventTransport'

import { useAgentConversationStore } from './agentConversationStore'

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

/** cloud's storage-key hash shape: `<64 hex><ext>` (common/assets/manager_impl.go). */
const storedRef = `${'9f2c'.repeat(16)}.png`

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

    expect(store.messages[0].parts[0]).toMatchObject({ state: 'done' })
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
      store.messages[0].parts.some(
        (part) => (part as { type: string }).type === 'runApproval'
      )
    ).toBe(false)
    expect(partTexts(store)).toContain('Running now.')
    expect(store.isStreaming).toBe(true)

    store.ingest(done('assistant-message-1'))
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

  it("surfaces a live turn's attachments on its user entry", () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)

    store.recordUser(T1, 'upscale this', [
      { name: 'Beach photo.png', ref: storedRef, previewUrl: 'blob:b' }
    ])

    expect(store.entries[0]).toMatchObject({
      role: 'user',
      attachments: [
        { name: 'Beach photo.png', ref: storedRef, previewUrl: 'blob:b' }
      ]
    })
  })

  it('revokes the live blob preview yet still restores the same turn from history', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const user = historyRow(1, 'user', 'server-turn', 'upscale this')
    user.content = { text: 'upscale this', attachments: ['beach.png'] }
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.recordUser(T1, 'upscale this', [
      { name: 'beach.png', ref: 'beach.png', previewUrl: 'blob:beach' }
    ])

    store.hydrate([user, historyRow(2, 'assistant', 'server-turn', 'Done')])

    expect(revoke).toHaveBeenCalledWith('blob:beach')
    const [restored] = store.entries
    assert(restored.role === 'user')
    expect(restored.attachments).toEqual([
      { name: 'beach.png', ref: 'beach.png' }
    ])
  })

  /**
   * PM-1643 / PM-1149 / PM-717. Switching threads mid-turn stashes the turn;
   * returning hydrates the rows the service already holds, which mid-turn is
   * both of them — `StartTurn` writes the user row and the streaming row in
   * one transaction, under a `turn_id` that is a fresh server uuid, while the
   * ack hands the client the assistant ROW's id as its live turn id
   * (services/agent/server/agent_handler.go, internal/persist/turnstart.go).
   * Being distinct, the hydrated turn survives resume's own id filter, and the
   * two dedupe paths behind it both decline: `removeHydratedCopy` because
   * `hydratedAssistantTurnIds` holds the hydrated assistant row, and the
   * drop-the-stash branch because `entry.settled` is false on a stash. What
   * reconciles them is the row id the ack handed over, which resolves to the
   * hydrated turn. The `'server-turn'` idiom is the one the settled-turn case
   * below already uses.
   */
  it('resumes a thread-switched turn once, with its attachments', () => {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const userRow = historyRow(1, 'user', 'server-turn', 'upscale this')
    userRow.content = { text: 'upscale this', attachments: [storedRef] }
    const assistantRow = historyRow(2, 'assistant', 'server-turn', '', 't1')
    assistantRow.status = 'streaming'
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.recordUser(T1, 'upscale this', [
      { name: 'Beach photo.png', ref: storedRef, previewUrl: 'blob:beach' }
    ])
    store.ingest(delta('t1', 'working on it'))
    store.stashActiveTurn()

    store.setThreadId('th-other')
    store.hydrate([])
    store.setThreadId('th')
    store.hydrate([userRow, assistantRow])
    store.resumeBackgroundTurn()

    expect(partTexts(store)).toEqual(['working on it'])
    expect(store.isStreaming).toBe(true)
    // The name is the half a refresh cannot recover (PM-1705): the row names
    // the file by its ref, and only the stash still holds what the user
    // attached. A thread switch never left the session, so it keeps it.
    expect(store.entries.filter((entry) => entry.role === 'user')).toEqual([
      expect.objectContaining({
        text: 'upscale this',
        attachments: [{ name: 'Beach photo.png', ref: storedRef }]
      })
    ])
    expect(store.entries.map((entry) => entry.role)).toEqual([
      'user',
      'assistant'
    ])
  })

  /**
   * A stash is only the fuller copy while its transport was delivering. One
   * stashed across a socket drop holds nothing, while the row behind it holds
   * the reply the agent finished without it — so here the hydrated copy is the
   * one that stays, and the turn is not left on an empty bubble that will
   * never settle.
   */
  it('keeps the persisted reply when the resumed stash has nothing on it', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.recordUser(T1, 'upscale this')
    store.stashActiveTurn()

    store.setThreadId('th-other')
    store.hydrate([])
    store.setThreadId('th')
    store.hydrate([
      historyRow(1, 'user', 'server-turn', 'upscale this'),
      historyRow(2, 'assistant', 'server-turn', 'All done.', 't1')
    ])
    store.resumeBackgroundTurn()

    expect(partTexts(store)).toEqual(['All done.'])
    expect(store.entries.map((entry) => entry.role)).toEqual([
      'user',
      'assistant'
    ])
    expect(store.isStreaming).toBe(false)
  })

  /**
   * PM-1643 / PM-1149 / PM-717. The ask the turn is waiting on was persisted
   * on the row, never broadcast, so it exists only on the copy resume drops.
   * Losing it with the copy leaves the turn unanswerable — worse than the
   * duplicate, which at least kept the card reachable.
   */
  it('keeps a run approval the dropped hydrated copy was carrying', () => {
    const userRow = historyRow(1, 'user', 'server-turn', 'run it')
    userRow.content = { text: 'run it', attachments: ['beach.png'] }
    const [askingRow] = zAgentMessages.parse([
      {
        id: 't1',
        thread_id: 'th',
        seq: 2,
        role: 'assistant',
        status: 'streaming',
        turn_id: 'server-turn',
        pending_ask: {
          message_id: 't1',
          ask_id: 'server-turn:call-1',
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
    ])
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.recordUser(T1, 'run it')
    store.ingest(delta('t1', 'working on it'))
    store.stashActiveTurn()

    store.setThreadId('th-other')
    store.hydrate([])
    store.setThreadId('th')
    store.hydrate([userRow, askingRow])
    store.resumeBackgroundTurn()

    expect(store.messages).toHaveLength(1)
    expect(store.messages[0].parts).toContainEqual({
      type: 'runApproval',
      askId: 'server-turn:call-1',
      workflowId: 'workflow-1',
      workflowName: 'Portrait workflow'
    })
    expect(partTexts(store)).toEqual(['working on it'])
  })

  it('hydrates persisted tool calls into the same parts array the live work-summary UI reads', () => {
    const assistant = historyRow(2, 'assistant', 'turn-a', 'Done')
    assistant.content = {
      text: 'Done',
      tool_calls: [{ id: 'call-1', tool_name: 'search_nodes', status: 'ok' }]
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
      tool_calls: [{ id: 'call-a', tool_name: 'search_nodes', status: 'ok' }]
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
})
