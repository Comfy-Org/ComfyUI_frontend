import { dist2 } from '@/lib/litegraph/src/measure'

export interface GesturePoint {
  x: number
  y: number
}

interface ClickRecord {
  position: GesturePoint
  timeStamp: number
}

export type GestureState =
  | { phase: 'idle'; lastClick?: ClickRecord }
  | {
      phase: 'pressed'
      origin: GesturePoint
      timeStamp: number
      lastClick?: ClickRecord
    }
  | { phase: 'dragging'; lastClick?: ClickRecord }

export type GestureEvent =
  | { type: 'down'; position: GesturePoint; timeStamp: number }
  | { type: 'move'; position: GesturePoint }
  | { type: 'up'; position: GesturePoint }
  | { type: 'cancel' }

export type GestureEffect =
  | 'click'
  | 'doubleClick'
  | 'startDrag'
  | 'movePress'
  | 'moveDrag'
  | 'endDrag'

interface GesturePolicy {
  /** Maximum pointer travel, in pixels, for a press to remain a click. */
  clickDrift: number
  /** Maximum gap, in milliseconds, between two presses for a double click. */
  doubleClickTime: number
}

interface GestureResult {
  state: GestureState
  effects: GestureEffect[]
}

export const idleGesture: GestureState = { phase: 'idle' }

function within(a: GesturePoint, b: GesturePoint, distance: number): boolean {
  return dist2(a.x, a.y, b.x, b.y) <= distance * distance
}

function isDoubleClick(
  state: Extract<GestureState, { phase: 'pressed' }>,
  policy: GesturePolicy
): boolean {
  const { lastClick, origin, timeStamp } = state
  if (!lastClick) return false
  const gap = timeStamp - lastClick.timeStamp
  return (
    gap > 0 &&
    gap < policy.doubleClickTime &&
    within(origin, lastClick.position, 3 * policy.clickDrift)
  )
}

function unchanged(state: GestureState): GestureResult {
  return { state, effects: [] }
}

function reduceIdle(
  state: Extract<GestureState, { phase: 'idle' }>,
  event: GestureEvent
): GestureResult {
  switch (event.type) {
    case 'down':
      return {
        state: {
          phase: 'pressed',
          origin: event.position,
          timeStamp: event.timeStamp,
          lastClick: state.lastClick
        },
        effects: []
      }
    case 'move':
    case 'up':
    case 'cancel':
      return unchanged(state)
    default:
      event satisfies never
      return unchanged(state)
  }
}

function reducePressed(
  state: Extract<GestureState, { phase: 'pressed' }>,
  event: GestureEvent,
  policy: GesturePolicy
): GestureResult {
  switch (event.type) {
    case 'move':
      if (within(event.position, state.origin, policy.clickDrift))
        return { state, effects: ['movePress'] }
      return {
        state: { phase: 'dragging', lastClick: state.lastClick },
        effects: ['startDrag', 'moveDrag']
      }
    case 'up':
      if (!within(event.position, state.origin, policy.clickDrift))
        return {
          state: { phase: 'idle', lastClick: state.lastClick },
          effects: ['startDrag', 'endDrag']
        }
      if (isDoubleClick(state, policy))
        return { state: idleGesture, effects: ['doubleClick'] }
      return {
        state: {
          phase: 'idle',
          lastClick: { position: state.origin, timeStamp: state.timeStamp }
        },
        effects: ['click']
      }
    case 'cancel':
      return {
        state: { phase: 'idle', lastClick: state.lastClick },
        effects: []
      }
    case 'down':
      return unchanged(state)
    default:
      event satisfies never
      return unchanged(state)
  }
}

function reduceDragging(
  state: Extract<GestureState, { phase: 'dragging' }>,
  event: GestureEvent
): GestureResult {
  switch (event.type) {
    case 'move':
      return { state, effects: ['moveDrag'] }
    case 'up':
      return {
        state: { phase: 'idle', lastClick: state.lastClick },
        effects: ['endDrag']
      }
    case 'cancel':
      return {
        state: { phase: 'idle', lastClick: state.lastClick },
        effects: []
      }
    case 'down':
      return unchanged(state)
    default:
      event satisfies never
      return unchanged(state)
  }
}

export function reduceGesture(
  state: GestureState,
  event: GestureEvent,
  policy: GesturePolicy
): GestureResult {
  switch (state.phase) {
    case 'idle':
      return reduceIdle(state, event)
    case 'pressed':
      return reducePressed(state, event, policy)
    case 'dragging':
      return reduceDragging(state, event)
    default:
      state satisfies never
      return unchanged(state)
  }
}
