import type {
  AnnotationNote,
  HistoryStep,
  HistoryTurn,
  ThreadNote
} from './agentReply'
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

/** A step of an answer and what the person did about it. */
export interface AnsweredStep extends GuidanceStep {
  result: StepResult | null
  /** What the setting held before the person acted on the step. */
  valueBefore: SettingValue | null
}

/** A follow-up inside one comment's thread and the agent's reply to it. */
interface FollowUp {
  id: string
  commentId: string
  text: string
  steps: AnsweredStep[]
  thinking: string
}

/** One Send and the agent's reply to it. Its comments are locked. */
export interface Turn {
  id: string
  sentAt: number
  comments: Annotation[]
  steps: AnsweredStep[]
  thinking: string
  /** Every answered follow-up of the turn's threads, oldest first. */
  followUps: FollowUp[]
}

/** Every answered turn, oldest first, and the comments not sent yet. */
export interface Conversation {
  turns: readonly Turn[]
  unsent: readonly Annotation[]
}

/** Where an answer step is recorded: in a turn's answer or in a follow-up's reply. */
export interface StepRef {
  turnId: string
  followUpId: string | null
  index: number
}

/** A step on screen; `ref` is null when it is not recorded in a turn. */
export interface ShownStep extends GuidanceStep {
  ref: StepRef | null
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
      sentAt: number
      steps: GuidanceStep[]
      thinking: string
    }
  | {
      type: 'followedUp'
      commentId: string
      followUpId: string
      text: string
      steps: GuidanceStep[]
      thinking: string
    }
  | {
      type: 'actedOn'
      ref: StepRef
      result: StepResult
      valueBefore: SettingValue | null
    }
  | { type: 'startedOver' }

/** A comment with the number shown on its pin and the turn it is locked in. */
export interface NumberedComment {
  annotation: Annotation
  number: number
  turn: Turn | null
  /** How many answered follow-ups its thread has. */
  followUps: number
}

/** One message of a thread, in the order it was said. */
export type ThreadMessage =
  | { kind: 'comment'; text: string }
  | { kind: 'followUp'; id: string; text: string; thinking: string }
  | { kind: 'answer'; ref: StepRef; step: AnsweredStep }

/** One answered comment with everything said about it since. */
export interface Thread {
  turnId: string
  comment: Annotation
  messages: ThreadMessage[]
}

export const emptyConversation: Conversation = { turns: [], unsent: [] }

function turnOf(state: Conversation, commentId: string): Turn | undefined {
  return state.turns.find((turn) =>
    turn.comments.some((comment) => comment.id === commentId)
  )
}

function withTurn(state: Conversation, turn: Turn, changed: Turn) {
  return {
    ...state,
    turns: state.turns.map((candidate) =>
      candidate === turn ? changed : candidate
    )
  }
}

function unacted(step: GuidanceStep): AnsweredStep {
  return { ...step, result: null, valueBefore: null }
}

function save(
  state: Conversation,
  event: Extract<ConversationEvent, { type: 'saved' }>
): Conversation {
  const comment = event.comment.trim()
  if (!comment || turnOf(state, event.id)) return state
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
    sentAt: event.sentAt,
    comments: [...state.unsent],
    steps: event.steps.map(unacted),
    thinking: event.thinking,
    followUps: []
  }
  return { turns: [...state.turns, turn], unsent: [] }
}

function followUp(
  state: Conversation,
  event: Extract<ConversationEvent, { type: 'followedUp' }>
): Conversation {
  const text = event.text.trim()
  const turn = turnOf(state, event.commentId)
  if (!turn || !text || event.steps.length === 0) return state
  const added: FollowUp = {
    id: event.followUpId,
    commentId: event.commentId,
    text,
    steps: event.steps.map(unacted),
    thinking: event.thinking
  }
  return withTurn(state, turn, {
    ...turn,
    followUps: [...turn.followUps, added]
  })
}

function actOn(
  state: Conversation,
  event: Extract<ConversationEvent, { type: 'actedOn' }>
): Conversation {
  const { ref, result, valueBefore } = event
  const turn = state.turns.find((candidate) => candidate.id === ref.turnId)
  if (!turn) return state
  function marked(steps: AnsweredStep[]): AnsweredStep[] {
    return steps.map((step, index) =>
      index === ref.index ? { ...step, result, valueBefore } : step
    )
  }
  if (ref.followUpId === null)
    return ref.index < turn.steps.length
      ? withTurn(state, turn, { ...turn, steps: marked(turn.steps) })
      : state
  const replied = turn.followUps.find(
    (candidate) => candidate.id === ref.followUpId
  )
  if (!replied || ref.index >= replied.steps.length) return state
  return withTurn(state, turn, {
    ...turn,
    followUps: turn.followUps.map((candidate) =>
      candidate === replied
        ? { ...replied, steps: marked(replied.steps) }
        : candidate
    )
  })
}

