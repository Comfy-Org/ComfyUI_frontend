/**
 * The layered lookup every translated string goes through.
 *
 * Kept pure and free of imports so it can be unit-tested directly, and so the
 * file that holds the approved copy can use it without pulling the pipeline's
 * tooling into the page bundle.
 */

/**
 * Which layer answered. The pipeline needs this, not just the string: it decides
 * whether a value may be re-translated, whether the reviewer may prune it, and
 * whether a page that used it is complete enough to be indexed.
 */
type Provenance = 'approved' | 'machine' | 'english'

export interface Resolved {
  value: string
  provenance: Provenance
}

/**
 * Approved beats machine beats English.
 *
 * Presence is tested with `undefined`, never truthiness. An approved or machine
 * value of `''` is a real answer: `translations.ts` blanks one half of a
 * word-order fragment pair per language so each can order a heading its own way.
 * Treating `''` as missing would let the model fill it, and the page would then
 * render both halves of the heading.
 */
export function resolveValue(
  english: string,
  approved: string | undefined,
  machine: string | undefined
): Resolved {
  if (approved !== undefined) return { value: approved, provenance: 'approved' }
  if (machine !== undefined) return { value: machine, provenance: 'machine' }
  return { value: english, provenance: 'english' }
}
