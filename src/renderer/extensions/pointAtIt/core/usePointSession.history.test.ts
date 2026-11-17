import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope } from 'vue'

import type { AgentBackend } from './agentBackends'
import type { AgentRequest } from './agentReply'
import { pointConfig } from './config'
import { createFakePointHost, settingAddress } from './fakePointHost'
import type { Point } from './geometry'
import { fakeBrowserStorage } from './historyFixtures'
import { createHistoryKeeper } from './historyKeeper'
import type { HistorySettings } from './historyKeeper'
import { historyKey } from './historyStorage'
import type { AgentOutcome } from './modelReply'
import { numberedComments } from './turns'
import { usePointSession } from './usePointSession'

const FRAME_MS = 16
const WIDTH_ROW: Point = { x: 300, y: 392 }
const SAVE_NODE: Point = { x: 800, y: 480 }
const WIDER = 'how do I make this wider?'
const settings: HistorySettings = {
  enabled: true,
  maxCharsPerWorkflow: 100_000,
  maxWorkflows: 20
}

type Session = ReturnType<typeof usePointSession>

function fakeModel() {
  const calls: {
    request: AgentRequest
    signal: AbortSignal
    answer: (outcome: AgentOutcome) => void
  }[] = []
  const backend: AgentBackend = {
    ask(request, _nodes, { signal, onOutcome }) {
      calls.push({ request, signal, answer: onOutcome })
    }
  }
  return { backend, calls }
}

interface PageSetup {
  workflow?: string | null
  model?: AgentBackend
  elementAt?: (point: Point) => Element | null
}

/** One page load: a new session, a new host and a new keeper on the same browser storage. */
function openPage(
  storage: ReturnType<typeof fakeBrowserStorage>,
  { workflow = 'workflow-w', model, elementAt }: PageSetup = {}
) {
  const host = createFakePointHost()
  host.workflow = workflow
  const history = createHistoryKeeper(() => storage, settings)
  const scope = effectScope()
  const session = scope.run(() =>
    usePointSession(host, {
      config: {
        ...pointConfig,
        agent: model ? 'model' : 'scripted',
        scripted: { replyDelayMs: 0, wrongTarget: false }
      },
      model,
      history,
      elementAt: elementAt ?? (() => null)
    })
  )
  if (!session) throw new Error('The session scope is not active')
  let isClosed = false
  function close() {
    if (!isClosed) scope.stop()
    isClosed = true
  }
  onTestFinished(close)
  return { host, session, history, close }
}

function ask(session: Session, point: Point, text: string) {
  if (session.state.value.phase !== 'annotating') session.toggleAnnotate()
  session.pickAt(point)
  session.saveDraft(text)
}

function sendAndAnswer(session: Session) {
  session.sendBatch()
  vi.advanceTimersByTime(FRAME_MS)
}

/** A first page with one answered turn that has an answered follow-up, and one more question not sent yet. */
function pageWithHistory(storage = fakeBrowserStorage()) {
  const page = openPage(storage)
  ask(page.session, SAVE_NODE, WIDER)
  sendAndAnswer(page.session)
  page.session.followUp('make it taller')
  vi.advanceTimersByTime(FRAME_MS)
  page.session.dismiss()
  ask(page.session, WIDTH_ROW, 'what is this?')
  page.session.toggleAnnotate()
  return { storage, ...page }
}

function reload(
  page: { close: () => void },
  storage: ReturnType<typeof fakeBrowserStorage>,
  setup?: PageSetup
) {
  page.close()
  return openPage(storage, setup)
}

