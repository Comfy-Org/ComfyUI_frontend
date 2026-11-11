import { boundsOf } from './geometry'
import type { Point, Rect } from './geometry'
import type { GuidanceStep } from './replyValidation'
import type { GraphAddress, TargetAddress } from './targetAddress'

/** Why a request produced no guidance. */
export interface RequestFailure {
  kind: 'malformed'
}

/** A key press shorter than this is a tap, not a hold. */
export const TAP_MS = 300

export interface Chip {
  id: string
  target: TargetAddress
  label: string
}

interface Mark {
  stroke: Point[]
  anchor: Rect
}

/** An open comment box: a new comment, or an existing one being edited. */
export interface Draft {
  annotationId: string | null
  targets: GraphAddress[]
  label: string
  comment: string
}

/** The box of the hidden stroke entry, kept on screen while its question waits. */
interface Asked {
  mark: Mark
  chips: Chip[]
  question: string
}

interface IdleState {
  phase: 'idle'
}

interface ArmedState {
  phase: 'armed'
  pressedAt: number
}

interface MarkingState {
  phase: 'marking'
  stroke: Point[]
}

interface AskingState {
  phase: 'asking'
  mark: Mark
  chips: Chip[]
}

interface AnnotatingState {
  phase: 'annotating'
  draft: Draft | null
}

interface WaitingState {
  phase: 'waiting'
  requestId: string
  startedAt: number
  origin: Point
  asked: Asked | null
}

interface FailedState {
  phase: 'failed'
  failure: RequestFailure
  origin: Point
  asked: Asked | null
}

export interface GuidingState {
  phase: 'guiding'
  requestId: string
  steps: GuidanceStep[]
  index: number
  origin: Point
  editFailed: boolean
}

export type PointState =
  | IdleState
  | ArmedState
  | MarkingState
  | AskingState
  | AnnotatingState
  | WaitingState
  | FailedState
  | GuidingState

export type PointEvent =
  | { type: 'keyPressed'; at: number }
  | { type: 'keyReleased'; at: number; selection: Draft | null }
  | { type: 'pointerPressed'; point: Point }
  | { type: 'pointerMoved'; point: Point }
  | { type: 'pointerReleased'; chips: Chip[] }
  | { type: 'chipRemoved'; chipId: string }
  | { type: 'questionSent'; requestId: string; text: string; at: number }
  | { type: 'annotateToggled'; selection: Draft | null }
  | { type: 'draftOpened'; draft: Draft }
  | { type: 'draftClosed' }
  | { type: 'batchSent'; requestId: string; at: number; origin: Point }
  | { type: 'replyArrived'; requestId: string; steps: GuidanceStep[] }
  | { type: 'requestFailed'; requestId: string; failure: RequestFailure }
  | { type: 'valueChanged' }
  | { type: 'editApplied' }
  | { type: 'editFailed' }
  | { type: 'nextRequested' }
  | { type: 'runQueued' }
  | { type: 'targetRemoved' }
  | { type: 'finished' }
  | { type: 'dismissed' }

export const idleState: PointState = { phase: 'idle' }

function isLastStep(state: GuidingState): boolean {
  return state.index === state.steps.length - 1
}

function advance(state: GuidingState): PointState {
  if (isLastStep(state)) return idleState
  return { ...state, index: state.index + 1, editFailed: false }
}

function dismiss(state: PointState): PointState {
  if (state.phase === 'idle') return state
  if (state.phase === 'annotating' && state.draft)
    return { phase: 'annotating', draft: null }
  return idleState
}

function toggleAnnotate(
  state: PointState,
  selection: Draft | null
): PointState {
  if (state.phase === 'annotating') return idleState
  const canEnter =
    state.phase === 'idle' ||
    state.phase === 'failed' ||
    state.phase === 'guiding'
  return canEnter ? { phase: 'annotating', draft: selection } : state
}

function openDraft(state: PointState, draft: Draft): PointState {
  const canOpen =
    state.phase === 'idle' ||
    state.phase === 'failed' ||
    (state.phase === 'annotating' && !state.draft)
  return canOpen ? { phase: 'annotating', draft } : state
}

