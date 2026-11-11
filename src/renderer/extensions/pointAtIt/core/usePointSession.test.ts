import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope } from 'vue'

import { createFakePointHost, settingAddress } from './fakePointHost'
import type { Point } from './geometry'
import { MARK_KEY, problems } from './messages'
import { usePointSession } from './usePointSession'
import { SETTLE_MS } from './valueWatch'

const FRAME_MS = 16
const WIDTH_ROW: Point = { x: 300, y: 392 }
const SAVE_NODE: Point = { x: 800, y: 480 }
const EMPTY_CANVAS: Point = { x: 40, y: 600 }

type Session = ReturnType<typeof usePointSession>

function startSession(host = createFakePointHost(), strokeEntry = false) {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const session = scope.run(() => usePointSession(host, { strokeEntry }))
  if (!session) throw new Error('The session scope is not active')
  return { host, session }
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
  const started = startSession(host)
  started.session.settings.replyDelayMs = 0
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
    const { session } = startSession(createFakePointHost(), true)

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
    const { session } = startSession(createFakePointHost(), true)

    press(MARK_KEY)
    vi.advanceTimersByTime(80)
    release(MARK_KEY)

    expect(session.state.value).toEqual({ phase: 'annotating', draft: null })
  })

  it('does not type the held key into the box that opens under it', () => {
    const { session } = startSession(createFakePointHost(), true)
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
    const { session } = startSession(createFakePointHost(), true)
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
    const { session } = startSession(createFakePointHost(), true)
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
    const { host, session } = startSession(createFakePointHost(), true)
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
