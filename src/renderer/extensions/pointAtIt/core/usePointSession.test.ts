import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope } from 'vue'

import type { AgentBackend } from './agentBackends'
import { pointConfig } from './config'
import type { PointConfig } from './config'
import { createFakePointHost, settingAddress } from './fakePointHost'
import type { Point } from './geometry'
import { MARK_KEY, problems } from './messages'
import type { AgentOutcome } from './modelReply'
import { SURFACE_ATTRIBUTE, usePointSession } from './usePointSession'
import { SETTLE_MS } from './valueWatch'

const FRAME_MS = 16
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
    signal: AbortSignal
    think: (text: string) => void
    answer: (outcome: AgentOutcome) => void
  }[] = []
  const backend: AgentBackend = {
    ask(_request, _nodes, { signal, onThinking, onOutcome }) {
      calls.push({ signal, think: onThinking, answer: onOutcome })
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
    expect(session.annotations.value).toMatchObject([
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

    expect(session.annotations.value).toEqual([])
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
    expect(session.annotations.value).toHaveLength(1)
    expect(press('Escape').defaultPrevented).toBe(false)
  })

  it('AN-09: a pin reopens its comment to edit it, or to delete it and renumber the rest', () => {
    const { session } = startSession()
    comment(session, WIDTH_ROW, 'make this wider')
    comment(session, SAVE_NODE, 'what is this?')
    session.toggleAnnotate()
    const [first, second] = session.annotations.value

    session.openPin(second.id)
    expect(session.state.value).toMatchObject({
      phase: 'annotating',
      draft: { annotationId: second.id, comment: 'what is this?' }
    })

    session.saveDraft('what does this do?')
    session.openPin(first.id)
    session.deleteDraft()

    expect(session.annotations.value).toMatchObject([
      { id: second.id, comment: 'what does this do?' }
    ])
    expect(session.pins.value).toMatchObject([{ id: second.id, number: 1 }])
  })

  it('AN-10: entering with nodes selected opens one comment on the selection', () => {
    const { host, session } = startSession()
    host.selection = [host.nodes[1].id, host.nodes[2].id]

    tap(MARK_KEY)
    session.saveDraft('why are these connected?')

    expect(session.annotations.value).toMatchObject([
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
    const [first, second] = session.annotations.value

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

  it('AN-14: Clear removes every comment and pin', () => {
    const { session } = startSession()
    comment(session, WIDTH_ROW, 'make this wider')

    session.clearAnnotations()

    expect(session.annotations.value).toEqual([])
    expect(session.pins.value).toEqual([])
  })

  it('AN-15, AN-19: while waiting nothing can be changed, and after Cancel the late reply never shows', () => {
    const { session } = startSession()
    comment(session, WIDTH_ROW, 'make this wider')
    session.sendBatch()

    session.toggleAnnotate()
    session.clearAnnotations()
    session.openPin(session.annotations.value[0].id)
    expect(session.state.value.phase).toBe('waiting')

    session.dismiss()
    vi.advanceTimersByTime(2000)

    expect(session.state.value.phase).toBe('idle')
    expect(session.annotations.value).toHaveLength(1)
  })

  it('AN-17: when guidance ends the comments are still there to send again', () => {
    const { session } = startGuidance('what is this?')

    session.finish()
    session.sendBatch()

    expect(session.annotations.value).toHaveLength(1)
    expect(session.state.value.phase).toBe('waiting')
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

    session.openPin(session.annotations.value[0].id)

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

    session.openPin(session.annotations.value[0].id)

    expect(host.revealed).toEqual([settingAddress(host.nodes[1].id, 'width')])
  })

  it('U-03: a comment whose target was deleted still opens, with nothing to ring', () => {
    const { host, session } = startSession()
    comment(session, WIDTH_ROW, 'make this wider')
    host.removeNode(host.nodes[1].id)

    session.openPin(session.annotations.value[0].id)
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
      pointer: { x: 1220, y: 40 }
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

  it('T-03: the thinking stays after the reply and goes with Clear', () => {
    const { session, calls } = startWithModel()
    calls[0].think('Checking the width.')
    calls[0].answer({ kind: 'reply', reply })
    session.finish()

    expect(session.thinking.value).toMatchObject({
      text: 'Checking the width.',
      done: true
    })

    session.clearAnnotations()
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
      expect(session.annotations.value).toHaveLength(1)

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
    expect(session.annotations.value).toHaveLength(1)
  })
})

describe('usePointSession: guidance', () => {
  it('G-01: the pointer flies from the comment’s pin to a target in view without moving the canvas', () => {
    const { host, session } = startGuidance('how do I make this wider?')

    expect(session.view.value?.pointer).toEqual({ x: 700, y: 295 })
    vi.advanceTimersByTime(600)

    expect(host.revealed).toEqual([])
    expect(session.view.value).toEqual({
      ring: { x: 260, y: 384, width: 180, height: 18 },
      pointer: { x: 424, y: 393 }
    })
  })

  it('G-01: the ring and the pointer follow the target when the canvas moves', () => {
    const { host, session } = startGuidance('how do I make this wider?')
    vi.advanceTimersByTime(600)

    host.nodes[1].settings[0].rect = { x: 60, y: 84, width: 90, height: 9 }
    vi.advanceTimersByTime(FRAME_MS)

    expect(session.view.value).toEqual({
      ring: { x: 60, y: 84, width: 90, height: 9 },
      pointer: { x: 134, y: 88.5 }
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
      pointer: { x: 700, y: 295 }
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
