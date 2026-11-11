import type { AnnotationNote, HistoryTurn } from './agentReply'
import { messages } from './messages'
import type { GuidanceStep } from './replyValidation'
import type { AnnotationTarget, SettingValue } from './targetAddress'

/** One pinned comment. */
export interface Annotation {
  id: string
  targets: AnnotationTarget[]
  label: string
  comment: string
}

/** How the person acted on a step: took the offered value, or changed it themselves. */
type StepResult = 'accepted' | 'changed'

interface AnsweredStep extends GuidanceStep {
  result: StepResult | null
  /** What the setting held before the person acted on the step. */
  valueBefore: SettingValue | null
}

/** One Send and the agent's reply to it. Its comments are locked. */
export interface Turn {
  id: string
  comments: Annotation[]
  steps: AnsweredStep[]
  thinking: string
}

/** Every answered turn, oldest first, and the comments not sent yet. */
export interface Conversation {
  turns: readonly Turn[]
  unsent: readonly Annotation[]
}

export type ConversationEvent =
  | {
      type: 'saved'
      id: string
      targets: AnnotationTarget[]
      label: string
      comment: string
    }
  | { type: 'removed'; id: string }
  | { type: 'unsentCleared' }
  | {
      type: 'answered'
      turnId: string
      steps: GuidanceStep[]
      thinking: string
    }
  | {
      type: 'actedOn'
      turnId: string
      stepIndex: number
      result: StepResult
      valueBefore: SettingValue | null
    }
  | { type: 'startedOver' }

/** A comment with the number shown on its pin and the turn it is locked in. */
export interface NumberedComment {
  annotation: Annotation
  number: number
  turn: Turn | null
}

export const emptyConversation: Conversation = { turns: [], unsent: [] }

function isLocked(state: Conversation, id: string): boolean {
  return state.turns.some((turn) =>
    turn.comments.some((comment) => comment.id === id)
  )
}

function save(
  state: Conversation,
  event: Extract<ConversationEvent, { type: 'saved' }>
): Conversation {
  const comment = event.comment.trim()
  if (!comment || isLocked(state, event.id)) return state
  const saved = {
    id: event.id,
    targets: event.targets,
    label: event.label,
    comment
  }
  const isUnsent = state.unsent.some((unsent) => unsent.id === event.id)
  return {
    ...state,
    unsent: isUnsent
      ? state.unsent.map((unsent) => (unsent.id === event.id ? saved : unsent))
      : [...state.unsent, saved]
  }
}

function answer(
  state: Conversation,
  event: Extract<ConversationEvent, { type: 'answered' }>
): Conversation {
  if (state.unsent.length === 0) return state
  const turn: Turn = {
    id: event.turnId,
    comments: [...state.unsent],
    steps: event.steps.map((step) => ({
      ...step,
      result: null,
      valueBefore: null
    })),
    thinking: event.thinking
  }
  return { turns: [...state.turns, turn], unsent: [] }
}

function actOn(
  state: Conversation,
  event: Extract<ConversationEvent, { type: 'actedOn' }>
): Conversation {
  const turn = state.turns.find((candidate) => candidate.id === event.turnId)
  if (!turn || event.stepIndex >= turn.steps.length) return state
  const steps = turn.steps.map((step, index) =>
    index === event.stepIndex
      ? { ...step, result: event.result, valueBefore: event.valueBefore }
      : step
  )
  return {
    ...state,
    turns: state.turns.map((candidate) =>
      candidate === turn ? { ...turn, steps } : candidate
    )
  }
}

/** Pure transition for the turns and the unsent comments. */
export function reduceConversation(
  state: Conversation,
  event: ConversationEvent
): Conversation {
  switch (event.type) {
    case 'saved':
      return save(state, event)
    case 'removed':
      return state.unsent.some((unsent) => unsent.id === event.id)
        ? {
            ...state,
            unsent: state.unsent.filter((unsent) => unsent.id !== event.id)
          }
        : state
    case 'unsentCleared':
      return state.unsent.length === 0 ? state : { ...state, unsent: [] }
    case 'answered':
      return answer(state, event)
    case 'actedOn':
      return actOn(state, event)
    case 'startedOver':
      return state.turns.length === 0 && state.unsent.length === 0
        ? state
        : emptyConversation
  }
}

/** Every comment in the order of its number; numbers continue across turns. */
export function numberedComments(state: Conversation): NumberedComment[] {
  const locked = state.turns.flatMap((turn) =>
    turn.comments.map((annotation) => ({ annotation, turn }))
  )
  const unsent = state.unsent.map((annotation) => ({ annotation, turn: null }))
  return [...locked, ...unsent].map((comment, index) => ({
    ...comment,
    number: index + 1
  }))
}

/**
 * The agent's steps for one locked comment, for reading again: nothing to
 * wait for and nothing offered. Says so when the agent gave it no step.
 */
export function replaySteps(turn: Turn, commentId: string): GuidanceStep[] {
  const steps = turn.steps.filter((step) => step.annotationId === commentId)
  if (steps.length === 0)
    return [
      {
        annotationId: commentId,
        text: messages.noAnswerForComment,
        target: null,
        waitFor: null,
        offerEdit: null,
        problems: []
      }
    ]
  return steps.map((step) => ({
    annotationId: step.annotationId,
    text: step.text,
    target: step.target,
    waitFor: null,
    offerEdit: null,
    problems: step.problems
  }))
}

export function noteOf(annotation: Annotation): AnnotationNote {
  return {
    id: annotation.id,
    label: annotation.label,
    comment: annotation.comment,
    targets: annotation.targets
  }
}

/** The answered turns as the agent is reminded of them, oldest first. */
export function historyOf(state: Conversation): HistoryTurn[] {
  return state.turns.map((turn) => ({
    comments: turn.comments.map(noteOf),
    answer: turn.steps.map((step) => ({
      annotationId: step.annotationId,
      text: step.text,
      target: step.target,
      offered: step.offerEdit,
      result: step.result,
      valueBefore: step.valueBefore
    }))
  }))
}
