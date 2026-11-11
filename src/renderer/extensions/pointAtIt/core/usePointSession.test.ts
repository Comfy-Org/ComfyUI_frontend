import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope } from 'vue'

import type { AgentBackend } from './agentBackends'
import type { AgentRequest } from './agentReply'
import { pointConfig } from './config'
import type { PointConfig } from './config'
import { createFakePointHost, settingAddress } from './fakePointHost'
import type { Point } from './geometry'
import { MARK_KEY, messages, problems } from './messages'
import type { AgentOutcome } from './modelReply'
import { SURFACE_ATTRIBUTE, usePointSession } from './usePointSession'
import { SETTLE_MS } from './valueWatch'

const FRAME_MS = 16
const REPLY_MS = pointConfig.scripted.replyDelayMs
const WIDTH_ROW: Point = { x: 300, y: 392 }
const SAVE_NODE: Point = { x: 800, y: 480 }
const EMPTY_CANVAS: Point = { x: 40, y: 600 }

type Session = ReturnType<typeof usePointSession>

interface SessionSetup {
  host?: ReturnType<typeof createFakePointHost>
  config?: Partial<PointConfig>
  model?: AgentBackend
  elementAt?: (point: Point) => Element | null
}

function startSession(setup: SessionSetup = {}) {
  const host = setup.host ?? createFakePointHost()
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const session = scope.run(() =>
    usePointSession(host, {
      config: { ...pointConfig, agent: 'scripted', ...setup.config },
      model: setup.model,
      elementAt: setup.elementAt ?? (() => null)
    })
  )
  if (!session) throw new Error('The session scope is not active')
  return { host, session }
}

function fakeModel() {
  const calls: {
    request: AgentRequest
    signal: AbortSignal
    think: (text: string) => void
    answer: (outcome: AgentOutcome) => void
  }[] = []
  const backend: AgentBackend = {
    ask(request, _nodes, { signal, onThinking, onOutcome }) {
      calls.push({ request, signal, think: onThinking, answer: onOutcome })
    }
  }
  return { backend, calls }
}

function pageWith(markup: string, rect: DOMRect) {
  document.body.innerHTML = markup
  const element = document.body.firstElementChild
  if (!element) throw new Error('The page element was not created')
  element.getBoundingClientRect = () => rect
  return element
}

function press(key: string, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true
  })
  target.dispatchEvent(event)
  return event
}

function release(key: string) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }))
}

function tap(key: string) {
  press(key)
  release(key)
}

function comment(session: Session, point: Point, text: string) {
  if (session.state.value.phase !== 'annotating') session.toggleAnnotate()
  session.pickAt(point)
  session.saveDraft(text)
}

function startGuidance(text: string, host = createFakePointHost()) {
  const started = startSession({
    host,
    config: { scripted: { replyDelayMs: 0, wrongTarget: false } }
  })
  comment(started.session, SAVE_NODE, text)
  started.session.sendBatch()
  vi.advanceTimersByTime(FRAME_MS)
  return started
}

function stepIndex(session: Session) {
  const state = session.state.value
  return state.phase === 'guiding' ? state.index : state.phase
}

