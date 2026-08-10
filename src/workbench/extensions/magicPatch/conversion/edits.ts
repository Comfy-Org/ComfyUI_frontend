/**
 * Conversions as line edits rather than whole converted files.
 *
 * Because artifacts are keyed by the source hash, the input is byte-identical
 * by construction — so an edit needs no fuzzy context matching and applies
 * deterministically. That makes the minimal representation a list of line
 * operations rather than a unified diff.
 *
 * Three consequences, in order of importance:
 *
 * 1. **We stop redistributing other people's code.** Shipping whole converted
 *    files means shipping a copy of every pack we touch, under whatever licence
 *    it carries. A set of line edits is not a copy of the work.
 * 2. **The manifest stays small.** rgthree alone is ~45k lines of JS; its
 *    conversion is one deleted line.
 * 3. **The artifact is reviewable.** A human reviewing 851 packs can read edits;
 *    nobody reads 851 whole files.
 *
 * Rules mutate lines in place and never insert or reorder, which keeps original
 * line numbers stable for reporting *and* makes their edits derivable by index
 * comparison. Agent conversions are not so constrained, so `insert` exists and
 * `diffToEdits` recovers a minimal edit list from a rewritten file.
 */

export interface Edit {
  /** 1-indexed line in the **original** file. */
  readonly line: number
  /** `insert` places `text` immediately before `line`. */
  readonly op: 'delete' | 'replace' | 'insert'
  /** Required for `replace` and `insert`. */
  readonly text?: string
}

/** Compares the rules' working array against the original. */
export function deriveEdits(
  original: string,
  lines: readonly (string | null)[]
): Edit[] {
  const before = original.split('\n')
  const edits: Edit[] = []

  for (const [index, line] of lines.entries()) {
    if (line === null) {
      edits.push({ line: index + 1, op: 'delete' })
    } else if (line !== before[index]) {
      edits.push({ line: index + 1, op: 'replace', text: line })
    }
  }
  return edits
}

export class EditApplicationError extends Error {}

/**
 * Applies edits to the exact source they were derived from.
 *
 * Throws rather than applying partially: a half-applied conversion is a broken
 * pack, and the caller's fallback is to serve the original untouched.
 */
export function applyEdits(source: string, edits: readonly Edit[]): string {
  const lines: (string | null)[] = source.split('\n')
  // Inserts are collected and applied at the end so that they do not shift the
  // indices the remaining edits are expressed in.
  const inserts = new Map<number, string[]>()

  for (const edit of edits) {
    const index = edit.line - 1
    // An insert may sit one past the last line, meaning "append".
    const limit = edit.op === 'insert' ? lines.length + 1 : lines.length
    if (index < 0 || index >= limit) {
      throw new EditApplicationError(
        `Edit targets line ${edit.line}, but the source has ${lines.length} lines. The source does not match the one this conversion was built for.`
      )
    }
    if (edit.op === 'delete') {
      lines[index] = null
    } else if (edit.op === 'insert') {
      if (edit.text === undefined) {
        throw new EditApplicationError(
          `Insert edit at line ${edit.line} carries no text.`
        )
      }
      const at = inserts.get(index) ?? []
      at.push(edit.text)
      inserts.set(index, at)
    } else {
      if (edit.text === undefined) {
        throw new EditApplicationError(
          `Replace edit at line ${edit.line} carries no text.`
        )
      }
      lines[index] = edit.text
    }
  }

  return lines
    .flatMap((line, index) => [...(inserts.get(index) ?? []), line])
    .concat(inserts.get(lines.length) ?? [])
    .filter((l): l is string => l !== null)
    .join('\n')
}

/**
 * Recovers a minimal edit list from a rewritten file.
 *
 * An agent returns a whole converted file, but storing every line as a replace
 * makes the artifact a copy of the pack and buries the two lines that matter in
 * a reformatting diff. A longest-common-subsequence pass keeps only what
 * actually changed.
 */
export function diffToEdits(original: string, converted: string): Edit[] {
  const before = original.split('\n')
  const after = converted.split('\n')

  // LCS table over lines. Files here are small enough that the quadratic table
  // is cheaper than pulling in a diff dependency.
  const lcs: number[][] = Array.from({ length: before.length + 1 }, () =>
    new Array<number>(after.length + 1).fill(0)
  )
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lcs[i][j] =
        before[i] === after[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const edits: Edit[] = []
  let i = 0
  let j = 0
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      edits.push({ line: i + 1, op: 'delete' })
      i++
    } else {
      edits.push({ line: i + 1, op: 'insert', text: after[j] })
      j++
    }
  }
  for (; i < before.length; i++) edits.push({ line: i + 1, op: 'delete' })
  for (; j < after.length; j++) {
    edits.push({ line: before.length + 1, op: 'insert', text: after[j] })
  }

  // A delete paired with the insert that lands just after it is a replace —
  // shorter to store and far easier to read in review. The insert sits at
  // `line + 1` because it is positioned before the *next* original line.
  const pairedWithDelete = (insert: Edit, previous: Edit | undefined) =>
    insert.op === 'insert' &&
    previous?.op === 'delete' &&
    insert.line === previous.line + 1

  return edits.flatMap((edit, index) => {
    const next = edits[index + 1]
    if (edit.op === 'delete' && next && pairedWithDelete(next, edit)) {
      return [{ line: edit.line, op: 'replace' as const, text: next.text }]
    }
    return pairedWithDelete(edit, edits[index - 1]) ? [] : [edit]
  })
}

