/**
 * Shared vocabulary for the marketing translation pipeline.
 *
 * Ported from the hub (`workflow_templates/site/scripts/i18n`), with one
 * structural difference: the hub's content comes from an API and is rendered
 * from JSON, so it keeps four layers on disk. Marketing copy already lives in
 * TypeScript, and `translations.ts` IS the approved layer, so there is no
 * `human/` directory here. Provenance is still explicit, just derived from where
 * a string was found rather than from a file that has to be maintained.
 */
import type { Locale } from '../../config/locales'

/** One translatable unit, as read from a source. */
export interface SourceEntry {
  /** Stable identifier. For `translations.ts` this is the translation key. */
  key: string
  /** The English content-of-record. */
  english: string
  /** Translations a person wrote or signed off, by locale. */
  approved: Partial<Record<Locale, string>>
}

/**
 * A place translatable copy lives. `translations.ts` is the only adapter at
 * launch; `src/data/*.ts` and the MDX collections plug in later, and Payload is
 * expected as a fourth. Adding one must never mean forking the pipeline.
 */
export interface SourceAdapter {
  /** Used in artifact keys and error messages, so it must be stable. */
  readonly name: string
  read(): SourceEntry[]
}

/** `key -> English string`, the content-of-record the model translates from. */
export type EnglishSource = Record<string, string>

/** `key -> hash of the English string`, for detecting what changed. */
export type Manifest = Record<string, string>

/** `key -> translated string` for one locale, from either the model or a person. */
export type TranslationLayer = Record<string, string>
