import type { ChatSearchRange } from './chatHistorySearch'

const ELLIPSIS = '…'

/** A kept slice `[from, to)` of the original text. */
interface Piece {
  from: number
  to: number
}

interface Layout {
  pieces: Piece[]
  /** Ellipsis before the first piece / after the last (windowed layout). */
  leading: boolean
  trailing: boolean
}

function headTailLayout(len: number, head: number, tail: number): Layout {
  return {
    pieces: [
      { from: 0, to: head },
      { from: len - tail, to: len }
    ],
    leading: false,
    trailing: false
  }
}

/**
 * Chooses which parts of `text` to keep within `max` characters, ellipsis
 * included. The default keeps a head and a tail with the ellipsis between them
 * and gives the tail the extra character (version suffixes live there). When
 * `keep` would be cut, the head/tail split shifts toward it; a match that sits
 * in the middle of a very long text falls back to a window around it.
 */
function layoutFor(len: number, max: number, keep?: ChatSearchRange): Layout {
  const budget = max - 1
  const defaultHead = Math.floor(budget / 2)
  const defaultTail = budget - defaultHead
  const fallback = headTailLayout(len, defaultHead, defaultTail)
  if (!keep || keep.end <= defaultHead || keep.start >= len - defaultTail) {
    return fallback
  }

  const nearHead = keep.start < len - keep.end
  const headFits = keep.end <= budget - 1
  const tailFits = len - keep.start <= budget - 1
  if (headFits && (nearHead || !tailFits)) {
    return headTailLayout(len, keep.end, budget - keep.end)
  }
  if (tailFits) {
    const tail = len - keep.start
    return headTailLayout(len, budget - tail, tail)
  }

  const inner = max - 2
  if (inner < 1) return fallback
  const lead = Math.floor((inner - Math.min(inner, keep.end - keep.start)) / 2)
  const from = Math.max(1, Math.min(keep.start - lead, len - 1 - inner))
  return {
    pieces: [{ from, to: from + inner }],
    leading: true,
    trailing: true
  }
}

function render(text: string, layout: Layout) {
  const { pieces, leading, trailing } = layout
  let out = leading ? ELLIPSIS : ''
  const starts: number[] = []
  pieces.forEach((piece, i) => {
    if (i > 0) out += ELLIPSIS
    starts.push(out.length)
    out += text.slice(piece.from, piece.to)
  })
  if (trailing) out += ELLIPSIS
  return { text: out, starts }
}

/**
 * Shortens `text` to at most `maxChars` characters with an ellipsis in the
 * middle, keeping the head and the tail. Text that already fits is returned
 * unchanged.
 */
export function middleTruncate(text: string, maxChars: number): string {
  if (maxChars <= 0) return ''
  if (text.length <= maxChars) return text
  if (maxChars === 1) return ELLIPSIS
  return render(text, layoutFor(text.length, maxChars)).text
}

/**
 * `middleTruncate` that keeps the first of `ranges` visible when it can, and
 * returns the ranges re-expressed against the truncated text. `visible` is
 * true when at least one range survives whole (or there is nothing to match).
 */
export function middleTruncateWithRanges(
  text: string,
  maxChars: number,
  ranges: readonly ChatSearchRange[]
): { text: string; ranges: ChatSearchRange[]; visible: boolean } {
  if (text.length <= maxChars) {
    return { text, ranges: ranges.map((r) => ({ ...r })), visible: true }
  }
  if (maxChars <= 1) {
    return {
      text: maxChars === 1 ? ELLIPSIS : '',
      ranges: [],
      visible: ranges.length === 0
    }
  }

  const layout = layoutFor(text.length, maxChars, ranges[0])
  const { text: out, starts } = render(text, layout)
  const mapped: ChatSearchRange[] = []
  let visible = ranges.length === 0

  for (const range of ranges) {
    let wholeShown = false
    layout.pieces.forEach((piece, i) => {
      const start = Math.max(range.start, piece.from)
      const end = Math.min(range.end, piece.to)
      if (start >= end) return
      mapped.push({
        start: starts[i] + start - piece.from,
        end: starts[i] + end - piece.from
      })
      if (start === range.start && end === range.end) wholeShown = true
    })
    visible ||= wholeShown
  }
  return { text: out, ranges: mapped, visible }
}
