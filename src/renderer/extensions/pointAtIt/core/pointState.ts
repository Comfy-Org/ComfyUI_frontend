import type { AgentReply, GuidanceStep, TargetAddress } from './agentReply'
import { boundsOf } from './geometry'
import type { Point, Rect } from './geometry'

/** A key press shorter than this is a tap, not a hold. */
export const TAP_MS = 300

export interface Chip {
  id: string
  target: TargetAddress
  label: string
}

export interface Mark {
  stroke: Point[]
  anchor: Rect
}

interface IdleState {
  phase: 'idle'
}

interface ArmedState {
  phase: 'armed'
  pressedAt: number
  canMark: boolean
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

interface ThinkingState {
  phase: 'thinking'
  questionId: string
  question: string
  mark: Mark
  chips: Chip[]
}

export interface GuidingState {
  phase: 'guiding'
  questionId: string
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
  | ThinkingState
  | GuidingState

export type PointEvent =
  | { type: 'keyPressed'; at: number; canMark: boolean; canTap: boolean }
  | {
      type: 'keyReleased'
      at: number
      selection: { chips: Chip[]; anchor: Rect } | null
    }
  | { type: 'pointerPressed'; point: Point }
  | { type: 'pointerMoved'; point: Point }
  | { type: 'pointerReleased'; chips: Chip[] }
  | { type: 'chipRemoved'; chipId: string }
  | { type: 'questionSent'; questionId: string; text: string }
  | { type: 'replyArrived'; reply: AgentReply }
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

function releaseKey(
  state: ArmedState,
  event: Extract<PointEvent, { type: 'keyReleased' }>
): PointState {
  const tapped = event.at - state.pressedAt <= TAP_MS
  if (!tapped || !event.selection?.chips.length) return idleState
  return {
    phase: 'asking',
    mark: { stroke: [], anchor: event.selection.anchor },
    chips: event.selection.chips
  }
}

function startGuiding(state: ThinkingState, reply: AgentReply): PointState {
  if (reply.questionId !== state.questionId) return state
  if (reply.steps.length === 0) return idleState
  const { anchor } = state.mark
  return {
    phase: 'guiding',
    questionId: reply.questionId,
    steps: reply.steps,
    index: 0,
    origin: { x: anchor.x, y: anchor.y + anchor.height },
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

/** Pure transition: an event that means nothing in the current phase returns `state`. */
export function reducePointState(
  state: PointState,
  event: PointEvent
): PointState {
  if (event.type === 'dismissed') {
    return state.phase === 'idle' ? state : idleState
  }
  switch (state.phase) {
    case 'idle':
      return event.type === 'keyPressed' && (event.canMark || event.canTap)
        ? { phase: 'armed', pressedAt: event.at, canMark: event.canMark }
        : state
    case 'armed':
      if (event.type === 'keyReleased') return releaseKey(state, event)
      return event.type === 'pointerPressed' && state.canMark
        ? { phase: 'marking', stroke: [event.point] }
        : state
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
      if (event.type === 'chipRemoved')
        return {
          ...state,
          chips: state.chips.filter((chip) => chip.id !== event.chipId)
        }
      return event.type === 'questionSent' && event.text.trim()
        ? {
            phase: 'thinking',
            questionId: event.questionId,
            question: event.text.trim(),
            mark: state.mark,
            chips: state.chips
          }
        : state
    case 'thinking':
      return event.type === 'replyArrived'
        ? startGuiding(state, event.reply)
        : state
    case 'guiding':
      return reduceGuiding(state, event)
  }
}