describe('usePointSession: annotation mode', () => {
  it('AN-01, AN-08, H-01: the key turns the mode on and off, and holding it starts no stroke', () => {
    const { session } = startSession()

    press(MARK_KEY)
    session.pressPointer(WIDTH_ROW)
    expect(session.state.value).toEqual({ phase: 'annotating', draft: null })

    release(MARK_KEY)
    tap(MARK_KEY)
    expect(session.state.value.phase).toBe('idle')
  })

  it.for([
    { name: 'an input', markup: '<input />' },
    { name: 'a textarea', markup: '<textarea></textarea>' },
    { name: 'editable text', markup: '<p contenteditable="true"></p>' }
  ])('AN-18: the key typed in $name is left alone', ({ markup }) => {
    const { session } = startSession()
    document.body.innerHTML = markup
    const field = document.body.firstElementChild
    if (!field) throw new Error('The text field was not created')

    const typed = press(MARK_KEY, field)

    expect(session.state.value.phase).toBe('idle')
    expect(typed.defaultPrevented).toBe(false)
  })

  it('still toggles the mode when a checkbox has focus', () => {
    const { session } = startSession()
    document.body.innerHTML = '<input type="checkbox" />'
    const checkbox = document.body.firstElementChild
    if (!checkbox) throw new Error('The checkbox was not created')

    press(MARK_KEY, checkbox)

    expect(session.state.value.phase).toBe('annotating')
  })

  it('AN-02: outlines the setting, then the node, then nothing as the pointer moves', () => {
    const { session } = startSession()
    session.toggleAnnotate()
    const outlined: unknown[] = []

    for (const point of [WIDTH_ROW, SAVE_NODE, EMPTY_CANVAS]) {
      session.movePointer(point)
      vi.advanceTimersByTime(FRAME_MS)
      outlined.push(session.hover.value?.label ?? null)
    }

    expect(outlined).toEqual(['Empty Latent Image › width', 'Save Image', null])
  })

  it('AN-03: a click opens a comment box on what is under the pointer, and nothing on empty canvas', () => {
    const { host, session } = startSession()
    session.toggleAnnotate()

    session.pickAt(EMPTY_CANVAS)
    expect(session.state.value).toEqual({ phase: 'annotating', draft: null })

    session.pickAt(WIDTH_ROW)
    expect(session.state.value).toEqual({
      phase: 'annotating',
      draft: {
        annotationId: null,
        targets: [settingAddress(host.nodes[1].id, 'width')],
        label: 'Empty Latent Image › width',
        comment: ''
      }
    })
    expect(session.draftAnchor.value).toEqual({
      x: 260,
      y: 384,
      width: 180,
      height: 18
    })
  })

  it('AN-04: a wheel event goes on to the canvas and the outline follows the moved node', () => {
    const { host, session } = startSession()
    session.toggleAnnotate()
    session.movePointer(SAVE_NODE)
    vi.advanceTimersByTime(FRAME_MS)
    const wheel = new WheelEvent('wheel', { deltaY: 40 })

    host.nodes[2].rect = { x: 760, y: 440, width: 95, height: 100 }
    session.passWheel(wheel)
    vi.advanceTimersByTime(FRAME_MS)

    expect(host.forwardedWheels).toEqual([wheel])
    expect(session.hover.value?.rect).toEqual({
      x: 760,
      y: 440,
      width: 95,
      height: 100
    })
  })

  it('AN-05: saving stores the comment, pins it with its number and keeps the mode on', () => {
    const { host, session } = startSession()

    comment(session, WIDTH_ROW, 'make this wider')
    comment(session, SAVE_NODE, 'what is this?')

    expect(session.state.value).toEqual({ phase: 'annotating', draft: null })
    expect(session.conversation.value.unsent).toMatchObject([
      {
        targets: [settingAddress(host.nodes[1].id, 'width')],
        label: 'Empty Latent Image › width',
        comment: 'make this wider'
      },
      { label: 'Save Image', comment: 'what is this?' }
    ])
    expect(session.pins.value).toMatchObject([
      { number: 1, rect: { x: 260, y: 384, width: 180, height: 18 } },
      { number: 2, rect: { x: 700, y: 295, width: 190, height: 200 } }
    ])
  })

  it('AN-06: saving with no text stores nothing and keeps the box', () => {
    const { session } = startSession()

    comment(session, WIDTH_ROW, '   ')

    expect(session.conversation.value.unsent).toEqual([])
    expect(session.state.value).toMatchObject({
      draft: { label: 'Empty Latent Image › width' }
    })
  })

  it('AN-07, AN-08: Esc closes only the box, a second Esc leaves the mode, and the comments stay', () => {
    const { session } = startSession()
    comment(session, WIDTH_ROW, 'make this wider')
    session.pickAt(SAVE_NODE)

    const first = press('Escape')
    expect(session.state.value).toEqual({ phase: 'annotating', draft: null })

    press('Escape')
    expect(session.state.value.phase).toBe('idle')
    expect(first.defaultPrevented).toBe(true)
    expect(session.conversation.value.unsent).toHaveLength(1)
    expect(press('Escape').defaultPrevented).toBe(false)
  })

  it('AN-09: a pin reopens its comment to edit it, or to delete it and renumber the rest', () => {
    const { session } = startSession()
    comment(session, WIDTH_ROW, 'make this wider')
    comment(session, SAVE_NODE, 'what is this?')
    session.toggleAnnotate()
    const [first, second] = session.conversation.value.unsent

    session.openPin(second.id)
    expect(session.state.value).toMatchObject({
      phase: 'annotating',
      draft: { annotationId: second.id, comment: 'what is this?' }
    })

    session.saveDraft('what does this do?')
    session.openPin(first.id)
    session.deleteDraft()

    expect(session.conversation.value.unsent).toMatchObject([
      { id: second.id, comment: 'what does this do?' }
    ])
    expect(session.pins.value).toMatchObject([{ id: second.id, number: 1 }])
  })

  it('AN-10: entering with nodes selected opens one comment on the selection', () => {
    const { host, session } = startSession()
    host.selection = [host.nodes[1].id, host.nodes[2].id]

    tap(MARK_KEY)
    session.saveDraft('why are these connected?')

    expect(session.conversation.value.unsent).toMatchObject([
      {
        targets: [
          { kind: 'node', nodeId: host.nodes[1].id },
          { kind: 'node', nodeId: host.nodes[2].id }
        ],
        label: 'Empty Latent Image, Save Image'
      }
    ])
    expect(session.pins.value).toMatchObject([
      { rect: { x: 260, y: 295, width: 630, height: 200 } }
    ])
    expect(host.selection).toHaveLength(2)
  })

  it('AN-11: pins follow their targets, and a pin whose target is deleted is not drawn', () => {
    const { host, session } = startSession()
    comment(session, WIDTH_ROW, 'make this wider')
    comment(session, SAVE_NODE, 'what is this?')

    host.nodes[1].settings[0].rect = { x: 60, y: 84, width: 90, height: 9 }
    host.removeNode(host.nodes[2].id)
    vi.advanceTimersByTime(FRAME_MS)

    expect(session.pins.value).toMatchObject([
      { rect: { x: 60, y: 84, width: 90, height: 9 }, missing: false },
      { rect: null, missing: true }
    ])
  })

  it('AN-12, AN-16: Send ends the mode, waits, then answers every comment in one guided sequence', () => {
    const { host, session } = startSession()
    comment(session, SAVE_NODE, 'make this wider')
    comment(session, WIDTH_ROW, 'what is this?')
    const [first, second] = session.conversation.value.unsent

    session.sendBatch()
    expect(session.state.value).toMatchObject({ phase: 'waiting', asked: null })

    vi.advanceTimersByTime(2000)
    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      index: 0,
      steps: [
        {
          annotationId: first.id,
          target: settingAddress(host.nodes[1].id, 'width')
        },
        { annotationId: second.id },
        { annotationId: null, target: { kind: 'control', control: 'run' } }
      ]
    })
    expect(session.pins.value).toHaveLength(2)
  })

  it('AN-13: Send with no comments does nothing', () => {
    const { session } = startSession()
    session.toggleAnnotate()

    session.sendBatch()

    expect(session.state.value.phase).toBe('annotating')
  })

  it('TU-07: Clear removes the unsent comments and their pins', () => {
    const { session } = startSession()
    comment(session, WIDTH_ROW, 'make this wider')

    session.clearUnsent()

    expect(session.conversation.value.unsent).toEqual([])
    expect(session.pins.value).toEqual([])
  })

  it('AN-15, AN-19: while waiting nothing can be changed, and after Cancel the late reply never shows', () => {
    const { session } = startSession()
    comment(session, WIDTH_ROW, 'make this wider')
    session.sendBatch()

    session.toggleAnnotate()
    session.clearUnsent()
    session.openPin(session.conversation.value.unsent[0].id)
    expect(session.state.value.phase).toBe('waiting')

    session.dismiss()
    vi.advanceTimersByTime(2000)

    expect(session.state.value.phase).toBe('idle')
    expect(session.conversation.value.unsent).toHaveLength(1)
  })

  it('TU-01: once answered, the comments are locked into a turn and cannot be sent or edited again', () => {
    const { session } = startGuidance('what is this?')
    const [turn] = session.conversation.value.turns

    session.finish()
    session.sendBatch()
    session.openPin(turn.comments[0].id)

    expect(session.conversation.value).toMatchObject({
      turns: [{ comments: [{ comment: 'what is this?' }] }],
      unsent: []
    })
    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      replay: true
    })
  })

  it('L-02: a step whose node was deleted while waiting is shown without a target and says so', () => {
    const { host, session } = startSession()
    comment(session, SAVE_NODE, 'make this wider')
    const latentId = host.nodes[1].id
    session.sendBatch()

    host.removeNode(latentId)
    vi.advanceTimersByTime(2000)

    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      steps: [
        {
          target: null,
          offerEdit: null,
          problems: [problems.unknownSetting(settingAddress(latentId, 'width'))]
        },
        {}
      ]
    })
  })
})

