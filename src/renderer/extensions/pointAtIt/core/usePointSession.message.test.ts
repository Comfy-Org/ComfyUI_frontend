import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope } from 'vue'

import type { AgentBackend } from './agentBackends'
import type { AgentRequest } from './agentReply'
import { pointConfig } from './config'
import { createFakePointHost } from './fakePointHost'
import type { Point } from './geometry'
import { fakeBrowserStorage } from './historyFixtures'
import { createHistoryKeeper } from './historyKeeper'
import { answers } from './messages'
import type { AgentOutcome } from './modelReply'
import { numberedComments } from './turns'
import { usePointSession } from './usePointSession'

const FRAME_MS = 16
const SAVE_NODE: Point = { x: 800, y: 480 }
const settings = {
  enabled: true,
  maxCharsPerWorkflow: 100_000,
  maxWorkflows: 20
}

interface ModelCall {
  request: AgentRequest
  answer: (outcome: AgentOutcome) => void
}

function fakeModel() {
  const calls: ModelCall[] = []
  const backend: AgentBackend = {
    ask(request, _nodes, { onOutcome }) {
      calls.push({ request, answer: onOutcome })
    }
  }
  return { backend, calls }
}

/** The model's chat reply: one step for the comment, pointing at nothing. */
function say(call: ModelCall, annotationId: string, text: string) {
  call.answer({
    kind: 'reply',
    reply: {
      steps: [
        { annotationId, text, target: null, waitFor: null, offerEdit: null }
      ]
    }
  })
}

/** One page load on a browser storage; `model` swaps the scripted agent for a fake model. */
function openPage(
  setup: {
    storage?: ReturnType<typeof fakeBrowserStorage>
    model?: AgentBackend
  } = {}
) {
  const storage = setup.storage ?? fakeBrowserStorage()
  const host = createFakePointHost()
  host.workflow = 'workflow-w'
  const history = createHistoryKeeper(() => storage, settings)
  const scope = effectScope()
  const session = scope.run(() =>
    usePointSession(host, {
      config: {
        ...pointConfig,
        agent: setup.model ? 'model' : 'scripted',
        scripted: { replyDelayMs: 0, wrongTarget: false }
      },
      model: setup.model,
      history,
      elementAt: () => null
    })
  )
  if (!session) throw new Error('The session scope is not active')
  let isClosed = false
  function close() {
    if (!isClosed) scope.stop()
    isClosed = true
  }
  onTestFinished(close)
  return { host, session, storage, close }
}

function onlyUnsentId(session: ReturnType<typeof usePointSession>): string {
  const [unsent] = session.conversation.value.unsent
  return unsent.id
}

