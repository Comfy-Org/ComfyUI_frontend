/**
 * Removes translations that failed a check, rather than trying to fix them.
 *
 * This is what makes publishing on the AI pass safe. A flagged string is dropped,
 * so the key becomes absent, the resolver falls back to English, and the reader
 * sees English instead of a translation the reviewer rejected. Nothing incorrect
 * is ever published; a later run, or a person, fills the gap.
 *
 * The hub states the same rule in `enforce-translations.ts`: "Nothing incorrect
 * is ever published; the dropped fields show English until a later run (or a
 * human review) fills them in."
 */
import type { TranslationLayer } from './types'
import type { Violation } from './validate'

export interface Enforced {
  kept: TranslationLayer
  /** Keys removed, sorted, for reporting. */
  dropped: string[]
  /**
   * Share of the run that was dropped, 0 to 1.
   *
   * A high value means the model or the config is broken rather than that the
   * tail was weak, and publishing it would quietly revert a locale to English.
   * The caller decides the threshold; this only measures.
   */
  droppedShare: number
}

export function enforceTranslations(
  incoming: TranslationLayer,
  violations: readonly Violation[]
): Enforced {
  const flagged = new Set(violations.map((violation) => violation.key))
  const kept: TranslationLayer = {}
  const dropped: string[] = []

  for (const [key, value] of Object.entries(incoming)) {
    if (flagged.has(key)) dropped.push(key)
    else kept[key] = value
  }

  const total = Object.keys(incoming).length
  return {
    kept,
    dropped: dropped.sort(),
    droppedShare: total === 0 ? 0 : dropped.length / total
  }
}
