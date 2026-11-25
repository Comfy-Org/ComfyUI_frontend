import type { ChatSearchField, ChatSearchRange } from './chatHistorySearch'
import { middleTruncateWithRanges } from './middleTruncate'

/** Title characters that fit on one line at the 420 px dock. */
export const DOCK_TITLE_CHARS = 44
/** Preview characters that fit on one line at the 420 px dock. */
export const DOCK_PREVIEW_CHARS = 44
/** Workflow name characters shown in the meta-line tail. */
export const WORKFLOW_TAIL_CHARS = 18
/** Tail characters left while the current-chat marker shares the line. */
export const WORKFLOW_TAIL_MIN_CHARS = 8
/** Source characters shown in a match line. */
export const MATCH_LINE_CHARS = 40
const MATCH_LINE_LEAD_CHARS = 12

const ELLIPSIS = '…'

export interface HighlightPart {
  text: string
  highlighted: boolean
}

type FieldRanges = Partial<Record<ChatSearchField, ChatSearchRange[]>>

function normalize(
  ranges: readonly ChatSearchRange[],
  length: number
): ChatSearchRange[] {
  const out: ChatSearchRange[] = []
  const sorted = ranges
    .map((r) => ({
      start: Math.max(0, r.start),
      end: Math.min(length, r.end)
    }))
    .filter((r) => r.start < r.end)
    .sort((a, b) => a.start - b.start || a.end - b.end)
  for (const range of sorted) {
    const last = out.at(-1)
    if (last && range.start < last.end) last.end = Math.max(last.end, range.end)
    else out.push(range)
  }
  return out
}

/** Splits text into plain and highlighted segments; overlaps are merged. */
export function splitByRanges(
  text: string,
  ranges: readonly ChatSearchRange[]
): HighlightPart[] {
  if (!text) return []
  const parts: HighlightPart[] = []
  let cursor = 0
  for (const { start, end } of normalize(ranges, text.length)) {
    if (start > cursor) {
      parts.push({ text: text.slice(cursor, start), highlighted: false })
    }
    parts.push({ text: text.slice(start, end), highlighted: true })
    cursor = end
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), highlighted: false })
  }
  return parts
}

/** A short window around the first range, with `…` where text was cut. */
export function matchWindow(
  text: string,
  ranges: readonly ChatSearchRange[],
  maxChars = MATCH_LINE_CHARS
): HighlightPart[] {
  const normalized = normalize(ranges, text.length)
  const first = normalized.at(0)
  const from = first
    ? Math.max(0, Math.min(first.start - MATCH_LINE_LEAD_CHARS, text.length))
    : 0
  const to = Math.min(text.length, from + maxChars)
  const prefix = from > 0 ? ELLIPSIS : ''
  const suffix = to < text.length ? ELLIPSIS : ''
  const inside = normalized
    .filter((r) => r.start < to && r.end > from)
    .map((r) => ({
      start: Math.max(r.start, from) - from + prefix.length,
      end: Math.min(r.end, to) - from + prefix.length
    }))
  return splitByRanges(prefix + text.slice(from, to) + suffix, inside)
}

function workflowTailChars(current: boolean): number {
  return current ? WORKFLOW_TAIL_MIN_CHARS : WORKFLOW_TAIL_CHARS
}

function fitsBudget(ranges: readonly ChatSearchRange[], budget: number) {
  return ranges.length === 0 || ranges.some((r) => r.end <= budget)
}

export interface ChatRowInput {
  title: string
  preview?: string
  workflowName?: string
  ranges: FieldRanges
  current: boolean
}

export interface ChatRowPlan {
  titleParts: HighlightPart[]
  previewParts?: HighlightPart[]
  workflowParts?: HighlightPart[]
  matchLine?: { field: ChatSearchField; parts: HighlightPart[] }
}

/** Plans a result row; one match line shows the first hidden match. */
export function planChatRow(input: ChatRowInput): ChatRowPlan {
  const { preview, workflowName, ranges, current } = input
  const displayTitle = input.title.trim()
  const lead = input.title.length - input.title.trimStart().length
  const titleRanges = (ranges.title ?? []).map((r) => ({
    start: r.start - lead,
    end: r.end - lead
  }))
  const previewRanges = ranges.preview ?? []
  const workflowRanges = ranges.workflowName ?? []

  const tailChars = workflowName ? workflowTailChars(current) : 0
  const tail =
    workflowName && tailChars > 0
      ? middleTruncateWithRanges(workflowName, tailChars, workflowRanges)
      : undefined

  const hidden: Record<ChatSearchField, boolean> = {
    title: !fitsBudget(
      normalize(titleRanges, displayTitle.length),
      DOCK_TITLE_CHARS
    ),
    workflowName: workflowRanges.length > 0 && !tail?.visible,
    preview: !fitsBudget(previewRanges, DOCK_PREVIEW_CHARS)
  }

  const field = (['title', 'workflowName', 'preview'] as const).find(
    (f) => hidden[f]
  )
  const source = {
    title: [displayTitle, titleRanges],
    workflowName: [workflowName ?? '', workflowRanges],
    preview: [preview ?? '', previewRanges]
  } as const
  const matchLine = field
    ? { field, parts: matchWindow(source[field][0], source[field][1]) }
    : undefined

  return {
    titleParts: splitByRanges(displayTitle, titleRanges),
    previewParts:
      preview && !matchLine ? splitByRanges(preview, previewRanges) : undefined,
    workflowParts: tail ? splitByRanges(tail.text, tail.ranges) : undefined,
    matchLine
  }
}
