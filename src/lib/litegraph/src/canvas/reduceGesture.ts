import { dist2 } from '@/lib/litegraph/src/measure'

export interface GesturePoint {
  readonly x: number
  readonly y: number
}

interface ClickRecord {
  readonly position: GesturePoint
  readonly timeStamp: number
}

export interface GesturePolicy {
  readonly maxClickDrift: number
  readonly doubleClickTime: number
}

export type GestureState =
  | { readonly phase: 'idle'; readonly lastClick: ClickRecord | undefined }
  | {
      readonly phase: 'pressed'
      readonly origin: GesturePoint
      readonly timeStamp: number
      readonly policy: GesturePolicy
      readonly lastClick: ClickRecord | undefined
    }
  | { readonly phase: 'dragging'; readonly lastClick: ClickRecord | undefined }

export type GestureEvent =
  | {
      type: 'down'
      position: GesturePoint
      timeStamp: number
      policy: GesturePolicy
    }
  | { type: 'move'; position: GesturePoint }
  | { type: 'up'; position: GesturePoint; acceptsDoubleClick: boolean }
  | { type: 'cancel' }

export type GestureEffect =
  | 'click'
  | 'doubleClick'
  | 'startDrag'
  | 'movePress'
  | 'moveDrag'
  | 'endDrag'
  | 'cancelDrag'

interface GestureResult {
  state: GestureState
  effects: GestureEffect[]
}

export const idleGesture: GestureState = Object.freeze({
  phase: 'idle',
  lastClick: undefined
})

function within(a: GesturePoint, b: GesturePoint, distance: number): boolean {
  return dist2(a.x, a.y, b.x, b.y) <= distance * distance
}

function isDoubleClick(
  state: Extract<GestureState, { phase: 'pressed' }>
): boolean {
  const { lastClick, origin, timeStamp, policy } = state
  if (!lastClick) return false
  const gap = timeStamp - lastClick.timeStamp
  return (
    gap > 0 &&
    gap < policy.doubleClickTime &&
    within(origin, lastClick.position, 3 * policy.maxClickDrift)
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
          policy: event.policy,
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
  event: GestureEvent
): GestureResult {
  const { origin, policy, lastClick } = state
  switch (event.type) {
    case 'move':
      if (within(event.position, origin, policy.maxClickDrift))
        return { state, effects: ['movePress'] }
      return {
        state: { phase: 'dragging', lastClick },
        effects: ['startDrag', 'moveDrag']
      }
    case 'up':
      if (!within(event.position, origin, policy.maxClickDrift))
        return {
          state: { phase: 'idle', lastClick },
          effects: ['startDrag', 'endDrag']
        }
      if (event.acceptsDoubleClick && isDoubleClick(state))
        return { state: idleGesture, effects: ['doubleClick'] }
      return {
        state: {
          phase: 'idle',
          lastClick: { position: origin, timeStamp: state.timeStamp }
        },
        effects: ['click']
      }
    case 'cancel':
      return { state: { phase: 'idle', lastClick }, effects: [] }
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
  const { lastClick } = state
  switch (event.type) {
    case 'move':
      return { state, effects: ['moveDrag'] }
    case 'up':
      return { state: { phase: 'idle', lastClick }, effects: ['endDrag'] }
    case 'cancel':
      return { state: { phase: 'idle', lastClick }, effects: ['cancelDrag'] }
    case 'down':
      return unchanged(state)
    default:
      event satisfies never
      return unchanged(state)
  }
}

export function reduceGesture(
  state: GestureState,
  event: GestureEvent
): GestureResult {
  switch (state.phase) {
    case 'idle':
      return reduceIdle(state, event)
    case 'pressed':
      return reducePressed(state, event)
    case 'dragging':
      return reduceDragging(state, event)
    default:
      state satisfies never
      return unchanged(state)
  }
}
