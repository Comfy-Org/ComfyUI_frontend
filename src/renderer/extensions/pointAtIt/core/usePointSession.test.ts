import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope } from 'vue'

import { createFakePointHost, settingAddress } from './fakePointHost'
import type { Point } from './geometry'
import { MARK_KEY } from './messages'
import { usePointSession } from './usePointSession'
import { SETTLE_MS } from './valueWatch'

const FRAME_MS = 16

function startSession(host = createFakePointHost()) {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const session = scope.run(() => usePointSession(host))
  if (!session) throw new Error('The session scope is not active')
  session.settings.replyDelayMs = 2000
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

function markAt(session: ReturnType<typeof usePointSession>, point: Point) {
  press(MARK_KEY)
  session.pressPointer(point)
  session.releasePointer()
  release(MARK_KEY)
}

function startGuidance(question: string, host = createFakePointHost()) {
  const started = startSession(host)
  started.session.settings.replyDelayMs = 0
  markAt(started.session, { x: 40, y: 600 })
  started.session.ask(question)
  vi.advanceTimersByTime(FRAME_MS)
  return started
}

function stepIndex(session: ReturnType<typeof usePointSession>) {
  const state = session.state.value
  return state.phase === 'guiding' ? state.index : state.phase
}

describe('usePointSession', () => {
  it('M-01, M-02, M-03: holding the key and clicking a setting opens the box with that setting', () => {
    const { session } = startSession()

    press(MARK_KEY)
    expect(session.state.value.phase).toBe('armed')

    session.pressPointer({ x: 300, y: 392 })
    session.releasePointer()

    expect(session.state.value).toMatchObject({
      phase: 'asking',
      chips: [{ label: 'Empty Latent Image › width' }]
    })
  })

  it('M-08: the key typed in a text field is left alone', () => {
    const { session } = startSession()
    const field = document.createElement('input')
    document.body.append(field)

    const typed = press(MARK_KEY, field)

    expect(session.state.value.phase).toBe('idle')
    expect(typed.defaultPrevented).toBe(false)
  })

  it('does not type the held key into the box that opens under it', () => {
    const { session } = startSession()
    const field = document.createElement('input')
    document.body.append(field)
    press(MARK_KEY)
    session.pressPointer({ x: 300, y: 392 })
    session.releasePointer()

    const repeated = press(MARK_KEY, field)
    release(MARK_KEY)
    const typed = press(MARK_KEY, field)

    expect(repeated.defaultPrevented).toBe(true)
    expect(typed.defaultPrevented).toBe(false)
    expect(session.state.value.phase).toBe('asking')
  })

  it('S-01: tapping the key with nodes selected opens the box at the selection', () => {
    const { host, session } = startSession()
    host.selection = [host.nodes[1].id, host.nodes[2].id]

    press(MARK_KEY)
    vi.advanceTimersByTime(80)
    release(MARK_KEY)

    expect(session.state.value).toMatchObject({
      phase: 'asking',
      mark: { stroke: [] },
      chips: [{ label: 'Empty Latent Image' }, { label: 'Save Image' }]
    })
  })

  it('A-02: Esc closes the box and reaches nothing else', () => {
    const { session } = startSession()
    const appSawEscape = vi.fn()
    window.addEventListener('keydown', appSawEscape)
    onTestFinished(() => window.removeEventListener('keydown', appSawEscape))
    markAt(session, { x: 300, y: 392 })

    const escape = press('Escape')

    expect(session.state.value.phase).toBe('idle')
    expect(escape.defaultPrevented).toBe(true)
    expect(appSawEscape).not.toHaveBeenCalled()
  })

  it('A-04: the box waits for the set delay, then guidance starts', () => {
    const { session } = startSession()
    markAt(session, { x: 300, y: 392 })

    session.ask('how do I make this wider?')
    vi.advanceTimersByTime(1999)
    expect(session.state.value.phase).toBe('thinking')

    vi.advanceTimersByTime(1)
    expect(session.state.value).toMatchObject({ phase: 'guiding', index: 0 })
  })

  it('A-05: after Esc and a new question, the first answer never shows', () => {
    const { host, session } = startSession()
    const shown: unknown[] = []
    markAt(session, { x: 300, y: 392 })
    session.ask('how do I make this wider?')
    press('Escape')
    vi.advanceTimersByTime(1000)
    markAt(session, { x: 300, y: 392 })
    session.ask('more steps')

    vi.advanceTimersByTime(1000)
    shown.push(session.state.value.phase)
    vi.advanceTimersByTime(1000)
    shown.push(session.state.value)

    expect(shown).toMatchObject([
      'thinking',
      {
        phase: 'guiding',
        steps: [{ target: settingAddress(host.nodes[0].id, 'steps') }, {}]
      }
    ])
  })

  it('G-01: a target in view gets the pointer and the ring without moving the canvas', () => {
    const { host, session } = startGuidance('how do I make this wider?')

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

  it('keeps the step and reports it when the host rejects the offered value', () => {
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

  it('X-02: an answer with no target stays at the mark and can be closed', () => {
    const { session } = startGuidance('why is the sky blue?')

    expect(session.view.value).toEqual({
      ring: null,
      pointer: { x: 40, y: 600 }
    })

    session.finish()
    expect(session.state.value.phase).toBe('idle')
  })
})
