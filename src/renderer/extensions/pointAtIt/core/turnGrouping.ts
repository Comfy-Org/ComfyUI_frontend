import { messages } from './messages'
import type { Conversation, Turn } from './turns'

const LABEL_CHARS = 60

export interface StripOptions {
  visibleDots: number
  barSize: number
}

export interface TurnQuestion {
  commentId: string
  text: string
}

export interface TurnCard {
  turnId: string
  number: number
  questions: TurnQuestion[]
  more: string
  answer: string
  position: string
  sentAt: number
  time: string
  thinking: string
  label: string
}

export interface DotItem {
  kind: 'dot'
  card: TurnCard
}

export interface BarItem {
  kind: 'bar'
  id: string
  turnIds: string[]
  title: string
  range: string
  count: string
  turns: TurnCard[]
  label: string
}

export interface CurrentItem {
  kind: 'current'
  label: string
}

export type StripItem = DotItem | BarItem | CurrentItem

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit'
})

function formatTime(at: number): string {
  return timeFormat.format(at)
}

function formatRange(from: number, to: number): string {
  return from === to ? formatTime(from) : timeFormat.formatRange(from, to)
}

function shortened(text: string): string {
  const single = text.replace(/\s+/g, ' ').trim()
  return single.length > LABEL_CHARS
    ? `${single.slice(0, LABEL_CHARS)}…`
    : single
}

function cardOf(turn: Turn, number: number, total: number): TurnCard {
  const questions = turn.comments.map((comment) => ({
    commentId: comment.id,
    text: comment.comment
  }))
  const first = questions.at(0)?.text ?? ''
  return {
    turnId: turn.id,
    number,
    questions,
    more:
      questions.length > 1 ? messages.moreQuestions(questions.length - 1) : '',
    answer: turn.steps.at(0)?.text ?? '',
    position: messages.turnPosition(number, total),
    sentAt: turn.sentAt,
    time: formatTime(turn.sentAt),
    thinking: turn.thinking,
    label: messages.turnDotLabel(number, total, shortened(first))
  }
}

export function turnCards(conversation: Conversation): TurnCard[] {
  const { turns } = conversation
  return turns.map((turn, index) => cardOf(turn, index + 1, turns.length))
}

function barOf(cards: readonly TurnCard[]): BarItem | null {
  const first = cards.at(0)
  const last = cards.at(-1)
  if (!first || !last) return null
  const title = first.questions.at(0)?.text ?? ''
  return {
    kind: 'bar',
    id: first.turnId,
    turnIds: cards.map((card) => card.turnId),
    title,
    range: formatRange(first.sentAt, last.sentAt),
    count: messages.turnCount(cards.length),
    turns: [...cards],
    label: messages.turnBarLabel(first.number, last.number, shortened(title))
  }
}

export function turnStripItems(
  conversation: Conversation,
  options: StripOptions
): StripItem[] {
  const { turns, unsent } = conversation
  if (turns.length === 0) return []
  const cards = turnCards(conversation)
  const dots = Math.max(0, Math.floor(options.visibleDots))
  const barSize = Math.max(1, Math.floor(options.barSize))
  const folded = Math.max(0, cards.length - dots)
  const bars: BarItem[] = []
  for (let start = 0; start < folded; start += barSize) {
    const end = Math.min(start + barSize, folded)
    const bar = barOf(cards.slice(start, end))
    if (bar) bars.push(bar)
  }
  return [
    ...bars,
    ...cards.slice(folded).map((card): DotItem => ({ kind: 'dot', card })),
    { kind: 'current', label: messages.nextTurnLabel(unsent.length) }
  ]
}

export function turnOfAnswer(
  conversation: Conversation,
  annotationId: string | null
): string | null {
  if (annotationId === null) return null
  return (
    conversation.turns.find((turn) =>
      turn.comments.some((comment) => comment.id === annotationId)
    )?.id ?? null
  )
}
