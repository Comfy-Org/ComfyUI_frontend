import { describe, expect, it } from 'vitest'

import type {
  GestureEvent,
  GesturePoint,
  GestureState
} from '@/lib/litegraph/src/canvas/reduceGesture'
import {
  idleGesture,
  reduceGesture
} from '@/lib/litegraph/src/canvas/reduceGesture'

const policy = {
  maxClickDrift: 6,
  doubleClickTime: 300
}

const origin = { x: 100, y: 100 }
const nearby = { x: 104, y: 103 }
const far = { x: 120, y: 130 }

function down(
  timeStamp: number,
  position: GesturePoint = origin
): GestureEvent {
  return { type: 'down', position, timeStamp, policy }
}

function up(position: GesturePoint, acceptsDoubleClick = true): GestureEvent {
  return { type: 'up', position, acceptsDoubleClick }
}

function run(events: GestureEvent[], from: GestureState = idleGesture) {
  const effects: string[] = []
  const state = events.reduce((state, event) => {
    const result = reduceGesture(state, event)
    effects.push(...result.effects)
    return result.state
  }, from)
  return { state, effects }
}

describe('reduceGesture', () => {
  it('ignores events other than down while idle', () => {
    const events: GestureEvent[] = [
      { type: 'move', position: far },
      up(far),
      { type: 'cancel' }
    ]

    expect(run(events)).toEqual({ state: idleGesture, effects: [] })
  })

  it('release within the drift threshold is a click and is remembered', () => {
    const { state, effects } = run([
      down(10),
      { type: 'move', position: nearby },
      up(nearby)
    ])

    expect(effects).toEqual(['movePress', 'click'])
    expect(state).toEqual({
      phase: 'idle',
      lastClick: { position: origin, timeStamp: 10 }
    })
  })

  it('movement past the drift threshold starts a drag and every later move moves it', () => {
    const { state, effects } = run([
      down(0),
      { type: 'move', position: nearby },
      { type: 'move', position: far },
      { type: 'move', position: nearby }
    ])

    expect(effects).toEqual(['movePress', 'startDrag', 'moveDrag', 'moveDrag'])
    expect(state.phase).toBe('dragging')
  })

  it.for([
    {
      name: 'within the drift threshold stays pressed',
      to: nearby,
      effects: ['movePress'],
      phase: 'pressed'
    },
    {
      name: 'exactly at the drift threshold stays pressed',
      to: { x: 106, y: 100 },
      effects: ['movePress'],
      phase: 'pressed'
    },
    {
      name: 'just past the drift threshold starts a drag',
      to: { x: 107, y: 100 },
      effects: ['startDrag', 'moveDrag'],
      phase: 'dragging'
    }
  ])('movement $name', ({ to, effects, phase }) => {
    const result = run([down(0), { type: 'move', position: to }])

    expect(result.effects).toEqual(effects)
    expect(result.state.phase).toBe(phase)
  })

  it.for([
    { name: 'pressed', before: [down(0)] },
    { name: 'dragging', before: [down(0), { type: 'move', position: far }] }
  ] satisfies { name: string; before: GestureEvent[] }[])(
    'ignores a repeated down while $name',
    ({ before }) => {
      const current = run(before).state

      const result = reduceGesture(current, down(100))

      expect(result).toEqual({ state: current, effects: [] })
    }
  )

  it('release while dragging ends the drag and keeps the click record', () => {
    const remembered = run([down(0), up(origin)]).state

    const { state, effects } = run(
      [down(1000), { type: 'move', position: far }, up(far)],
      remembered
    )

    expect(effects).toEqual(['startDrag', 'moveDrag', 'endDrag'])
    expect(state).toEqual(remembered)
  })

  it('release far from the press without a move is a drag', () => {
    const { effects } = run([down(0), up(far)])

    expect(effects).toEqual(['startDrag', 'endDrag'])
  })

  it.for([
    {
      name: 'inside the window and within drift',
      timeStamp: 300,
      at: nearby,
      expected: { effects: ['doubleClick'], lastClick: undefined }
    },
    {
      name: 'inside the window, past drift but within triple drift',
      timeStamp: 300,
      at: { x: 110, y: 100 },
      expected: { effects: ['doubleClick'], lastClick: undefined }
    },
    {
      name: 'inside the window, exactly at triple drift',
      timeStamp: 300,
      at: { x: 118, y: 100 },
      expected: { effects: ['doubleClick'], lastClick: undefined }
    },
    {
      name: 'inside the window, just past triple drift',
      timeStamp: 300,
      at: { x: 119, y: 100 },
      expected: {
        effects: ['click'],
        lastClick: { position: { x: 119, y: 100 }, timeStamp: 300 }
      }
    },
    {
      name: 'at the end of the window',
      timeStamp: 399,
      at: origin,
      expected: { effects: ['doubleClick'], lastClick: undefined }
    },
    {
      name: 'after the window',
      timeStamp: 400,
      at: origin,
      expected: {
        effects: ['click'],
        lastClick: { position: origin, timeStamp: 400 }
      }
    },
    {
      name: 'with no time between presses',
      timeStamp: 100,
      at: origin,
      expected: {
        effects: ['click'],
        lastClick: { position: origin, timeStamp: 100 }
      }
    },
    {
      name: 'with a negative timestamp gap',
      timeStamp: 99,
      at: origin,
      expected: {
        effects: ['click'],
        lastClick: { position: origin, timeStamp: 99 }
      }
    }
  ])(
    'second click $name after a click at 100ms',
    ({ timeStamp, at, expected }) => {
      const first = run([down(100), up(origin)]).state

      const { state, effects } = run([down(timeStamp, at), up(at)], first)

      expect({ effects, lastClick: state.lastClick }).toEqual(expected)
    }
  )

  it('a would-be double click that is not accepted is a click that records the press', () => {
    const first = run([down(100), up(origin)]).state

    const { state, effects } = run([down(200), up(origin, false)], first)

    expect(effects).toEqual(['click'])
    expect(state).toEqual({
      phase: 'idle',
      lastClick: { position: origin, timeStamp: 200 }
    })
  })

  it('cancel while pressed emits nothing and keeps the click record', () => {
    const remembered = run([down(0), up(origin)]).state

    const { state, effects } = run([down(50), { type: 'cancel' }], remembered)

    expect(effects).toEqual([])
    expect(state).toEqual(remembered)
  })

  it('cancel while dragging cancels the drag and keeps the click record', () => {
    const remembered = run([down(0), up(origin)]).state
    const dragging = run(
      [down(50), { type: 'move', position: far }],
      remembered
    ).state

    const result = reduceGesture(dragging, { type: 'cancel' })

    expect(result).toEqual({ state: remembered, effects: ['cancelDrag'] })
  })

  it('does not mutate frozen state or events', () => {
    const state = Object.freeze({
      phase: 'pressed' as const,
      origin: Object.freeze({ ...origin }),
      timeStamp: 10,
      policy: Object.freeze({ ...policy }),
      lastClick: Object.freeze({ position: origin, timeStamp: 0 })
    })
    const event = Object.freeze({
      type: 'move' as const,
      position: Object.freeze({ ...far })
    })

    const result = reduceGesture(state, event)

    expect(result).toEqual({
      state: { phase: 'dragging', lastClick: state.lastClick },
      effects: ['startDrag', 'moveDrag']
    })
    expect(state.phase).toBe('pressed')
    expect(event.position).toEqual(far)
  })
})
