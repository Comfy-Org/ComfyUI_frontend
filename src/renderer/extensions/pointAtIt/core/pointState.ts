import { boundsOf } from './geometry'
import type { Point, Rect } from './geometry'
import type { AnnotationTarget, TargetAddress } from './targetAddress'
import type { ShownStep } from './turns'

/** Why a request produced no guidance; `detail` is shown with the message. */
export interface RequestFailure {
  kind: 'malformed' | 'provider' | 'proxyDown' | 'timeout' | 'noKey'
  detail: string
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
  targets: AnnotationTarget[]
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

interface WaitingFollowUp {
  status: 'waiting'
  requestId: string
  text: string
  startedAt: number
}

/** A follow-up sent from the answer on screen that has no reply yet. */
export type FollowUpActivity =
  | WaitingFollowUp
  | { status: 'failed'; text: string; failure: RequestFailure }

export interface GuidingState {
  phase: 'guiding'
  requestId: string
  /** True while an opened thread shows an earlier answer, for reading. */
  replay: boolean
  steps: ShownStep[]
  index: number
  origin: Point
  editFailed: boolean
  followUp: FollowUpActivity | null
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
  | { type: 'replyArrived'; requestId: string; steps: ShownStep[] }
  | { type: 'threadOpened'; commentId: string; step: ShownStep; origin: Point }
  | { type: 'followUpSent'; requestId: string; text: string; at: number }
  | { type: 'followUpAnswered'; requestId: string; steps: ShownStep[] }
  | { type: 'followUpFailed'; requestId: string; failure: RequestFailure }
  | { type: 'followUpCancelled' }
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

/** True while the answer on screen is held by a follow-up that has no reply yet. */
export function waitsOnFollowUp(state: PointState): boolean {
  return state.phase === 'guiding' && state.followUp?.status === 'waiting'
}

function isLastStep(state: GuidingState): boolean {
  return state.index === state.steps.length - 1
}

function advance(state: GuidingState): PointState {
  if (isLastStep(state)) return idleState
  return {
    ...state,
    index: state.index + 1,
    editFailed: false,
    followUp: null
  }
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

function openThread(
  state: PointState,
  event: Extract<PointEvent, { type: 'threadOpened' }>
): PointState {
  const canOpen =
    state.phase === 'idle' ||
    state.phase === 'failed' ||
    state.phase === 'guiding' ||
    (state.phase === 'annotating' && !state.draft)
  if (!canOpen) return state
  return {
    phase: 'guiding',
    requestId: `thread:${event.commentId}`,
    replay: true,
    steps: [event.step],
    index: 0,
    origin: event.origin,
    editFailed: false,
    followUp: null
  }
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
    replay: false,
    steps: event.steps,
    index: 0,
    origin: state.origin,
    editFailed: false,
    followUp: null
  }
}

function reduceHeld(
  state: GuidingState,
  held: WaitingFollowUp,
  event: PointEvent
): PointState {
  switch (event.type) {
    case 'followUpAnswered':
      if (event.requestId !== held.requestId || event.steps.length === 0)
        return state
      return {
        ...state,
        replay: false,
        editFailed: false,
        followUp: null,
        steps: [
          ...state.steps.slice(0, state.index),
          ...event.steps,
          ...state.steps.slice(state.index + 1)
        ]
      }
    case 'followUpFailed':
      return event.requestId === held.requestId
        ? {
            ...state,
            followUp: {
              status: 'failed',
              text: held.text,
              failure: event.failure
            }
          }
        : state
    case 'followUpCancelled':
    case 'dismissed':
      return { ...state, followUp: null }
    case 'targetRemoved':
      return idleState
    default:
      return state
  }
}

function sendFollowUp(
  state: GuidingState,
  event: Extract<PointEvent, { type: 'followUpSent' }>
): PointState {
  const text = event.text.trim()
  if (!text || state.steps[state.index].annotationId === null) return state
  return {
    ...state,
    followUp: {
      status: 'waiting',
      requestId: event.requestId,
      text,
      startedAt: event.at
    }
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
    case 'followUpSent':
      return sendFollowUp(state, event)
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

/**
 * Pure transition: an event that means nothing in the current phase returns
 * `state`. While a follow-up waits, the answer on screen is held: only its
 * reply, its failure, a cancel or the loss of the target changes anything.
 */
export function reducePointState(
  state: PointState,
  event: PointEvent
): PointState {
  if (state.phase === 'guiding' && state.followUp?.status === 'waiting')
    return reduceHeld(state, state.followUp, event)
  switch (event.type) {
    case 'dismissed':
      return dismiss(state)
    case 'annotateToggled':
      return toggleAnnotate(state, event.selection)
    case 'draftOpened':
      return openDraft(state, event.draft)
    case 'batchSent':
      return sendBatch(state, event)
    case 'threadOpened':
      return openThread(state, event)
    default:
      return reducePhase(state, event)
  }
}