describe('usePointSession: the history after a reload', () => {
  it('HS-01: the workflow’s turns, answers, threads and unsent questions are there again, with their pins and numbers', () => {
    const first = pageWithHistory()
    const before = first.session.conversation.value

    const { session } = reload(first, first.storage)
    vi.advanceTimersByTime(FRAME_MS)

    expect(session.conversation.value).toEqual(before)
    expect(before).toMatchObject({
      turns: [
        {
          comments: [{ comment: WIDER }],
          followUps: [{ text: 'make it taller' }]
        }
      ],
      unsent: [{ comment: 'what is this?' }]
    })
    expect(session.pins.value).toMatchObject([
      { number: 1, locked: true, rect: { x: 700, y: 295 } },
      { number: 2, locked: false, rect: { x: 260, y: 384 } }
    ])
    expect(numberedComments(session.conversation.value)[0].followUps).toBe(1)
  })

  it('HS-01: a restored thread opens at its latest answer and takes a follow-up as before', () => {
    const first = pageWithHistory()
    const { host, session } = reload(first, first.storage)
    const width = settingAddress(host.nodes[1].id, 'width')
    const [asked] = session.conversation.value.turns[0].comments

    session.openPin(asked.id)
    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      replay: true,
      steps: [{ annotationId: asked.id, offerEdit: null }]
    })

    session.followUp('make it wider again')
    vi.advanceTimersByTime(FRAME_MS)

    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      replay: false,
      steps: [{ target: width, offerEdit: { target: width } }]
    })
    expect(session.conversation.value.turns[0].followUps).toHaveLength(2)
  })

  it('HS-16: after a reload a new question, a new turn and a new follow-up get ids of their own', () => {
    const first = pageWithHistory()
    const { session } = reload(first, first.storage)
    const idsBefore = numberedComments(session.conversation.value).map(
      (comment) => comment.annotation.id
    )

    ask(session, SAVE_NODE, 'and this one?')
    sendAndAnswer(session)
    session.followUp('make it taller')
    vi.advanceTimersByTime(FRAME_MS)

    const { turns, unsent } = session.conversation.value
    const ids = [
      ...turns.map((turn) => turn.id),
      ...turns.flatMap((turn) => turn.comments.map((comment) => comment.id)),
      ...turns.flatMap((turn) => turn.followUps.map((kept) => kept.id))
    ]
    expect(unsent).toEqual([])
    expect(turns).toHaveLength(2)
    expect(turns[1].comments.map((comment) => comment.comment)).toEqual([
      'what is this?',
      'and this one?'
    ])
    expect(new Set(ids).size).toBe(ids.length)
    expect(idsBefore).toHaveLength(2)
  })

  it('HS-05: the mode, an open answer, the panel and the live thinking do not come back', () => {
    const first = pageWithHistory()
    first.session.pressCaret()
    first.session.openPin(
      first.session.conversation.value.turns[0].comments[0].id
    )

    const { session } = reload(first, first.storage)

    expect(session.state.value).toEqual({ phase: 'idle' })
    expect(session.panelOpen.value).toBe(false)
    expect(session.thinking.value).toBeNull()
  })

  it('HS-06: a Send that was waiting is lost, and its questions are back as unsent', () => {
    const storage = fakeBrowserStorage()
    const model = fakeModel()
    const first = openPage(storage, { model: model.backend })
    ask(first.session, SAVE_NODE, WIDER)
    ask(first.session, WIDTH_ROW, 'what is this?')
    first.session.sendBatch()
    expect(first.session.state.value.phase).toBe('waiting')

    const { session } = reload(first, storage, { model: fakeModel().backend })

    expect(session.state.value).toEqual({ phase: 'idle' })
    expect(session.conversation.value).toMatchObject({
      turns: [],
      unsent: [{ comment: WIDER }, { comment: 'what is this?' }]
    })
  })

  it('HS-07: a follow-up that was waiting is lost, and its text is back as an unsent question on its thread’s target', () => {
    const storage = fakeBrowserStorage()
    const model = fakeModel()
    const first = openPage(storage, { model: model.backend })
    ask(first.session, SAVE_NODE, WIDER)
    const [asked] = first.session.conversation.value.unsent
    first.session.sendBatch()
    model.calls[0].answer({
      kind: 'reply',
      reply: {
        steps: [
          {
            annotationId: asked.id,
            text: 'Change width.',
            target: null,
            waitFor: null,
            offerEdit: null
          }
        ]
      }
    })
    first.session.followUp('and taller?')
    expect(first.session.state.value).toMatchObject({
      followUp: { status: 'waiting' }
    })

    const { session } = reload(first, storage, { model: fakeModel().backend })

    expect(session.conversation.value).toMatchObject({
      turns: [{ comments: [{ comment: WIDER }], followUps: [] }],
      unsent: [{ comment: 'and taller?', targets: asked.targets }]
    })
    expect(session.conversation.value.unsent[0].id).not.toBe(asked.id)
  })

  it('HS-07: once the follow-up is answered, nothing of it comes back as a question', () => {
    const first = pageWithHistory()

    const { session } = reload(first, first.storage)

    expect(session.conversation.value.unsent).toHaveLength(1)
  })

  it('HS-08: Start over deletes the workflow’s stored history', () => {
    const first = pageWithHistory()
    expect([...first.storage.entries.keys()]).toEqual([
      historyKey('workflow-w')
    ])

    first.session.startOver()

    expect(first.storage.entries.size).toBe(0)
    expect(reload(first, first.storage).session.conversation.value).toEqual({
      turns: [],
      unsent: []
    })
  })

  it('HS-09: Clear removes the unsent questions from the stored history too', () => {
    const first = pageWithHistory()

    first.session.clearUnsent()

    expect(
      reload(first, first.storage).session.conversation.value
    ).toMatchObject({ turns: [{}], unsent: [] })
  })

  it('HS-09: what the person did with an answer is stored as it happens', () => {
    const storage = fakeBrowserStorage()
    const first = openPage(storage)
    ask(first.session, SAVE_NODE, WIDER)
    sendAndAnswer(first.session)
    first.session.applyOfferedEdit()

    const { session } = reload(first, storage)

    expect(session.conversation.value.turns[0].steps[0]).toMatchObject({
      result: 'accepted',
      valueBefore: 1024
    })
  })

  it('HS-10: a stored entry that cannot be read leaves the layer empty and working', () => {
    const storage = fakeBrowserStorage()
    storage.entries.set(historyKey('workflow-w'), '{"version":1,"turns":[{}]}')
    const { session } = openPage(storage)

    expect(session.conversation.value).toEqual({ turns: [], unsent: [] })

    ask(session, WIDTH_ROW, 'what is this?')
    expect(session.conversation.value.unsent).toHaveLength(1)
    expect(
      reload({ close: () => undefined }, storage).session.conversation.value
        .unsent
    ).toHaveLength(1)
  })

  it('HS-17: when saving fails the session goes on in memory and says the history is not saved', () => {
    const storage = fakeBrowserStorage()
    storage.isFull = true
    const { session, history } = openPage(storage)

    ask(session, SAVE_NODE, WIDER)
    sendAndAnswer(session)

    expect(session.conversation.value.turns).toHaveLength(1)
    expect(history.unsaved.value).toBe(true)
    expect(storage.entries.size).toBe(0)
  })

  it('HS-13, HS-18: a session given no keeper reads and writes nothing in the browser', () => {
    const before = window.localStorage.length
    const host = createFakePointHost()
    host.workflow = 'workflow-w'
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const session = scope.run(() =>
      usePointSession(host, {
        config: { ...pointConfig, agent: 'scripted' },
        elementAt: () => null
      })
    )
    if (!session) throw new Error('The session scope is not active')

    ask(session, WIDTH_ROW, 'what is this?')

    expect(session.conversation.value.unsent).toHaveLength(1)
    expect(window.localStorage.length).toBe(before)
  })

  it('HS-18: what is stored names no request, no header and no key', () => {
    const { storage } = pageWithHistory()

    const stored = [...storage.entries.values()].join('\n')

    expect(stored).not.toMatch(/request|authorization|bearer|api[-_ ]?key|sk-/i)
  })
})