describe('usePointSession: showing what a comment points to', () => {
  it('U-02: opening a comment rings its target and leaves the canvas alone when the target is in view', () => {
    const { host, session } = startSession()
    comment(session, WIDTH_ROW, 'make this wider')

    session.openPin(session.conversation.value.unsent[0].id)

    expect(session.draftAnchor.value).toEqual({
      x: 260,
      y: 384,
      width: 180,
      height: 18
    })
    expect(host.revealed).toEqual([])
  })

  it('U-02: opening a comment whose target is out of view brings the target into view', () => {
    const { host, session } = startSession()
    comment(session, WIDTH_ROW, 'make this wider')
    host.nodes[1].settings[0].rect = { x: 3000, y: 384, width: 180, height: 18 }

    session.openPin(session.conversation.value.unsent[0].id)

    expect(host.revealed).toEqual([settingAddress(host.nodes[1].id, 'width')])
  })

  it('U-03: a comment whose target was deleted still opens, with nothing to ring', () => {
    const { host, session } = startSession()
    comment(session, WIDTH_ROW, 'make this wider')
    host.removeNode(host.nodes[1].id)

    session.openPin(session.conversation.value.unsent[0].id)
    vi.advanceTimersByTime(FRAME_MS)

    expect(session.state.value).toMatchObject({
      draft: { comment: 'make this wider' }
    })
    expect(session.draftAnchor.value).toBeNull()
    expect(session.pins.value).toMatchObject([{ rect: null, missing: true }])
  })
})

describe('usePointSession: interface elements', () => {
  const RUN_RECT = new DOMRect(1180, 8, 80, 32)
  const RUN_POINT: Point = { x: 1200, y: 20 }
  const RUN_MARKUP =
    '<div role="toolbar" aria-label="Actions"><button aria-label="Run" data-testid="queue-button"><i></i></button></div>'

  function startOnPage() {
    pageWith(RUN_MARKUP, new DOMRect(0, 0, 0, 0))
    const button = document.querySelector('button')
    const icon = document.querySelector('i')
    if (!button || !icon) throw new Error('The Run button was not created')
    button.getBoundingClientRect = () => RUN_RECT
    const started = startSession({
      elementAt: (point) => (point.y < 60 ? icon : null)
    })
    started.session.toggleAnnotate()
    return { ...started, button }
  }

  it('E-01: outlines the interface element under the pointer, and nodes as before', () => {
    const { session } = startOnPage()
    const outlined: unknown[] = []

    for (const point of [RUN_POINT, WIDTH_ROW]) {
      session.movePointer(point)
      vi.advanceTimersByTime(FRAME_MS)
      outlined.push(session.hover.value)
    }

    expect(outlined).toMatchObject([
      {
        label: 'Run',
        rect: { x: 1180, y: 8, width: 80, height: 32 },
        address: { kind: 'element', role: 'button' }
      },
      { label: 'Empty Latent Image › width' }
    ])
  })

  it('E-02: a click opens a comment on the element, addressed with its label, role, surroundings and test id', () => {
    const { session } = startOnPage()

    session.pickAt(RUN_POINT)

    expect(session.state.value).toEqual({
      phase: 'annotating',
      draft: {
        annotationId: null,
        targets: [
          {
            kind: 'element',
            elementId: 'element-1',
            label: 'Run',
            role: 'button',
            context: 'toolbar "Actions"',
            testId: 'queue-button'
          }
        ],
        label: 'Run',
        comment: ''
      }
    })
  })

  it('E-03: the pin follows the element, hides while it is not on screen, and returns when it is drawn again', () => {
    const { session, button } = startOnPage()
    session.pickAt(RUN_POINT)
    session.saveDraft('what is this?')
    const shown: unknown[] = [session.pins.value[0].rect]

    button.getBoundingClientRect = () => new DOMRect(900, 8, 80, 32)
    vi.advanceTimersByTime(FRAME_MS)
    shown.push(session.pins.value[0].rect)

    document.body.innerHTML = ''
    vi.advanceTimersByTime(FRAME_MS)
    shown.push(session.pins.value[0])

    const redrawn = pageWith(RUN_MARKUP, new DOMRect(0, 0, 0, 0))
    const again = redrawn.querySelector('button')
    if (again) again.getBoundingClientRect = () => RUN_RECT
    vi.advanceTimersByTime(600)
    shown.push(session.pins.value[0].rect)

    expect(shown).toMatchObject([
      { x: 1180, y: 8 },
      { x: 900, y: 8 },
      { rect: null, missing: false },
      { x: 1180, y: 8 }
    ])
  })

  it('AN-04: a wheel over the interface is not sent to the canvas', () => {
    const panel = pageWith('<aside></aside>', new DOMRect(0, 0, 300, 800))
    const { host, session } = startSession({ elementAt: () => panel })
    session.toggleAnnotate()

    session.passWheel(new WheelEvent('wheel', { deltaY: 40 }))

    expect(host.forwardedWheels).toEqual([])
  })

  it('E-04: a press on the layer’s surface picks what is under it and never reaches the page', () => {
    const { session } = startOnPage()
    const surface = document.createElement('div')
    surface.setAttribute(SURFACE_ATTRIBUTE, '')
    document.body.append(surface)
    const pageSawPress = vi.fn()
    document.addEventListener('pointerdown', pageSawPress)
    onTestFinished(() =>
      document.removeEventListener('pointerdown', pageSawPress)
    )

    const press = new MouseEvent('pointerdown', {
      clientX: RUN_POINT.x,
      clientY: RUN_POINT.y,
      bubbles: true,
      cancelable: true
    })
    surface.dispatchEvent(press)

    expect(session.state.value).toMatchObject({ draft: { label: 'Run' } })
    expect(press.defaultPrevented).toBe(true)
    expect(pageSawPress).not.toHaveBeenCalled()
  })

  it('E-04: focus moving into the layer’s comment box is kept from the page, other focus changes are not', () => {
    startSession()
    document.body.innerHTML =
      '<div data-point-at-it-layer><textarea></textarea></div><input />'
    const pageSawFocus = vi.fn()
    document.addEventListener('focusin', pageSawFocus)
    onTestFinished(() => document.removeEventListener('focusin', pageSawFocus))

    document.querySelector('textarea')?.focus()
    expect(pageSawFocus).not.toHaveBeenCalled()

    document.querySelector('input')?.focus()
    expect(pageSawFocus).toHaveBeenCalledTimes(1)
  })

  it('E-05, E-06: the scripted agent answers a comment on an element by pointing at that element', () => {
    const { session } = startOnPage()
    session.pickAt(RUN_POINT)
    session.saveDraft('what is this?')

    session.sendBatch()
    vi.advanceTimersByTime(2000 + 600)

    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      steps: [{ target: { kind: 'element', elementId: 'element-1' } }]
    })
    expect(session.view.value).toEqual({
      ring: { x: 1180, y: 8, width: 80, height: 32 },
      pointer: { x: 1220, y: 40 },
      landed: true
    })
  })
})

