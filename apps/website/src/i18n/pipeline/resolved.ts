/**
 * Flattening the layered lookup into one dictionary per locale.
 *
 * `t()` resolves approved -> machine -> English at call time, which needs every
 * locale's copy present. That is fine at build time and wrong in a browser: it
 * made a visitor download all 2,116 strings in all languages whatever page they
 * were on, and adding a language grew that for everyone.
 *
 * Resolving ahead of build time removes the reason to ship more than one layer.
 * A resolved dictionary answers every key, so the browser needs no fallback and
 * no other locale.
 */
import type { Locale } from '../../config/locales'
import { resolveValue } from './resolve'
import type { SourceEntry, TranslationLayer } from './types'

/**
 * Insertion order is load-bearing, not incidental: `LegalContentSection.vue`
 * walks `translationKeys` to decide the order of the sections it renders, and
 * that list comes from this dictionary's keys in the browser.
 */
export function buildResolvedDictionary(
  entries: SourceEntry[],
  locale: Locale,
  machine: TranslationLayer
): TranslationLayer {
  const dictionary: TranslationLayer = {}

  for (const entry of entries) {
    // English is the source, so it never consults the machine layer, which
    // would otherwise let generated text shadow the original.
    dictionary[entry.key] =
      locale === 'en'
        ? entry.english
        : resolveValue(
            entry.english,
            entry.approved[locale],
            machine[entry.key]
          ).value
  }

  return dictionary
}
