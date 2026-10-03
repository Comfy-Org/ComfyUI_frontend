import { describe, expect, it } from 'vitest'

import type {
  GestureEvent,
  GestureState
} from '@/lib/litegraph/src/canvas/reduceGesture'
import {
  idleGesture,
  reduceGesture
} from '@/lib/litegraph/src/canvas/reduceGesture'

const policy = {
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
      { type: 'move', position: far },
      { type: 'up', position: far },
      { type: 'cancel' }
    ]

    expect(run(events)).toEqual({ state: idleGesture, effects: [] })
  })

  it('release within the drift threshold is a click and is remembered', () => {
    const { state, effects } = run([
      down(10),
      { type: 'move', position: nearby },
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
      { type: 'move', position: nearby },
      { type: 'move', position: far }
    ])

    expect(effects).toEqual(['movePress', 'startDrag', 'moveDrag'])
    expect(state.phase).toBe('dragging')
  })

  it('movement within the drift threshold stays pressed', () => {
    const { state, effects } = run([
      down(0),
      { type: 'move', position: nearby }
    ])

    expect(effects).toEqual(['movePress'])
    expect(state.phase).toBe('pressed')
  })

  it('movement exactly at the drift threshold stays pressed', () => {
    const boundary = { x: origin.x + policy.clickDrift, y: origin.y }

    const { state, effects } = run([
      down(0),
      { type: 'move', position: boundary }
    ])

    expect(effects).toEqual(['movePress'])
    expect(state.phase).toBe('pressed')
  })

  it.for([
    { name: 'pressed', before: [down(0)] },
    { name: 'dragging', before: [down(0), { type: 'move', position: far }] }
  ] satisfies { name: string; before: GestureEvent[] }[])(
    'ignores a repeated down while $name',
    ({ before }) => {
      const current = run(before).state

      const result = reduceGesture(current, down(100), policy)

      expect(result).toEqual({ state: current, effects: [] })
    }
  )

  it('release while dragging ends the drag and keeps the click record', () => {
    const remembered = run([down(0), { type: 'up', position: origin }]).state

    const { state, effects } = run(
      [
        down(1000),
        { type: 'move', position: far },
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
    { name: 'with no time between presses', gap: 0, at: origin, double: false },
    {
      name: 'with a negative timestamp gap',
      gap: -1,
      at: origin,
      double: false
    }
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

  it('cancel while dragging emits nothing and keeps the click record', () => {
    const remembered = run([down(0), { type: 'up', position: origin }]).state

    const { state, effects } = run(
      [down(50), { type: 'move', position: far }, { type: 'cancel' }],
      remembered
    )

    expect(effects).toEqual(['startDrag', 'moveDrag'])
    expect(state).toEqual(remembered)
  })

  it('does not mutate frozen state or events', () => {
    const state = Object.freeze({
      phase: 'pressed' as const,
      origin: Object.freeze({ ...origin }),
      timeStamp: 10,
      lastClick: Object.freeze({ position: origin, timeStamp: 0 })
    })
    const event = Object.freeze({
      type: 'move' as const,
      position: Object.freeze({ ...far })
    })

    const result = reduceGesture(state, event, policy)

    expect(result).toEqual({
      state: { phase: 'dragging', lastClick: state.lastClick },
      effects: ['startDrag', 'moveDrag']
    })
    expect(state.phase).toBe('pressed')
    expect(event.position).toEqual(far)
  })
})
