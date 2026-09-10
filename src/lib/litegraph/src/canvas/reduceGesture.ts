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
  | { phase: 'dragging'; origin: GesturePoint; lastClick?: ClickRecord }

export type GestureEvent =
  | { type: 'down'; position: GesturePoint; timeStamp: number }
  | { type: 'move'; position: GesturePoint; timeStamp: number }
  | { type: 'up'; position: GesturePoint }
  | { type: 'cancel' }

export type GestureEffect =
  | 'click'
  | 'doubleClick'
  | 'startDrag'
  | 'movePress'
  | 'moveDrag'
  | 'endDrag'
  | 'cancelDrag'

export interface GesturePolicy {
  /** Maximum press duration, in milliseconds, before movement starts a drag. */
  clickBufferTime: number
  /** Maximum pointer travel, in pixels, for a press to remain a click. */
  clickDrift: number
  /** Maximum gap, in milliseconds, between two presses for a double click. */
  doubleClickTime: number
}

export interface GestureResult {
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

export function reduceGesture(
  state: GestureState,
  event: GestureEvent,
  policy: GesturePolicy
): GestureResult {
  switch (state.phase) {
    case 'idle':
      if (event.type !== 'down') return unchanged(state)
      return {
        state: {
          phase: 'pressed',
          origin: event.position,
          timeStamp: event.timeStamp,
          lastClick: state.lastClick
        },
        effects: []
      }

    case 'pressed':
      switch (event.type) {
        case 'move':
          if (
            event.timeStamp - state.timeStamp <= policy.clickBufferTime &&
            within(event.position, state.origin, policy.clickDrift)
          )
            return { state, effects: ['movePress'] }
          return {
            state: {
              phase: 'dragging',
              origin: state.origin,
              lastClick: state.lastClick
            },
            effects: ['moveDrag', 'startDrag']
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
        default:
          return unchanged(state)
      }

    case 'dragging':
      switch (event.type) {
        case 'move':
          return { state, effects: ['moveDrag'] }
        case 'up':
          return {
            state: { phase: 'idle', lastClick: state.lastClick },
            effects: ['endDrag']
          }
        case 'cancel':
          return { state: idleGesture, effects: ['cancelDrag'] }
        default:
          return unchanged(state)
      }
  }
}