describe('usePointSession: the history follows the open workflow', () => {
  it('HS-02, HS-03: another workflow shows only its own history, and switching back shows the first one again', () => {
    const { host, session } = pageWithHistory()
    const ofW = session.conversation.value

    host.openWorkflow('workflow-v')
    vi.advanceTimersByTime(FRAME_MS)
    expect(session.conversation.value).toEqual({ turns: [], unsent: [] })
    expect(session.pins.value).toEqual([])

    ask(session, WIDTH_ROW, 'only in v')
    session.toggleAnnotate()
    host.openWorkflow('workflow-w')
    vi.advanceTimersByTime(FRAME_MS)
    expect(session.conversation.value).toEqual(ofW)
    expect(session.pins.value).toHaveLength(2)

    host.openWorkflow('workflow-v')
    expect(session.conversation.value).toMatchObject({
      turns: [],
      unsent: [{ comment: 'only in v' }]
    })
  })

  it('HS-02: each workflow’s history is stored under its own name', () => {
    const { host, session, storage } = pageWithHistory()

    host.openWorkflow('workflow-v')
    ask(session, WIDTH_ROW, 'only in v')

    expect(storage.entries.size).toBe(2)
    expect([...storage.entries.keys()]).toEqual(
      expect.arrayContaining([
        historyKey('workflow-v'),
        historyKey('workflow-w')
      ])
    )
    expect(storage.entries.get(historyKey('workflow-v'))).not.toContain(WIDER)
    expect(storage.entries.get(historyKey('workflow-w'))).not.toContain(
      'only in v'
    )
  })

  it.for<{ name: string; arrange: (session: Session) => void }>([
    { name: 'the mode', arrange: (session) => session.toggleAnnotate() },
    {
      name: 'an open box',
      arrange: (session) => {
        session.toggleAnnotate()
        session.pickAt(WIDTH_ROW)
      }
    },
    {
      name: 'an answer on screen',
      arrange: (session) =>
        session.openPin(session.conversation.value.turns[0].comments[0].id)
    }
  ])('HS-03: $name closes when the workflow changes', ({ arrange }) => {
    const { host, session } = pageWithHistory()
    arrange(session)
    expect(session.state.value.phase).not.toBe('idle')

    host.openWorkflow('workflow-v')

    expect(session.state.value).toEqual({ phase: 'idle' })
  })

  it('HS-03, HS-06: a Send waiting at the switch is aborted, its late reply is dropped, and its questions stay unsent in their workflow', () => {
    const model = fakeModel()
    const { host, session } = openPage(fakeBrowserStorage(), {
      model: model.backend
    })
    ask(session, SAVE_NODE, WIDER)
    const [asked] = session.conversation.value.unsent
    session.sendBatch()

    host.openWorkflow('workflow-v')
    model.calls[0].answer({
      kind: 'reply',
      reply: {
        steps: [
          {
            annotationId: asked.id,
            text: 'Change width.',
            target: null,
            waitFor: null,
            offerEdit: null
          }
        ]
      }
    })

    expect(model.calls[0].signal.aborted).toBe(true)
    expect(session.state.value).toEqual({ phase: 'idle' })
    expect(session.conversation.value).toEqual({ turns: [], unsent: [] })

    host.openWorkflow('workflow-w')
    expect(session.conversation.value).toMatchObject({
      turns: [],
      unsent: [{ comment: WIDER }]
    })
  })

  it('HS-03, HS-07: a follow-up waiting at the switch is aborted, and its text is an unsent question when its workflow is shown again', () => {
    const model = fakeModel()
    const { host, session } = openPage(fakeBrowserStorage(), {
      model: model.backend
    })
    ask(session, SAVE_NODE, WIDER)
    const [asked] = session.conversation.value.unsent
    session.sendBatch()
    model.calls[0].answer({
      kind: 'reply',
      reply: {
        steps: [
          {
            annotationId: asked.id,
            text: 'Change width.',
            target: null,
            waitFor: null,
            offerEdit: null
          }
        ]
      }
    })
    session.followUp('and taller?')

    host.openWorkflow('workflow-v')
    expect(model.calls[1].signal.aborted).toBe(true)
    expect(session.conversation.value).toEqual({ turns: [], unsent: [] })

    host.openWorkflow('workflow-w')
    expect(session.conversation.value).toMatchObject({
      turns: [{ followUps: [] }],
      unsent: [{ comment: 'and taller?' }]
    })
  })

  it('HS-04: with no workflow loaded nothing is stored, and that history is not carried into the workflow that loads', () => {
    const storage = fakeBrowserStorage()
    const { host, session } = openPage(storage, { workflow: null })

    ask(session, WIDTH_ROW, 'what is this?')
    expect(storage.entries.size).toBe(0)

    host.openWorkflow('workflow-w')
    expect(session.conversation.value).toEqual({ turns: [], unsent: [] })
    expect(storage.entries.size).toBe(0)
  })

  it('HS-01, HS-04: a page that starts before its workflow has loaded shows the history once it has', () => {
    const first = pageWithHistory()
    const { host, session } = reload(first, first.storage, { workflow: null })
    expect(session.conversation.value).toEqual({ turns: [], unsent: [] })

    host.openWorkflow('workflow-w')
    vi.advanceTimersByTime(FRAME_MS)

    expect(session.conversation.value.turns).toHaveLength(1)
    expect(session.pins.value).toHaveLength(2)
  })
})

