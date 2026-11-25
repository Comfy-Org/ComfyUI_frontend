import type { ChatSearchRange } from './chatHistorySearch'

const ELLIPSIS = '…'

interface Piece {
  from: number
  to: number
}

interface Layout {
  pieces: Piece[]
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

function windowLayout(len: number, max: number, keep: ChatSearchRange) {
  const inner = max - 2
  const lead = Math.floor((inner - Math.min(inner, keep.end - keep.start)) / 2)
  const from = Math.max(1, Math.min(keep.start - lead, len - 1 - inner))
  return {
    pieces: [{ from, to: from + inner }],
    leading: true,
    trailing: true
  }
}

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

  if (max - 2 < 1) return fallback
  return windowLayout(len, max, keep)
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

/** Shortens text to at most `maxChars` with a middle ellipsis. */
export function middleTruncate(text: string, maxChars: number): string {
  if (maxChars <= 0) return ''
  if (text.length <= maxChars) return text
  if (maxChars === 1) return ELLIPSIS
  return render(text, layoutFor(text.length, maxChars)).text
}

/** Middle truncation that keeps the first range visible and remaps ranges. */
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