describe('usePointSession: the real model', () => {
  const reply = {
    steps: [
      {
        annotationId: 'comment-1',
        text: 'Raise width.',
        target: { kind: 'node', nodeId: '5' },
        waitFor: null,
        offerEdit: null
      }
    ]
  }

  function startWithModel(showThinking = true) {
    const model = fakeModel()
    const started = startSession({
      config: {
        agent: 'model',
        model: { ...pointConfig.model, showThinking }
      },
      model: model.backend
    })
    comment(started.session, SAVE_NODE, 'make this wider')
    started.session.sendBatch()
    return { ...started, calls: model.calls }
  }

  it('L-01, T-01: thinking shows while waiting, and the reply starts guidance with no added delay', () => {
    const { session, calls } = startWithModel()

    calls[0].think('Checking the width. ')
    calls[0].think('It is on Empty Latent Image.')
    expect(session.state.value.phase).toBe('waiting')
    expect(session.thinking.value).toMatchObject({
      text: 'Checking the width. It is on Empty Latent Image.',
      done: false
    })

    calls[0].answer({ kind: 'reply', reply })

    expect(session.state.value).toMatchObject({ phase: 'guiding', index: 0 })
  })

  it('T-03, TU-10: the thinking stays with its turn through Clear and goes with Start over', () => {
    const { session, calls } = startWithModel()
    calls[0].think('Checking the width.')
    calls[0].answer({ kind: 'reply', reply })
    session.finish()
    session.clearUnsent()

    expect(session.thinking.value).toMatchObject({
      text: 'Checking the width.',
      done: true
    })
    expect(session.conversation.value.turns).toMatchObject([
      { thinking: 'Checking the width.' }
    ])

    session.startOver()
    expect(session.thinking.value).toBeNull()
  })

  it('T-04: a reply with no thinking leaves an empty, finished log', () => {
    const { session, calls } = startWithModel()

    calls[0].answer({ kind: 'reply', reply })

    expect(session.thinking.value).toMatchObject({ text: '', done: true })
  })

  it.for([
    {
      name: 'the scripted agent',
      agent: 'scripted' as const,
      showThinking: true
    },
    {
      name: 'thinking switched off',
      agent: 'model' as const,
      showThinking: false
    }
  ])('T-05, T-06: keeps no thinking with $name', ({ agent, showThinking }) => {
    const model = fakeModel()
    const { session } = startSession({
      config: { agent, model: { ...pointConfig.model, showThinking } },
      model: model.backend
    })
    comment(session, SAVE_NODE, 'make this wider')

    session.sendBatch()
    model.calls.at(0)?.think('unwanted')

    expect(session.thinking.value).toBeNull()
  })

  it.for<AgentOutcome>([
    { kind: 'failure', failure: { kind: 'provider', detail: 'status 500' } },
    { kind: 'failure', failure: { kind: 'proxyDown', detail: '' } },
    { kind: 'failure', failure: { kind: 'timeout', detail: '60' } },
    { kind: 'failure', failure: { kind: 'noKey', detail: 'no key' } },
    { kind: 'reply', reply: 'not the reply format' }
  ])(
    'L-04 to L-07, L-10: $failure.kind $kind keeps the comments and can be retried',
    (outcome) => {
      const { session, calls } = startWithModel()

      calls[0].answer(outcome)

      expect(session.state.value.phase).toBe('failed')
      expect(session.conversation.value.unsent).toHaveLength(1)

      session.retry()

      expect(session.state.value.phase).toBe('waiting')
      expect(calls).toHaveLength(2)
    }
  )

  it('L-08, L-09: Cancel aborts the call, clears its thinking, and a late reply never shows', () => {
    const { session, calls } = startWithModel()
    calls[0].think('Checking the width.')

    session.dismiss()
    calls[0].answer({ kind: 'reply', reply })

    expect(calls[0].signal.aborted).toBe(true)
    expect(session.state.value.phase).toBe('idle')
    expect(session.thinking.value).toBeNull()
    expect(session.conversation.value.unsent).toHaveLength(1)
  })
})

