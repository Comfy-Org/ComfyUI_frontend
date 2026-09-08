/**
 * The pure core of the content-source build: turning source entries into the
 * English content-of-record, the hash manifest, and the pruning decisions that
 * keep the machine layer honest when English moves underneath it.
 *
 * Everything here is pure and unit-tested. The IO lives in
 * `scripts/i18n/build-content-source.ts`, mirroring how the hub splits the two.
 */
import { createHash } from 'node:crypto'

import type { Locale } from '../../config/locales'
import type {
  EnglishSource,
  Manifest,
  SourceEntry,
  TranslationLayer
} from './types'

/** Stable 12-hex sha256. Short enough to read in a diff, long enough not to collide. */
export function hashValue(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 12)
}

/**
 * Key namespaces that are never machine-translated.
 *
 * These are contracts. An AI-written Terms of Service or MSA is a liability
 * rather than a feature, so they stay English in any language a person has not
 * translated by hand. Chinese is unaffected: it is already human-translated, and
 * approved values win regardless.
 *
 * Five of the six are already served English-only or noindexed, so this mostly
 * makes existing behaviour explicit rather than changing what a reader sees.
 *
 * Matched on the whole first key segment, never as a substring: `enterprise` is
 * the marketing page and must survive, only `enterprise-msa` is the contract.
 */
const NEVER_TRANSLATED_NAMESPACES: ReadonlySet<string> = new Set([
  'tos',
  'enterprise-msa',
  'privacy',
  'desktop_privacy',
  'affiliate-terms',
  'minimaxLicense'
])

/**
 * Individual pages opted out of machine translation.
 *
 * Separate from the list above because the reason is different, and the two
 * should be reviewable apart: these are not contracts, just pages nobody asked
 * to read in another language — a one-off launch page, and a page whose own
 * description calls itself temporary. Their copy is still extracted, so they
 * stay locale-generic like every other page; they are simply never sent to the
 * model.
 *
 * Matched on whole segments, so `platform.serverlessAnimation` opts out one page
 * without touching the `platform` section around it.
 */
const PAGES_OPTED_OUT: readonly string[] = [
  'pixal3dTrellis2',
  'platform.serverlessAnimation'
]

function isOptedOut(key: string): boolean {
  return PAGES_OPTED_OUT.some(
    (page) => key === page || key.startsWith(`${page}.`)
  )
}

/** The entries the pipeline is allowed to translate. */
export function translatableEntries(entries: SourceEntry[]): SourceEntry[] {
  return entries.filter(
    (entry) =>
      !NEVER_TRANSLATED_NAMESPACES.has(entry.key.split('.')[0]) &&
      !isOptedOut(entry.key)
  )
}

/**
 * The English content-of-record: what the model is asked to translate.
 *
 * Keys with a blank English value are excluded. That is not a data error:
 * `translations.ts` splits some headings into `before` / `after` fragments and
 * blanks whichever half a language does not need, so each language can order the
 * sentence its own way. There is nothing to translate in an empty string, and
 * handing one to the model invites it to invent something.
 */
export function buildEnglishSource(entries: SourceEntry[]): EnglishSource {
  const source: EnglishSource = {}
  for (const entry of entries) {
    if (entry.english.trim() === '') continue
    source[entry.key] = entry.english
  }
  return source
}

/** Per-key hash of the English, so the next run can see what moved. */
export function buildManifest(entries: SourceEntry[]): Manifest {
  const manifest: Manifest = {}
  for (const entry of entries) manifest[entry.key] = hashValue(entry.english)
  return manifest
}

/**
 * The translations a person wrote for `locale`.
 *
 * Deliberately different from the hub's `buildHumanSeed`, which treats a value
 * equal to its English as untranslated and hands it back to the model. That is
 * safe for workflow titles; it is not safe here. Marketing has approved values
 * that are legitimately identical to English (`ComfyUI`, `MiniMax`, version
 * numbers), and re-translating them would overwrite human work, which is the one
 * thing this pipeline promises never to do.
 *
 * So the test is presence, not difference.
 */
export function approvedLayer(
  entries: SourceEntry[],
  locale: Locale
): TranslationLayer {
  const layer: TranslationLayer = {}
  for (const entry of entries) {
    const value = entry.approved[locale]
    if (value !== undefined) layer[entry.key] = value
  }
  return layer
}

/**
 * What the model is asked to translate for one locale: the English
 * content-of-record minus everything already answered.
 *
 * This is where "the AI fills only what is absent" is enforced. Approved values
 * are excluded because they win at resolve time regardless, so translating them
 * would spend money and reviewer attention on strings no reader can ever see.
 * Keys the model already translated on a previous run are excluded too; a
 * changed English string re-enters this set via `pruneStaleKeys`.
 */
export function pendingSource(
  entries: SourceEntry[],
  locale: Locale,
  machine: TranslationLayer
): EnglishSource {
  const approved = approvedLayer(entries, locale)
  const pending: EnglishSource = {}
  for (const [key, english] of Object.entries(buildEnglishSource(entries))) {
    if (approved[key] !== undefined) continue
    if (machine[key] !== undefined) continue
    pending[key] = english
  }
  return pending
}

/**
 * Keys whose English changed since the previous manifest.
 *
 * A key with no prior hash is new, not stale: there is no machine translation to
 * drop, and the model translates it fresh on this run.
 */
export function staleKeys(prev: Manifest, next: Manifest): string[] {
  return Object.keys(next).filter(
    (key) => prev[key] !== undefined && prev[key] !== next[key]
  )
}

/** Drop the changed keys so the model re-translates them cleanly. */
export function pruneStaleKeys(
  machine: TranslationLayer,
  stale: readonly string[]
): TranslationLayer {
  const staleSet = new Set(stale)
  const pruned: TranslationLayer = {}
  for (const [key, value] of Object.entries(machine)) {
    if (!staleSet.has(key)) pruned[key] = value
  }
  return pruned
}

/**
 * Drop machine entries whose English key no longer exists. Runs on every build,
 * independent of staleness.
 *
 * Without it a deleted key's translation lingers with no English source. If the
 * same key is later re-added with different English it has no prior hash, so
 * `staleKeys` does not call it stale, while the model sees an already-translated
 * key and skips it. The page would then serve an obsolete translation for new
 * English, silently. This is the hub's `pruneOrphanIds` reasoning and it applies
 * unchanged.
 */
export function pruneOrphanKeys(
  machine: TranslationLayer,
  currentKeys: ReadonlySet<string>
): TranslationLayer {
  const pruned: TranslationLayer = {}
  for (const [key, value] of Object.entries(machine)) {
    if (currentKeys.has(key)) pruned[key] = value
  }
  return pruned
}