/**
 * Renders the conversion as a unified diff.
 *
 * The stored form, because a diff is reviewable in any tool a human already
 * has, applies with `patch(1)`, and reads the same in a PR as in the database.
 * Computed from the two texts rather than from an edit list: the previous
 * version rendered from edits, predated the `insert` op, and silently dropped
 * appended lines while emitting a hunk header that disagreed with its own body.
 */
export function toUnifiedDiff(
  original: string,
  converted: string,
  filename: string,
  context = 3
): string {
  const before = original.split('\n')
  if (original === converted) return ''

  // One entry per output row: kept lines carry both indices, a delete carries
  // only the original, an insert only the converted.
  type Row = { kind: ' ' | '-' | '+'; text: string; a?: number; b?: number }
  const rows: Row[] = []
  let i = 0
  let j = 0
  for (const edit of diffToEdits(original, converted)) {
    const at = edit.line - 1
    while (i < at) {
      rows.push({ kind: ' ', text: before[i], a: i, b: j })
      i++
      j++
    }
    if (edit.op === 'delete') {
      rows.push({ kind: '-', text: before[i], a: i })
      i++
    } else if (edit.op === 'replace') {
      rows.push({ kind: '-', text: before[i], a: i })
      rows.push({ kind: '+', text: edit.text ?? '', b: j })
      i++
      j++
    } else {
      rows.push({ kind: '+', text: edit.text ?? '', b: j })
      j++
    }
  }
  while (i < before.length) {
    rows.push({ kind: ' ', text: before[i], a: i, b: j })
    i++
    j++
  }

  // Group changed rows into hunks, padded by `context` unchanged rows.
  const changed = rows
    .map((row, index) => (row.kind === ' ' ? -1 : index))
    .filter((index) => index >= 0)
  if (!changed.length) return ''

  const ranges: [number, number][] = []
  for (const index of changed) {
    const last = ranges.at(-1)
    if (last && index - last[1] <= context * 2) last[1] = index
    else ranges.push([index, index])
  }

  const out = [`--- a/${filename}`, `+++ b/${filename}`]
  for (const [from, to] of ranges) {
    const start = Math.max(0, from - context)
    const end = Math.min(rows.length - 1, to + context)
    const slice = rows.slice(start, end + 1)

    const aLines = slice.filter((r) => r.kind !== '+')
    const bLines = slice.filter((r) => r.kind !== '-')
    const aStart = (aLines[0]?.a ?? 0) + 1
    const bStart = (bLines[0]?.b ?? 0) + 1

    out.push(`@@ -${aStart},${aLines.length} +${bStart},${bLines.length} @@`)
    for (const row of slice) out.push(`${row.kind}${row.text}`)
  }
  return out.join('\n') + '\n'
}

/**
 * Applies a unified diff to the exact source it was built from.
 *
 * Every context and removed line is checked against the source. Because
 * artifacts are keyed by content hash the input is byte-identical by
 * construction, so a mismatch means the entry is being applied to something it
 * was never verified against — which must fail loudly rather than fuzzily
 * succeed the way `patch` would.
 */
export function applyUnifiedDiff(source: string, diff: string): string {
  if (!diff.trim()) return source
  const lines = source.split('\n')
  const out: string[] = []
  let cursor = 0

  const hunkHeader = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/
  const body = diff.split('\n')

  for (let index = 0; index < body.length; index++) {
    const header = hunkHeader.exec(body[index])
    if (!header) continue

    const start = Number(header[1]) - 1
    if (start < cursor) {
      throw new EditApplicationError(
        `Hunk at line ${start + 1} overlaps an earlier one; the diff is not ordered.`
      )
    }
    out.push(...lines.slice(cursor, start))
    cursor = start

    for (index++; index < body.length; index++) {
      const row = body[index]
      if (row.startsWith('@@')) {
        index--
        break
      }
      if (row === '' || row.startsWith('---') || row.startsWith('+++')) continue
      const kind = row[0]
      const text = row.slice(1)
      if (kind === '+') {
        out.push(text)
      } else {
        if (lines[cursor] !== text) {
          throw new EditApplicationError(
            `Diff does not match the source at line ${cursor + 1}: ` +
              `expected ${JSON.stringify(text)}, found ${JSON.stringify(lines[cursor])}. ` +
              `The source is not the one this conversion was built for.`
          )
        }
        if (kind === ' ') out.push(text)
        cursor++
      }
    }
  }
  out.push(...lines.slice(cursor))
  return out.join('\n')
}