/** Pure transition for the turns, their threads and the unsent comments. */
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
    case 'followedUp':
      return followUp(state, event)
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
    turn.comments.map((annotation) => ({
      annotation,
      turn,
      followUps: turn.followUps.filter(
        (candidate) => candidate.commentId === annotation.id
      ).length
    }))
  )
  const unsent = state.unsent.map((annotation) => ({
    annotation,
    turn: null,
    followUps: 0
  }))
  return [...locked, ...unsent].map((comment, index) => ({
    ...comment,
    number: index + 1
  }))
}

/** The thread of an answered comment; null for an unsent or unknown one. */
export function threadOf(
  state: Conversation,
  commentId: string
): Thread | null {
  const turn = turnOf(state, commentId)
  const comment = turn?.comments.find((candidate) => candidate.id === commentId)
  if (!turn || !comment) return null
  const turnId = turn.id
  function answers(
    steps: AnsweredStep[],
    followUpId: string | null
  ): ThreadMessage[] {
    return steps.flatMap((step, index): ThreadMessage[] =>
      step.annotationId === commentId
        ? [
            {
              kind: 'answer',
              ref: { turnId, followUpId, index },
              step
            }
          ]
        : []
    )
  }
  return {
    turnId,
    comment,
    messages: [
      { kind: 'comment', text: comment.comment },
      ...answers(turn.steps, null),
      ...turn.followUps
        .filter((candidate) => candidate.commentId === commentId)
        .flatMap((replied): ThreadMessage[] => [
          {
            kind: 'followUp',
            id: replied.id,
            text: replied.text,
            thinking: replied.thinking
          },
          ...answers(replied.steps, replied.id)
        ])
    ]
  }
}

function sameRef(a: StepRef, b: StepRef): boolean {
  return (
    a.turnId === b.turnId &&
    a.followUpId === b.followUpId &&
    a.index === b.index
  )
}

/** What was said in the thread before the step at `ref`; all of it when the step is not in it. */
export function messagesBefore(
  thread: Thread,
  ref: StepRef | null
): ThreadMessage[] {
  const at = ref
    ? thread.messages.findIndex(
        (message) => message.kind === 'answer' && sameRef(message.ref, ref)
      )
    : -1
  return at < 0 ? thread.messages : thread.messages.slice(0, at)
}

/**
 * The step shown when a thread is opened: its latest answer, for reading
 * again, with nothing to wait for and nothing offered. Says so when the
 * agent gave the comment no step.
 */
export function latestAnswer(thread: Thread): ShownStep {
  const latest = thread.messages
    .filter((message) => message.kind === 'answer')
    .at(-1)
  if (!latest)
    return {
      annotationId: thread.comment.id,
      text: messages.noAnswerForComment,
      target: null,
      waitFor: null,
      offerEdit: null,
      problems: [],
      ref: null
    }
  return {
    annotationId: latest.step.annotationId,
    text: latest.step.text,
    target: latest.step.target,
    waitFor: null,
    offerEdit: null,
    problems: latest.step.problems,
    ref: latest.ref
  }
}

export function noteOf(annotation: Annotation): AnnotationNote {
  return {
    id: annotation.id,
    label: annotation.label,
    comment: annotation.comment,
    targets: annotation.targets
  }
}

function historyStep(step: AnsweredStep): HistoryStep {
  return {
    annotationId: step.annotationId,
    text: step.text,
    target: step.target,
    offered: step.offerEdit,
    result: step.result,
    valueBefore: step.valueBefore
  }
}

/** What was said in a thread after its comment, as the agent is reminded of it. */
export function threadNotes(thread: Thread): ThreadNote[] {
  return thread.messages.flatMap((message): ThreadNote[] => {
    if (message.kind === 'comment') return []
    return message.kind === 'followUp'
      ? [{ from: 'person', text: message.text }]
      : [{ from: 'agent', steps: [historyStep(message.step)] }]
  })
}

/**
 * The answered turns as the agent is reminded of them, oldest first, with
 * their threads. `withoutThreadOf` leaves one comment's thread out, for a
 * follow-up that is sent that thread in full.
 */
export function historyOf(
  state: Conversation,
  withoutThreadOf: string | null = null
): HistoryTurn[] {
  return state.turns.map((turn) => ({
    comments: turn.comments
      .filter((comment) => comment.id !== withoutThreadOf)
      .map(noteOf),
    answer: turn.steps
      .filter(
        (step) =>
          withoutThreadOf === null || step.annotationId !== withoutThreadOf
      )
      .map(historyStep),
    followUps: turn.followUps
      .filter((replied) => replied.commentId !== withoutThreadOf)
      .map((replied) => ({
        commentId: replied.commentId,
        text: replied.text,
        answer: replied.steps.map(historyStep)
      }))
  }))
}