describe('usePointSession: a message said to her', () => {
  it('CP-50: with nothing selected it is sent at once, as a comment pinned on nothing, and answered', () => {
    const { session } = openPage()

    session.sendMessage('  hi  ')
    expect(session.state.value.phase).toBe('waiting')
    const id = onlyUnsentId(session)
    vi.advanceTimersByTime(FRAME_MS)

    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      index: 0,
      steps: [
        {
          annotationId: id,
          target: null,
          text: `${answers.greeting}\n\n${answers.canAnswer}`
        }
      ]
    })
    expect(session.conversation.value).toMatchObject({
      turns: [{ comments: [{ id, comment: 'hi', targets: [], label: '' }] }],
      unsent: []
    })
  })

  it('CP-51: it has no pin, and no number takes the place of one', () => {
    const { session } = openPage()

    session.sendMessage('hi')
    expect(session.pins.value).toEqual([])
    vi.advanceTimersByTime(FRAME_MS)
    expect(session.pins.value).toEqual([])
    session.finish()

    session.toggleAnnotate()
    session.pickAt(SAVE_NODE)
    session.saveDraft('what is this?')

    expect(session.pins.value).toMatchObject([{ number: 1, locked: false }])
    expect(
      numberedComments(session.conversation.value).map(({ number }) => number)
    ).toEqual([null, 1])
  })

  it('CP-52: the selected nodes are its targets, and it is pinned there like a comment from the Ask mode', () => {
    const { host, session } = openPage()
    const [, latent] = host.nodes
    host.selection = [latent.id]

    session.sendMessage('what is this?')

    expect(session.conversation.value.unsent).toMatchObject([
      {
        comment: 'what is this?',
        label: 'Empty Latent Image',
        targets: [{ kind: 'node', nodeId: latent.id }]
      }
    ])
    expect(session.pins.value).toMatchObject([
      { number: 1, rect: { x: 260, y: 360 } }
    ])
  })

  it('CP-53: a blank message sends nothing, and nothing is sent while a request waits or an answer shows', () => {
    const { session } = openPage()

    session.sendMessage('   ')
    expect(session.state.value.phase).toBe('idle')
    expect(session.conversation.value.unsent).toEqual([])

    session.sendMessage('hi')
    session.sendMessage('and another')
    expect(session.conversation.value.unsent).toHaveLength(1)

    vi.advanceTimersByTime(FRAME_MS)
    session.sendMessage('and another')
    expect(session.conversation.value.turns).toHaveLength(1)
    expect(session.conversation.value.unsent).toEqual([])
  })

  it('CP-54: the model is sent a comment pinned on nothing, and may answer it in one step with no target', () => {
    const model = fakeModel()
    const { session } = openPage({ model: model.backend })

    session.sendMessage('hi')
    const id = onlyUnsentId(session)

    expect(model.calls[0].request).toMatchObject({
      kind: 'batch',
      annotations: [{ id, label: '', comment: 'hi', targets: [] }],
      history: []
    })

    say(model.calls[0], id, 'Hello! Ask me about any node.')
    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      steps: [
        {
          annotationId: id,
          target: null,
          text: 'Hello! Ask me about any node.'
        }
      ]
    })
  })

  it('CP-55: a follow-up continues the same thread, with the message and her reply, and starts no turn', () => {
    const model = fakeModel()
    const { session } = openPage({ model: model.backend })
    session.sendMessage('hi')
    const id = onlyUnsentId(session)
    say(model.calls[0], id, 'Hello!')

    session.followUp('what is a sampler?')

    expect(model.calls[1].request).toMatchObject({
      kind: 'followUp',
      comment: { id, comment: 'hi', targets: [], label: '' },
      thread: [{ from: 'agent', steps: [{ text: 'Hello!', target: null }] }],
      followUp: 'what is a sampler?'
    })
    say(model.calls[1], id, 'It turns noise into the picture.')

    expect(session.conversation.value.turns).toHaveLength(1)
    expect(session.conversation.value.turns[0].followUps).toMatchObject([
      { text: 'what is a sampler?' }
    ])
    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      steps: [{ text: 'It turns noise into the picture.', target: null }]
    })
  })

  it('CP-56: a message after Done starts a new turn, and the first one is its history', () => {
    const model = fakeModel()
    const { session } = openPage({ model: model.backend })
    session.sendMessage('hi')
    say(model.calls[0], onlyUnsentId(session), 'Hello!')
    session.finish()
    expect(session.state.value.phase).toBe('idle')

    session.sendMessage('what can you do?')
    const id = onlyUnsentId(session)

    expect(model.calls[1].request).toMatchObject({
      kind: 'batch',
      annotations: [{ comment: 'what can you do?', targets: [] }],
      history: [
        {
          comments: [{ comment: 'hi', targets: [] }],
          answer: [{ text: 'Hello!', target: null }]
        }
      ]
    })
    say(model.calls[1], id, 'I can point at things.')
    expect(session.conversation.value.turns).toHaveLength(2)
  })

  it('CP-57: after a reload the turn is still there, has no pin, and its thread opens again with nothing to point at', () => {
    const first = openPage()
    first.session.sendMessage('hi')
    vi.advanceTimersByTime(FRAME_MS)
    const before = first.session.conversation.value
    first.close()

    const { session } = openPage({ storage: first.storage })
    const [asked] = before.turns[0].comments

    expect(session.conversation.value).toEqual(before)
    expect(session.pins.value).toEqual([])
    session.openPin(asked.id)
    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      replay: true,
      steps: [{ annotationId: asked.id, target: null }]
    })
  })

  it('CP-58: a message that fails stays unsent, pinned on nothing, and Retry sends it again', () => {
    const model = fakeModel()
    const { session } = openPage({ model: model.backend })
    session.sendMessage('hi')

    model.calls[0].answer({
      kind: 'failure',
      failure: { kind: 'proxyDown', detail: '' }
    })
    expect(session.state.value.phase).toBe('failed')
    expect(session.conversation.value.unsent).toMatchObject([
      { comment: 'hi', targets: [] }
    ])

    session.retry()

    expect(model.calls[1].request).toMatchObject({
      annotations: [{ comment: 'hi', targets: [] }]
    })
  })

  it('CP-58: a message that was cancelled is not carried along by the next one, which a pinned question still is', () => {
    const model = fakeModel()
    const { session } = openPage({ model: model.backend })
    session.toggleAnnotate()
    session.pickAt(SAVE_NODE)
    session.saveDraft('what is this?')
    session.toggleAnnotate()
    session.sendMessage('hi')
    session.dismiss()
    expect(session.state.value.phase).toBe('idle')
    expect(session.conversation.value.unsent).toHaveLength(2)

    session.sendMessage('what can you do?')

    expect(model.calls[1].request).toMatchObject({
      annotations: [
        { comment: 'what is this?', label: 'Save Image' },
        { comment: 'what can you do?', targets: [] }
      ]
    })
  })

  it('CP-59: it takes the questions not sent yet with it, as Send does, and the pin keeps number 1', () => {
    const model = fakeModel()
    const { session } = openPage({ model: model.backend })
    session.toggleAnnotate()
    session.pickAt(SAVE_NODE)
    session.saveDraft('what is this?')
    session.toggleAnnotate()
    expect(session.state.value.phase).toBe('idle')

    session.sendMessage('hi')

    expect(model.calls[0].request).toMatchObject({
      annotations: [
        { comment: 'what is this?', label: 'Save Image' },
        { comment: 'hi', targets: [] }
      ]
    })
    expect(session.pins.value).toMatchObject([{ number: 1 }])
  })
})
