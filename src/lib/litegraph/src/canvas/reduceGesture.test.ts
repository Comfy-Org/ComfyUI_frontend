import { describe, expect, it } from 'vitest'

import type {
  GestureEvent,
  GesturePolicy,
  GestureState
} from '@/lib/litegraph/src/canvas/reduceGesture'
import {
  idleGesture,
  reduceGesture
} from '@/lib/litegraph/src/canvas/reduceGesture'

const policy: GesturePolicy = {
  clickBufferTime: 32,
  clickDrift: 6,
  doubleClickTime: 300
}

const origin = { x: 100, y: 100 }
const nearby = { x: 104, y: 103 }
const far = { x: 120, y: 130 }

function down(timeStamp: number): GestureEvent {
  return { type: 'down', position: origin, timeStamp }
}

function run(events: GestureEvent[], from: GestureState = idleGesture) {
  const effects: string[] = []
  const state = events.reduce((state, event) => {
    const result = reduceGesture(state, event, policy)
    effects.push(...result.effects)
    return result.state
  }, from)
  return { state, effects }
}

describe('reduceGesture', () => {
  it('ignores events other than down while idle', () => {
    const events: GestureEvent[] = [
      { type: 'move', position: far, timeStamp: 0 },
      { type: 'up', position: far },
      { type: 'cancel' }
    ]

    expect(run(events)).toEqual({ state: idleGesture, effects: [] })
  })

  it('release within the drift threshold is a click and is remembered', () => {
    const { state, effects } = run([
      down(10),
      { type: 'move', position: nearby, timeStamp: 20 },
      { type: 'up', position: nearby }
    ])

    expect(effects).toEqual(['movePress', 'click'])
    expect(state).toEqual({
      phase: 'idle',
      lastClick: { position: origin, timeStamp: 10 }
    })
  })

  it('movement past the drift threshold starts and moves a drag, however slow', () => {
    const { state, effects } = run([
      down(0),
      { type: 'move', position: nearby, timeStamp: 10 },
      { type: 'move', position: far, timeStamp: 20 }
    ])

    expect(effects).toEqual(['movePress', 'startDrag', 'moveDrag'])
    expect(state.phase).toBe('dragging')
  })

  it('movement after the click buffer starts a drag within the drift threshold', () => {
    const { state, effects } = run([
      down(0),
      { type: 'move', position: nearby, timeStamp: 33 }
    ])

    expect(effects).toEqual(['startDrag', 'moveDrag'])
    expect(state.phase).toBe('dragging')
  })

  it('release while dragging ends the drag and keeps the click record', () => {
    const remembered = run([down(0), { type: 'up', position: origin }]).state

    const { state, effects } = run(
      [
        down(1000),
        { type: 'move', position: far, timeStamp: 1010 },
        { type: 'up', position: far }
      ],
      remembered
    )

    expect(effects).toEqual(['startDrag', 'moveDrag', 'endDrag'])
    expect(state).toEqual(remembered)
  })

  it('release far from the press without a move is a drag', () => {
    const { effects } = run([down(0), { type: 'up', position: far }])

    expect(effects).toEqual(['startDrag', 'endDrag'])
  })

  it.for([
    { name: 'inside the window and near', gap: 200, at: nearby, double: true },
    { name: 'inside the window and far', gap: 200, at: far, double: false },
    { name: 'after the window', gap: 300, at: origin, double: false },
    { name: 'with no time between presses', gap: 0, at: origin, double: false }
  ])('second click $name is double: $double', ({ gap, at, double }) => {
    const first = run([down(100), { type: 'up', position: origin }]).state

    const { state, effects } = run(
      [
        { type: 'down', position: at, timeStamp: 100 + gap },
        { type: 'up', position: at }
      ],
      first
    )

    expect(effects).toEqual([double ? 'doubleClick' : 'click'])
    expect(state.phase === 'idle' && state.lastClick === undefined).toBe(double)
  })

  it('cancel while pressed emits nothing and keeps the click record', () => {
    const remembered = run([down(0), { type: 'up', position: origin }]).state

    const { state, effects } = run([down(50), { type: 'cancel' }], remembered)

    expect(effects).toEqual([])
    expect(state).toEqual(remembered)
  })

  it('cancel while dragging cancels the drag and forgets the click record', () => {
    const remembered = run([down(0), { type: 'up', position: origin }]).state

    const { state, effects } = run(
      [
        down(50),
        { type: 'move', position: far, timeStamp: 60 },
        { type: 'cancel' }
      ],
      remembered
    )

    expect(effects).toEqual(['startDrag', 'moveDrag', 'cancelDrag'])
    expect(state).toEqual(idleGesture)
  })
})