describe('usePointSession: turns', () => {
  const WIDER = 'how do I make this wider?'

  function answeredTurn(host = createFakePointHost()) {
    const started = startGuidance(WIDER, host)
    const width = settingAddress(started.host.nodes[1].id, 'width')
    return { ...started, width }
  }

  it('TU-02, TU-03: the next comment starts the next turn; earlier pins stay, marked as locked, and numbers continue', () => {
    const { session } = answeredTurn()
    session.finish()

    comment(session, WIDTH_ROW, 'a bit more than that')

    expect(session.conversation.value).toMatchObject({
      turns: [{ comments: [{ comment: WIDER }] }],
      unsent: [{ comment: 'a bit more than that' }]
    })
    expect(session.pins.value).toMatchObject([
      { number: 1, locked: true, rect: { x: 700, y: 295 } },
      { number: 2, locked: false, rect: { x: 260, y: 384 } }
    ])
  })

  it('TS-01: a turn keeps the time its Send was made, not the time the reply came', () => {
    const { session } = startSession({
      config: { scripted: { replyDelayMs: 500, wrongTarget: false } }
    })
    comment(session, SAVE_NODE, WIDER)
    const sentAt = Date.now()

    session.sendBatch()
    vi.advanceTimersByTime(900)

    expect(session.conversation.value.turns).toMatchObject([{ sentAt }])
  })

  it('TU-04, TU-05: the second Send carries only the new comment, with the first turn as history and what the person did', () => {
    const model = fakeModel()
    const { host, session } = startSession({
      config: { agent: 'model' },
      model: model.backend
    })
    const width = settingAddress(host.nodes[1].id, 'width')
    comment(session, SAVE_NODE, WIDER)
    session.sendBatch()
    model.calls[0].answer({
      kind: 'reply',
      reply: {
        steps: [
          {
            annotationId: session.conversation.value.unsent[0].id,
            text: 'Change width to 1280.',
            target: width,
            waitFor: { for: 'valueChange', of: width, direction: 'increase' },
            offerEdit: { target: width, value: 1280 }
          }
        ]
      }
    })
    session.applyOfferedEdit()

    comment(session, WIDTH_ROW, 'a bit more than that')
    session.sendBatch()

    expect(model.calls[1].request).toMatchObject({
      kind: 'batch',
      annotations: [{ comment: 'a bit more than that' }],
      history: [
        {
          comments: [{ comment: WIDER }],
          answer: [
            {
              text: 'Change width to 1280.',
              target: width,
              offered: { target: width, value: 1280 },
              result: 'accepted',
              valueBefore: 1024
            }
          ]
        }
      ]
    })
  })

  it('TU-05: records that the person changed the value themselves, and from what', () => {
    const { host, session, width } = answeredTurn()

    host.setValue(width, 1280)
    vi.advanceTimersByTime(SETTLE_MS + FRAME_MS * 4)

    expect(session.conversation.value.turns[0].steps[0]).toMatchObject({
      result: 'changed',
      valueBefore: 1024
    })
  })

  it('TH-11: a locked comment opens its thread at the latest answer, for reading, bringing the target into view', () => {
    const { host, session, width } = answeredTurn()
    session.finish()
    host.nodes[1].settings[0].rect = { x: 3000, y: 384, width: 180, height: 18 }

    session.openPin(session.conversation.value.turns[0].comments[0].id)
    host.setValue(width, 2048)
    vi.advanceTimersByTime(SETTLE_MS + FRAME_MS * 4)

    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      replay: true,
      index: 0,
      steps: [{ target: width, waitFor: null, offerEdit: null }]
    })
    expect(host.revealed).toEqual([width])
    expect(session.conversation.value.turns[0].steps[0].result).toBeNull()
  })

  it('TH-11: says so when what the earlier answer pointed at is gone', () => {
    const { host, session } = answeredTurn()
    session.finish()
    host.removeNode(host.nodes[1].id)

    session.openPin(session.conversation.value.turns[0].comments[0].id)

    expect(session.state.value).toMatchObject({
      replay: true,
      steps: [{ target: null, problems: [messages.replayTargetGone] }]
    })
  })

  it('TU-07, TU-08: Clear keeps earlier turns; Start over removes everything', () => {
    const { session } = answeredTurn()
    session.finish()
    comment(session, WIDTH_ROW, 'a bit more than that')

    session.clearUnsent()
    expect(session.conversation.value).toMatchObject({
      turns: [{ comments: [{ comment: WIDER }] }],
      unsent: []
    })
    expect(session.pins.value).toHaveLength(1)

    session.startOver()
    expect(session.conversation.value).toEqual({ turns: [], unsent: [] })
    expect(session.pins.value).toEqual([])
  })

  it('TU-09: a failed Send leaves the turn open and its comments editable', () => {
    const model = fakeModel()
    const { session } = startSession({
      config: { agent: 'model' },
      model: model.backend
    })
    comment(session, SAVE_NODE, WIDER)
    session.sendBatch()

    model.calls[0].answer({
      kind: 'failure',
      failure: { kind: 'proxyDown', detail: '' }
    })
    session.openPin(session.conversation.value.unsent[0].id)
    session.saveDraft('make this taller')

    expect(session.conversation.value).toMatchObject({
      turns: [],
      unsent: [{ comment: 'make this taller' }]
    })
  })

  it('TU-11: the scripted agent answers a second turn', () => {
    const { session } = answeredTurn()
    session.finish()
    comment(session, WIDTH_ROW, 'what is this?')

    session.sendBatch()
    vi.advanceTimersByTime(FRAME_MS)

    expect(session.conversation.value.turns).toHaveLength(2)
    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      replay: false,
      steps: [
        { annotationId: session.conversation.value.turns[1].comments[0].id }
      ]
    })
  })
})

