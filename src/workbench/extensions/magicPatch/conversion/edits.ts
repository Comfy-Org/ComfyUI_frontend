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
 * Renders edits as a unified diff, for review and for upstream PRs.
 *
 * The edits are the data; this is a view of them.
 */
export function toUnifiedDiff(
  source: string,
  edits: readonly Edit[],
  filename: string,
  context = 3
): string {
  if (!edits.length) return ''

  const before = source.split('\n')
  const touched = new Set(edits.map((e) => e.line))
  const byLine = new Map(edits.map((e) => [e.line, e]))

  // Group touched lines into hunks separated by more than 2*context lines.
  const sorted = [...touched].sort((a, b) => a - b)
  const hunks: number[][] = []
  for (const line of sorted) {
    const last = hunks.at(-1)
    if (last && line - last.at(-1)! <= context * 2) last.push(line)
    else hunks.push([line])
  }

  const out = [`--- a/${filename}`, `+++ b/${filename}`]
  for (const hunk of hunks) {
    const start = Math.max(1, hunk[0] - context)
    const end = Math.min(before.length, hunk.at(-1)! + context)

    const removed = hunk.length
    const added = hunk.filter((l) => byLine.get(l)!.op === 'replace').length
    const oldCount = end - start + 1
    out.push(
      `@@ -${start},${oldCount} +${start},${oldCount - removed + added} @@`
    )

    for (let line = start; line <= end; line++) {
      const edit = byLine.get(line)
      if (!edit) {
        out.push(` ${before[line - 1]}`)
      } else {
        out.push(`-${before[line - 1]}`)
        if (edit.op === 'replace') out.push(`+${edit.text}`)
      }
    }
  }
  return out.join('\n')
}
