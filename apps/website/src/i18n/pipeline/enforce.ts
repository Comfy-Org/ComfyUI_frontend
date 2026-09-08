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

/**
 * Above this share of a run being dropped, the model or the config is broken
 * rather than the tail being weak.
 *
 * Matches the hub's `DEFAULT_MAX_PRUNE_FRACTION`, and for its reason: a locale
 * failing more than this is systemic, and publishing it would silently revert
 * most of a language to English. This sat at 0.5 — three times as tolerant —
 * which would have accepted a run that lost a third of a locale without a word.
 */
const SYSTEMIC_DROP_SHARE = 0.15

/**
 * Below this many dropped keys, a share is not evidence of anything.
 *
 * Chosen against the real chronic set rather than picked round: a handful of
 * keys fail every run by their nature — a person's name, a domain, a brand in
 * capitals — because the model correctly returns them unchanged and the script
 * check reads that as untranslated. There were nine of those when this was
 * written, so the floor sits clear of them.
 */
const SYSTEMIC_DROP_FLOOR = 20

/**
 * Whether to refuse a whole run rather than publish what passed.
 *
 * A separate decision from dropping a bad translation: every failing string is
 * already pruned to English on its own, so this only decides whether to also
 * reject the keys that succeeded. Refusing a small run threw away good work and
 * published nothing, and once a locale is mostly translated every run is small.
 */
export function isSystemicFailure({
  dropped,
  total
}: {
  dropped: number
  total: number
}): boolean {
  if (total === 0) return false
  return dropped >= SYSTEMIC_DROP_FLOOR && dropped / total > SYSTEMIC_DROP_SHARE
}