describe('usePointSession: follow-ups inside an answer', () => {
  const WIDER = 'how do I make this wider?'

  function answeredByModel() {
    const model = fakeModel()
    const { host, session } = startSession({
      config: { agent: 'model' },
      model: model.backend
    })
    const width = settingAddress(host.nodes[1].id, 'width')
    const height = settingAddress(host.nodes[1].id, 'height')
    comment(session, SAVE_NODE, WIDER)
    const commentId = session.conversation.value.unsent[0].id
    session.sendBatch()
    model.calls[0].answer({
      kind: 'reply',
      reply: {
        steps: [
          {
            annotationId: commentId,
            text: 'Change width to 1280.',
            target: width,
            waitFor: { for: 'valueChange', of: width, direction: 'increase' },
            offerEdit: { target: width, value: 1280 }
          },
          {
            annotationId: null,
            text: 'Now run it.',
            target: { kind: 'control', control: 'run' },
            waitFor: { for: 'run' },
            offerEdit: null
          }
        ]
      }
    })
    function reply(call: number, annotationId: string | null = commentId) {
      model.calls[call].answer({
        kind: 'reply',
        reply: {
          steps: [
            {
              annotationId,
              text: 'Then make it taller too: height to 1280.',
              target: height,
              waitFor: {
                for: 'valueChange',
                of: height,
                direction: 'increase'
              },
              offerEdit: { target: height, value: 1280 }
            }
          ]
        }
      })
    }
    return { host, session, model, width, height, commentId, reply }
  }

  function followUps(session: Session) {
    return session.conversation.value.turns.flatMap((turn) => turn.followUps)
  }

  it('TH-03, TH-13: a follow-up is sent on its own with its thread, and starts no turn', () => {
    const { session, model, width, commentId } = answeredByModel()

    session.followUp('  a bit more than that ')

    expect(model.calls[1].request).toEqual({
      kind: 'followUp',
      requestId: expect.any(String),
      comment: expect.objectContaining({ id: commentId, comment: WIDER }),
      thread: [
        {
          from: 'agent',
          steps: [
            {
              annotationId: commentId,
              text: 'Change width to 1280.',
              target: width,
              offered: { target: width, value: 1280 },
              result: null,
              valueBefore: null
            }
          ]
        }
      ],
      followUp: 'a bit more than that',
      history: [
        {
          comments: [],
          answer: [expect.objectContaining({ text: 'Now run it.' })],
          followUps: []
        }
      ]
    })
    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      index: 0,
      followUp: { status: 'waiting', text: 'a bit more than that' }
    })
    expect(session.conversation.value.turns).toHaveLength(1)
  })

  it('TH-02: a step that answers no question takes no follow-up', () => {
    const { session, model } = answeredByModel()
    session.applyOfferedEdit()

    session.followUp('why?')

    expect(stepIndex(session)).toBe(1)
    expect(model.calls).toHaveLength(1)
  })

  it('TH-04: while a follow-up waits its thinking streams and the step holds, then goes on once the wait ends', () => {
    const { host, session, model, width } = answeredByModel()
    session.followUp('why 1280?')

    model.calls[1].think('Looking at the width.')
    host.setValue(width, 1280)
    vi.advanceTimersByTime(SETTLE_MS + FRAME_MS * 4)

    expect(session.thinking.value).toMatchObject({
      text: 'Looking at the width.',
      done: false
    })
    expect(stepIndex(session)).toBe(0)
    expect(session.conversation.value.turns[0].steps[0].result).toBeNull()

    session.cancelFollowUp()
    vi.advanceTimersByTime(SETTLE_MS + FRAME_MS * 4)

    expect(stepIndex(session)).toBe(1)
    expect(session.conversation.value.turns[0].steps[0].result).toBe('changed')
  })

  it('TH-05: one request at a time: nothing else starts while a follow-up waits, and Send says why', () => {
    const { session, model, commentId } = answeredByModel()
    session.followUp('why 1280?')
    const held = session.state.value

    session.followUp('and the height?')
    session.sendBatch()
    tap(MARK_KEY)
    session.pressTrigger()
    session.openPin(commentId)
    session.next()
    session.startOver()

    expect(session.state.value).toBe(held)
    expect(model.calls).toHaveLength(2)
    expect(session.sendBlock.value).toBe(messages.sendBlocked.followUp)
    expect(session.conversation.value.turns).toHaveLength(1)
  })

  it('TH-06, TH-07, TH-15: the reply joins the thread, is live at its new target, and the sequence goes on after it', () => {
    const { host, session, reply, height, commentId } = answeredByModel()
    host.nodes[1].settings[1].rect = { x: 3000, y: 402, width: 180, height: 18 }
    session.followUp('and taller?')

    reply(1)

    expect(followUps(session)).toMatchObject([
      {
        commentId,
        text: 'and taller?',
        steps: [{ target: height, result: null }]
      }
    ])
    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      index: 0,
      followUp: null,
      steps: [
        {
          target: height,
          offerEdit: { target: height, value: 1280 },
          ref: { followUpId: followUps(session)[0].id, index: 0 }
        },
        { text: 'Now run it.' }
      ]
    })
    expect(host.revealed).toEqual([height])

    session.applyOfferedEdit()

    expect(host.nodes[1].settings[1].value).toBe(1280)
    expect(followUps(session)[0].steps[0]).toMatchObject({
      result: 'accepted',
      valueBefore: 1024
    })
    expect(session.conversation.value.turns[0].steps[0].result).toBeNull()
    expect(stepIndex(session)).toBe(1)
  })

  it.for([
    { name: 'Cancel', cancel: (session: Session) => session.cancelFollowUp() },
    { name: 'Esc', cancel: () => void press('Escape') }
  ])(
    'TH-08, TH-10: $name aborts the follow-up, keeps the answer on screen, and a late reply is dropped',
    ({ cancel }) => {
      const { session, model, reply } = answeredByModel()
      session.followUp('and taller?')
      model.calls[1].think('Looking.')

      cancel(session)
      reply(1)

      expect(model.calls[1].signal.aborted).toBe(true)
      expect(session.state.value).toMatchObject({
        phase: 'guiding',
        index: 0,
        followUp: null,
        steps: [{ text: 'Change width to 1280.' }, { text: 'Now run it.' }]
      })
      expect(followUps(session)).toEqual([])
      expect(session.thinking.value).toBeNull()
    }
  )

  it('TH-09: a failed follow-up says so in place, keeps the text, and Retry sends it again', () => {
    const { session, model } = answeredByModel()
    session.followUp('and taller?')

    model.calls[1].answer({
      kind: 'failure',
      failure: { kind: 'provider', detail: 'status 429' }
    })

    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      index: 0,
      followUp: {
        status: 'failed',
        text: 'and taller?',
        failure: { kind: 'provider' }
      }
    })

    session.retryFollowUp()

    expect(model.calls[2].request).toMatchObject({
      kind: 'followUp',
      followUp: 'and taller?'
    })
    expect(session.state.value).toMatchObject({
      followUp: { status: 'waiting' }
    })
  })

  it('TH-12: a reply with no step for the thread’s question fails as not in the expected format', () => {
    const { session, reply } = answeredByModel()
    session.followUp('and taller?')

    reply(1, null)

    expect(session.state.value).toMatchObject({
      followUp: { status: 'failed', failure: { kind: 'malformed' } }
    })
    expect(followUps(session)).toEqual([])
  })

  it('TH-11: an earlier question’s thread can be followed up from its read-only answer, and that reply is live', () => {
    const { session, reply, commentId, height } = answeredByModel()
    session.dismiss()
    session.openPin(commentId)
    expect(session.state.value).toMatchObject({
      replay: true,
      steps: [{ text: 'Change width to 1280.', offerEdit: null }]
    })

    session.followUp('and taller?')
    reply(1)

    expect(session.state.value).toMatchObject({
      replay: false,
      steps: [{ offerEdit: { target: height, value: 1280 } }]
    })

    session.dismiss()
    session.openPin(commentId)

    expect(session.state.value).toMatchObject({
      replay: true,
      steps: [{ target: height, offerEdit: null, waitFor: null }]
    })
  })

  it('TH-14: a later Send is reminded of the thread', () => {
    const { session, model, reply, commentId } = answeredByModel()
    session.followUp('and taller?')
    reply(1)
    session.dismiss()

    comment(session, WIDTH_ROW, 'what is this?')
    session.sendBatch()

    expect(model.calls[2].request.history).toMatchObject([
      {
        comments: [{ id: commentId }],
        followUps: [{ commentId, text: 'and taller?' }]
      }
    ])
  })

  it('TH-17: the scripted agent answers a follow-up by its words', () => {
    const { host, session } = startGuidance(WIDER)
    const height = settingAddress(host.nodes[1].id, 'height')

    session.followUp('make it taller')
    vi.advanceTimersByTime(FRAME_MS)

    expect(session.state.value).toMatchObject({
      phase: 'guiding',
      index: 0,
      followUp: null,
      steps: [{ target: height, offerEdit: { target: height } }, {}]
    })
    expect(followUps(session)).toHaveLength(1)
  })

  it('TH-18: Start over removes the threads with their turns', () => {
    const { session, reply } = answeredByModel()
    session.followUp('and taller?')
    reply(1)

    session.startOver()

    expect(session.conversation.value).toEqual({ turns: [], unsent: [] })
  })
})

