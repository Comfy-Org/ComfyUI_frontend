import type { ChatSearchField, ChatSearchRange } from './chatHistorySearch'
import { middleTruncateWithRanges } from './middleTruncate'

/**
 * Character budgets for a search-result row at the 420 px dock (the panel's
 * minimum width). Derived from the row's layout, not measured: the text column
 * is ~300 px wide (404 px row minus padding, status icon, copy and menu
 * buttons) and 12 px UI text averages ~6.5 px per character. Deciding
 * visibility from budgets keeps the row pure and testable; the CSS `truncate`
 * on each line is only the safety net for wider glyphs.
 */
/** Characters of the title that fit on its single line. */
export const DOCK_TITLE_CHARS = 44
/** Characters of the preview that fit on its single line. */
export const DOCK_PREVIEW_CHARS = 44
/** Workflow name cap in the meta-line tail (≈ 117 px). */
export const WORKFLOW_TAIL_CHARS = 18
/**
 * The tail shrinks to this while the "current" marker shares the meta line,
 * before anything else gives way (the date never truncates).
 */
export const WORKFLOW_TAIL_MIN_CHARS = 8
/** Characters of source text shown in a `Label: …` match line. */
export const MATCH_LINE_CHARS = 40
/** Characters of context kept before the match in a match line. */
const MATCH_LINE_LEAD_CHARS = 12

const ELLIPSIS = '…'

export interface HighlightPart {
  text: string
  highlighted: boolean
}

type FieldRanges = Partial<Record<ChatSearchField, ChatSearchRange[]>>

/** Sorts, clamps to `[0, length]` and merges; drops empty ranges. */
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

/**
 * Splits `text` into plain / matched segments for rendering as text nodes.
 * Adjacent ranges stay separate segments; overlapping ones are merged.
 */
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

/**
 * A short window of `text` around the first range, with `…` where text was
 * cut, as segments with the ranges inside the window highlighted.
 */
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

function workflowTailChars(narrow: boolean, current: boolean): number {
  if (narrow) return 0
  return current ? WORKFLOW_TAIL_MIN_CHARS : WORKFLOW_TAIL_CHARS
}

function fitsBudget(ranges: readonly ChatSearchRange[], budget: number) {
  return ranges.length === 0 || ranges.some((r) => r.end <= budget)
}

export interface ChatRowInput {
  /** Raw session title; the row displays it trimmed. */
  title: string
  preview?: string
  workflowName?: string
  ranges: FieldRanges
  /** Dock narrower than ~350 px: the whole workflow tail is dropped. */
  narrow: boolean
  /** The "current chat" marker shares the meta line. */
  current: boolean
}

export interface ChatRowPlan {
  /** Segments of the trimmed title (empty when untitled). */
  titleParts: HighlightPart[]
  /** Preview line; absent when no preview or a match line replaces it. */
  previewParts?: HighlightPart[]
  /** Workflow name as shown in the meta-line tail; absent when dropped. */
  workflowParts?: HighlightPart[]
  /** One `Label: …` line for the highest-priority hidden match. */
  matchLine?: { field: ChatSearchField; parts: HighlightPart[] }
}

/**
 * Decides what a result row shows. A matched field whose match is not visible
 * in the row gets a match line; priority is title, workflow name, preview and
 * at most one line is shown. A workflow match counts as visible when it
 * survives the tail's middle-ellipsis window.
 */
export function planChatRow(input: ChatRowInput): ChatRowPlan {
  const { preview, workflowName, ranges, narrow, current } = input
  const displayTitle = input.title.trim()
  const lead = input.title.length - input.title.trimStart().length
  const titleRanges = (ranges.title ?? []).map((r) => ({
    start: r.start - lead,
    end: r.end - lead
  }))
  const previewRanges = ranges.preview ?? []
  const workflowRanges = ranges.workflowName ?? []

  const tailChars = workflowName ? workflowTailChars(narrow, current) : 0
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