function sendBatch(
  state: PointState,
  event: Extract<PointEvent, { type: 'batchSent' }>
): PointState {
  const waiting = {
    phase: 'waiting' as const,
    requestId: event.requestId,
    startedAt: event.at
  }
  if (state.phase === 'failed')
    return { ...waiting, origin: state.origin, asked: state.asked }
  return state.phase === 'idle' || state.phase === 'annotating'
    ? { ...waiting, origin: event.origin, asked: null }
    : state
}

function reduceAsking(state: AskingState, event: PointEvent): PointState {
  if (event.type === 'chipRemoved')
    return {
      ...state,
      chips: state.chips.filter((chip) => chip.id !== event.chipId)
    }
  if (event.type !== 'questionSent' || !event.text.trim()) return state
  const { anchor } = state.mark
  return {
    phase: 'waiting',
    requestId: event.requestId,
    startedAt: event.at,
    origin: { x: anchor.x, y: anchor.y + anchor.height },
    asked: {
      mark: state.mark,
      chips: state.chips,
      question: event.text.trim()
    }
  }
}

function reduceWaiting(state: WaitingState, event: PointEvent): PointState {
  if (event.type === 'requestFailed' && event.requestId === state.requestId)
    return {
      phase: 'failed',
      failure: event.failure,
      origin: state.origin,
      asked: state.asked
    }
  if (event.type !== 'replyArrived' || event.requestId !== state.requestId)
    return state
  if (event.steps.length === 0) return idleState
  return {
    phase: 'guiding',
    requestId: event.requestId,
    steps: event.steps,
    index: 0,
    origin: state.origin,
    editFailed: false
  }
}

function reduceGuiding(state: GuidingState, event: PointEvent): PointState {
  const step = state.steps[state.index]
  switch (event.type) {
    case 'valueChanged':
      return step.waitFor?.for === 'valueChange' ? advance(state) : state
    case 'editApplied':
      return step.offerEdit ? advance(state) : state
    case 'editFailed':
      return step.offerEdit ? { ...state, editFailed: true } : state
    case 'nextRequested':
      return isLastStep(state) ? state : advance(state)
    case 'runQueued':
      return isLastStep(state) || step.waitFor?.for === 'run'
        ? advance(state)
        : state
    case 'finished':
      return isLastStep(state) ? idleState : state
    case 'targetRemoved':
      return idleState
    default:
      return state
  }
}

function reducePhase(state: PointState, event: PointEvent): PointState {
  switch (state.phase) {
    case 'idle':
      return event.type === 'keyPressed'
        ? { phase: 'armed', pressedAt: event.at }
        : state
    case 'armed':
      if (event.type === 'pointerPressed')
        return { phase: 'marking', stroke: [event.point] }
      if (event.type !== 'keyReleased') return state
      return event.at - state.pressedAt <= TAP_MS
        ? { phase: 'annotating', draft: event.selection }
        : idleState
    case 'marking':
      if (event.type === 'pointerMoved')
        return { ...state, stroke: [...state.stroke, event.point] }
      return event.type === 'pointerReleased'
        ? {
            phase: 'asking',
            mark: { stroke: state.stroke, anchor: boundsOf(state.stroke) },
            chips: event.chips
          }
        : state
    case 'asking':
      return reduceAsking(state, event)
    case 'annotating':
      return event.type === 'draftClosed' && state.draft
        ? { phase: 'annotating', draft: null }
        : state
    case 'waiting':
      return reduceWaiting(state, event)
    case 'failed':
      return state
    case 'guiding':
      return reduceGuiding(state, event)
  }
}

/** Pure transition: an event that means nothing in the current phase returns `state`. */
export function reducePointState(
  state: PointState,
  event: PointEvent
): PointState {
  switch (event.type) {
    case 'dismissed':
      return dismiss(state)
    case 'annotateToggled':
      return toggleAnnotate(state, event.selection)
    case 'draftOpened':
      return openDraft(state, event.draft)
    case 'batchSent':
      return sendBatch(state, event)
    default:
      return reducePhase(state, event)
  }
}