describe('usePointSession: send right away, and what the panel does on Send', () => {
  it('K-02: adds the question being typed and sends the whole list at once', () => {
    const model = fakeModel()
    const { session } = startSession({
      config: { agent: 'model' },
      model: model.backend
    })
    comment(session, SAVE_NODE, 'make this wider')
    session.pickAt(WIDTH_ROW)

    session.sendFromDraft('what is this?')

    expect(session.state.value.phase).toBe('waiting')
    expect(model.calls[0].request).toMatchObject({
      kind: 'batch',
      annotations: [
        { comment: 'make this wider' },
        { comment: 'what is this?' }
      ]
    })
  })

  it('K-03: with nothing typed it sends the questions already in the list', () => {
    const model = fakeModel()
    const { session } = startSession({
      config: { agent: 'model' },
      model: model.backend
    })
    comment(session, SAVE_NODE, 'make this wider')
    session.pickAt(WIDTH_ROW)

    session.sendFromDraft('  ')

    expect(session.state.value.phase).toBe('waiting')
    expect(model.calls[0].request).toMatchObject({
      annotations: [{ comment: 'make this wider' }]
    })
  })

  it('K-03: with nothing typed and nothing in the list it sends nothing and leaves the box open', () => {
    const model = fakeModel()
    const { session } = startSession({
      config: { agent: 'model' },
      model: model.backend
    })
    session.toggleAnnotate()
    session.pickAt(WIDTH_ROW)
    const open = session.state.value

    session.sendFromDraft('')

    expect(session.state.value).toBe(open)
    expect(model.calls).toEqual([])
  })

  it('SD-01, SD-02: Send collapses the panel, and the reply does not reopen it', () => {
    const { session } = startSession()
    session.pressTrigger()
    comment(session, WIDTH_ROW, 'make this wider')
    expect(session.panelOpen.value).toBe(true)

    session.sendBatch()
    expect([session.state.value.phase, session.panelOpen.value]).toEqual([
      'waiting',
      false
    ])

    vi.advanceTimersByTime(REPLY_MS + FRAME_MS)
    expect([session.state.value.phase, session.panelOpen.value]).toEqual([
      'guiding',
      false
    ])
  })

  it('SD-01: sending right away from the box collapses the panel too', () => {
    const { session } = startSession()
    session.pressTrigger()
    session.pickAt(WIDTH_ROW)

    session.sendFromDraft('make this wider')

    expect([session.state.value.phase, session.panelOpen.value]).toEqual([
      'waiting',
      false
    ])
  })

  it('SD-03: a failure leaves the panel collapsed, and Retry keeps it collapsed', () => {
    const model = fakeModel()
    const { session } = startSession({
      config: { agent: 'model' },
      model: model.backend
    })
    session.pressTrigger()
    comment(session, WIDTH_ROW, 'make this wider')
    session.sendBatch()

    model.calls[0].answer({
      kind: 'failure',
      failure: { kind: 'proxyDown', detail: '' }
    })
    expect([session.state.value.phase, session.panelOpen.value]).toEqual([
      'failed',
      false
    ])

    session.openPanel()
    session.retry()
    expect([session.state.value.phase, session.panelOpen.value]).toEqual([
      'waiting',
      false
    ])
  })

  it('SD-04: a panel opened by hand while waiting stays open when the reply arrives', () => {
    const { session } = startSession()
    comment(session, WIDTH_ROW, 'make this wider')
    session.sendBatch()

    session.pressCaret()
    vi.advanceTimersByTime(REPLY_MS + FRAME_MS)

    expect([session.state.value.phase, session.panelOpen.value]).toEqual([
      'guiding',
      true
    ])
  })

  it('SD-05: a follow-up collapses nothing', () => {
    const { session } = startGuidance('how do I make this wider?')
    session.pressCaret()

    session.followUp('make it taller')

    expect(session.panelOpen.value).toBe(true)
  })
})

describe('usePointSession: the trigger and its panel', () => {
  it('P-04, P-05: the trigger turns the mode on and opens the panel; turning it off with nothing to show closes the panel', () => {
    const { session } = startSession()

    session.pressTrigger()
    expect([session.state.value.phase, session.panelOpen.value]).toEqual([
      'annotating',
      true
    ])

    session.pressTrigger()
    expect([session.state.value.phase, session.panelOpen.value]).toEqual([
      'idle',
      false
    ])
  })

  it('P-05: leaving the mode keeps the panel while there are comments to show', () => {
    const { session } = startSession()
    session.pressTrigger()
    comment(session, WIDTH_ROW, 'make this wider')

    press('Escape')

    expect([session.state.value.phase, session.panelOpen.value]).toEqual([
      'idle',
      true
    ])
  })

  it('P-06, P-08: the caret and the collapse control change the panel and never the mode', () => {
    const { session } = startSession()

    session.pressCaret()
    expect([session.state.value.phase, session.panelOpen.value]).toEqual([
      'idle',
      true
    ])

    session.pressTrigger()
    session.collapsePanel()
    expect([session.state.value.phase, session.panelOpen.value]).toEqual([
      'annotating',
      false
    ])
  })

  it('P-07: the key turns the mode on and leaves a closed panel closed', () => {
    const { session } = startSession()

    tap(MARK_KEY)

    expect([session.state.value.phase, session.panelOpen.value]).toEqual([
      'annotating',
      false
    ])
  })

  it('P-09: picking, which is a press outside the panel, leaves it open', () => {
    const { session } = startSession()
    session.pressTrigger()

    session.pickAt(WIDTH_ROW)
    session.saveDraft('make this wider')

    expect(session.panelOpen.value).toBe(true)
  })

  it('P-11: the strip under the trigger opens the panel while a Send is waiting', () => {
    const { session } = startSession()
    comment(session, WIDTH_ROW, 'make this wider')
    session.sendBatch()

    session.openPanel()

    expect([session.state.value.phase, session.panelOpen.value]).toEqual([
      'waiting',
      true
    ])
  })
})