describe('usePointSession: pins on interface elements after a reload', () => {
  const RUN_RECT = new DOMRect(1180, 8, 80, 32)
  const RUN_POINT: Point = { x: 1200, y: 20 }
  const RUN_MARKUP =
    '<div role="toolbar" aria-label="Actions"><button aria-label="Run" data-testid="queue-button"><i></i></button></div>'

  function drawRunButton(rect: DOMRect) {
    document.body.innerHTML = RUN_MARKUP
    const button = document.querySelector('button')
    const icon = document.querySelector('i')
    if (!button || !icon) throw new Error('The Run button was not created')
    button.getBoundingClientRect = () => rect
    return icon
  }

  function pageWithElementPin() {
    const storage = fakeBrowserStorage()
    const icon = drawRunButton(RUN_RECT)
    const first = openPage(storage, { elementAt: () => icon })
    ask(first.session, RUN_POINT, 'what is this?')
    first.session.toggleAnnotate()
    return { storage, first }
  }

  it('HS-15: the pin is found again by what the element is, and sits where the element is now', () => {
    const { storage, first } = pageWithElementPin()
    first.close()
    drawRunButton(new DOMRect(900, 8, 80, 32))

    const { session } = openPage(storage)
    vi.advanceTimersByTime(FRAME_MS)

    expect(session.pins.value).toMatchObject([
      { number: 1, rect: { x: 900, y: 8 }, missing: false }
    ])
  })

  it('HS-15: when the element is not on the page the pin is not drawn anywhere, and is not said to be gone from the workflow', () => {
    const { storage, first } = pageWithElementPin()
    first.close()
    document.body.innerHTML = ''

    const { session } = openPage(storage)
    vi.advanceTimersByTime(FRAME_MS)

    expect(session.pins.value).toMatchObject([
      { number: 1, rect: null, missing: false }
    ])
  })

  it('HS-15: a pin restored for one workflow never lands on an element that was marked in another', () => {
    const { storage, first } = pageWithElementPin()
    first.close()
    document.body.innerHTML = `<button aria-label="Save" data-testid="save-button"></button>${RUN_MARKUP}`
    const [save, run] = document.querySelectorAll('button')
    save.getBoundingClientRect = () => new DOMRect(40, 8, 80, 32)
    run.getBoundingClientRect = () => RUN_RECT
    const { host, session } = openPage(storage, {
      workflow: 'workflow-v',
      elementAt: () => save
    })
    ask(session, { x: 60, y: 20 }, 'and this?')
    session.toggleAnnotate()
    vi.advanceTimersByTime(FRAME_MS)
    expect(session.pins.value).toMatchObject([{ rect: { x: 40, y: 8 } }])

    host.openWorkflow('workflow-w')
    vi.advanceTimersByTime(FRAME_MS)

    expect(session.pins.value).toMatchObject([
      { number: 1, rect: { x: 1180, y: 8 } }
    ])
  })

  it('HS-15, HS-16: an element marked after a reload is not confused with a restored one', () => {
    const { storage, first } = pageWithElementPin()
    first.close()
    document.body.innerHTML =
      '<button aria-label="Save" data-testid="save-button"></button>'
    const save = document.querySelector('button')
    if (!save) throw new Error('The Save button was not created')
    save.getBoundingClientRect = () => new DOMRect(40, 8, 80, 32)

    const { session } = openPage(storage, { elementAt: () => save })
    ask(session, { x: 60, y: 20 }, 'and this?')
    vi.advanceTimersByTime(FRAME_MS)

    expect(session.pins.value).toMatchObject([
      { number: 1, rect: null },
      { number: 2, rect: { x: 40, y: 8 } }
    ])
  })
})