describe('usePointSession: guidance', () => {
  it('G-01: the pointer flies from the comment’s pin to a target in view without moving the canvas', () => {
    const { host, session } = startGuidance('how do I make this wider?')

    expect(session.view.value?.pointer).toEqual({ x: 700, y: 295 })
    vi.advanceTimersByTime(FRAME_MS * 2)
    expect(session.view.value?.landed).toBe(false)
    vi.advanceTimersByTime(600)

    expect(host.revealed).toEqual([])
    expect(session.view.value).toEqual({
      ring: { x: 260, y: 384, width: 180, height: 18 },
      pointer: { x: 424, y: 393 },
      landed: true
    })
  })

  it('G-01: the ring and the pointer follow the target when the canvas moves', () => {
    const { host, session } = startGuidance('how do I make this wider?')
    vi.advanceTimersByTime(600)

    host.nodes[1].settings[0].rect = { x: 60, y: 84, width: 90, height: 9 }
    vi.advanceTimersByTime(FRAME_MS)

    expect(session.view.value).toEqual({
      ring: { x: 60, y: 84, width: 90, height: 9 },
      pointer: { x: 134, y: 88.5 },
      landed: true
    })
  })

  it('G-02: a target that is not drawn in view moves the canvas to it', () => {
    const host = createFakePointHost()
    host.nodes[1].settings[0].rect = null

    startGuidance('how do I make this wider?', host)

    expect(host.revealed).toEqual([settingAddress(host.nodes[1].id, 'width')])
  })

  it('G-03: the next step shows once the person’s change has settled', () => {
    const { host, session } = startGuidance('how do I make this wider?')
    const width = settingAddress(host.nodes[1].id, 'width')

    host.setValue(width, 512)
    vi.advanceTimersByTime(SETTLE_MS + FRAME_MS * 2)
    expect(stepIndex(session)).toBe(0)

    host.setValue(width, 1280)
    vi.advanceTimersByTime(SETTLE_MS - FRAME_MS * 2)
    expect(stepIndex(session)).toBe(0)

    vi.advanceTimersByTime(FRAME_MS * 4)
    expect(stepIndex(session)).toBe(1)
  })

  it('G-04: "Do it for me" writes the offered value through the host and shows the next step', () => {
    const { host, session } = startGuidance('how do I make this wider?')

    session.applyOfferedEdit()

    expect(host.nodes[1].settings[0].value).toBe(1536)
    expect(stepIndex(session)).toBe(1)
  })

  it('L-03: keeps the step and reports it when the setting rejects the offered value', () => {
    const host = createFakePointHost()
    host.rejectsWrites = true
    const { session } = startGuidance('how do I make this wider?', host)

    session.applyOfferedEdit()

    expect(session.state.value).toMatchObject({ index: 0, editFailed: true })
  })

  it('G-06: a queued run on the last step ends guidance', () => {
    const { host, session } = startGuidance('how do I make this wider?')
    session.applyOfferedEdit()

    host.queueRun()

    expect(session.state.value.phase).toBe('idle')
    expect(session.view.value).toBeNull()
  })

  it('G-07: guidance ends when its target node is deleted', () => {
    const { host, session } = startGuidance('how do I make this wider?')

    host.removeNode(host.nodes[1].id)
    vi.advanceTimersByTime(FRAME_MS * 2)

    expect(session.state.value.phase).toBe('idle')
  })

  it('X-02: an answer with no target stays at the comment’s pin and can be closed', () => {
    const { session } = startGuidance('why is the sky blue?')

    expect(session.view.value).toEqual({
      ring: null,
      pointer: { x: 700, y: 295 },
      landed: false
    })

    session.finish()
    expect(session.state.value.phase).toBe('idle')
  })
})

describe('usePointSession: the hidden stroke entry', () => {
  function markAt(session: Session, point: Point) {
    press(MARK_KEY)
    session.pressPointer(point)
    session.releasePointer()
    release(MARK_KEY)
  }

  it('H-02, M-01, M-02, M-03: with the switch on, holding the key and clicking a setting opens the box with that setting', () => {
    const { session } = startSession({ config: { strokeEntry: true } })

    press(MARK_KEY)
    expect(session.state.value.phase).toBe('armed')

    session.pressPointer(WIDTH_ROW)
    session.releasePointer()

    expect(session.state.value).toMatchObject({
      phase: 'asking',
      chips: [{ label: 'Empty Latent Image › width' }]
    })
  })

  it('H-02: with the switch on, a tap still turns annotation mode on', () => {
    const { session } = startSession({ config: { strokeEntry: true } })

    press(MARK_KEY)
    vi.advanceTimersByTime(80)
    release(MARK_KEY)

    expect(session.state.value).toEqual({ phase: 'annotating', draft: null })
  })

  it('does not type the held key into the box that opens under it', () => {
    const { session } = startSession({ config: { strokeEntry: true } })
    const field = document.createElement('input')
    document.body.append(field)
    press(MARK_KEY)
    session.pressPointer(WIDTH_ROW)
    session.releasePointer()

    const repeated = press(MARK_KEY, field)
    release(MARK_KEY)
    const typed = press(MARK_KEY, field)

    expect(repeated.defaultPrevented).toBe(true)
    expect(typed.defaultPrevented).toBe(false)
    expect(session.state.value.phase).toBe('asking')
  })

  it('A-02: Esc closes the box and reaches nothing else', () => {
    const { session } = startSession({ config: { strokeEntry: true } })
    const appSawEscape = vi.fn()
    window.addEventListener('keydown', appSawEscape)
    onTestFinished(() => window.removeEventListener('keydown', appSawEscape))
    markAt(session, WIDTH_ROW)

    const escape = press('Escape')

    expect(session.state.value.phase).toBe('idle')
    expect(escape.defaultPrevented).toBe(true)
    expect(appSawEscape).not.toHaveBeenCalled()
  })

  it('A-04: the box waits for the set delay, then guidance starts', () => {
    const { session } = startSession({ config: { strokeEntry: true } })
    markAt(session, WIDTH_ROW)

    session.ask('how do I make this wider?')
    vi.advanceTimersByTime(1999)
    expect(session.state.value).toMatchObject({
      phase: 'waiting',
      asked: { question: 'how do I make this wider?' }
    })

    vi.advanceTimersByTime(1)
    expect(session.state.value).toMatchObject({ phase: 'guiding', index: 0 })
  })

  it('A-05: after Esc and a new question, the first answer never shows', () => {
    const { host, session } = startSession({ config: { strokeEntry: true } })
    const shown: unknown[] = []
    markAt(session, WIDTH_ROW)
    session.ask('how do I make this wider?')
    press('Escape')
    vi.advanceTimersByTime(1000)
    markAt(session, WIDTH_ROW)
    session.ask('more steps')

    vi.advanceTimersByTime(1000)
    shown.push(session.state.value.phase)
    vi.advanceTimersByTime(1000)
    shown.push(session.state.value)

    expect(shown).toMatchObject([
      'waiting',
      {
        phase: 'guiding',
        steps: [{ target: settingAddress(host.nodes[0].id, 'steps') }, {}]
      }
    ])
  })
})
