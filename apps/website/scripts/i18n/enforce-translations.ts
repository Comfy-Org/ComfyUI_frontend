/**
 * enforce-translations — the gate between what the model produced and what the
 * site publishes.
 *
 * Run: `WEBSITE_I18N_LOCALE=ja pnpm i18n:enforce` (no API key needed).
 *
 * Reads  src/i18n/incoming/{locale}.json   raw model output
 *        src/i18n/review/{locale}.json     the AI reviewer's verdicts
 * Writes src/i18n/content/{locale}.json    the layer the site actually reads
 *
 * Anything failing a deterministic check, or graded critical or major by the
 * reviewer, is DROPPED, not corrected. The key becomes absent, the resolver
 * falls back to English, and the reader sees English rather than a translation
 * that failed review. That is what makes publishing on the AI pass safe.
 *
 * Both kinds of failure prune here, through one path, so a key dropped for bad
 * grammar behaves exactly like one dropped for a lost brand name. The reviewer
 * writes verdicts and nothing else; it owns no gate of its own.
 *
 * Existing entries in `content` are merged with, never replaced, so a run that
 * translates ten new keys cannot discard the hundred already there.
 */
import fs from 'node:fs'
import path from 'node:path'

import { isLocale } from '../../src/config/locales'
import { readTranslationLayer } from '../../src/i18n/pipeline/artifacts'
import {
  enforceTranslations,
  isSystemicFailure
} from '../../src/i18n/pipeline/enforce'
import {
  glossaryFingerprint,
  loadReviewState,
  reviewViolations
} from '../../src/i18n/pipeline/review'
import type { EnglishSource } from '../../src/i18n/pipeline/types'
import { collectViolations } from '../../src/i18n/pipeline/validate'
import { localeRubric, OUTPUT_LOCALES, preserveTerms } from './config'

const I18N_DIR = path.join(process.cwd(), 'src', 'i18n')

/**
 * The stored verdicts, which `loadReviewState` validates in full. Absence is
 * normal before the reviewer has run for a locale.
 */
function readReviewState(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

function writeJson(file: string, value: Record<string, string>): void {
  const sorted: Record<string, string> = {}
  for (const key of Object.keys(value).sort()) sorted[key] = value[key]
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')
}

function main(): void {
  const locale = process.env.WEBSITE_I18N_LOCALE
  const output = isLocale(locale) ? OUTPUT_LOCALES[locale] : undefined
  if (!isLocale(locale) || !output) {
    console.error(
      `[i18n] set WEBSITE_I18N_LOCALE to one of: ${Object.keys(OUTPUT_LOCALES).join(', ')}`
    )
    process.exit(1)
  }

  const incomingFile = path.join(I18N_DIR, 'incoming', `${locale}.json`)
  const incoming = readTranslationLayer(incomingFile)
  const contentFile = path.join(I18N_DIR, 'content', `${locale}.json`)
  const existing = readTranslationLayer(contentFile)
  const english: EnglishSource = readTranslationLayer(
    path.join(I18N_DIR, 'content', 'en.json')
  )
  const terms = preserveTerms()

  const violations = collectViolations(english, incoming, locale, terms)
  const { kept, dropped, droppedShare } = enforceTranslations(
    incoming,
    violations
  )

  for (const key of dropped) {
    const why = violations
      .filter((violation) => violation.key === key)
      .map((violation) => violation.kind)
    process.stdout.write(`  dropped ${key} (${[...new Set(why)].join(', ')})\n`)
  }

  const staged = Object.keys(incoming).length
  if (isSystemicFailure({ dropped: dropped.length, total: staged })) {
    console.error(
      `[i18n] ${locale}: dropped ${Math.round(droppedShare * 100)}% of the run ` +
        `(${dropped.length} of ${staged}). That is a broken ` +
        `model or config, not a weak tail. Publishing this would revert the ` +
        `locale to English.`
    )
    process.exit(1)
  }

  // The AI reviewer's critical and major findings prune through this same path,
  // so a key dropped for bad grammar behaves exactly like one dropped for a lost
  // brand name: absent, English at render, one threshold.
  //
  // Against the merged layer rather than this run's staging, because a verdict
  // may be about copy published weeks ago — the reviewer reads what is live, not
  // only what is new. Absent review state contributes nothing, so the
  // deterministic floor keeps working on its own exactly as before.
  //
  // The rubric fingerprint is recomputed here rather than trusting the file: if
  // the glossary or the locale's voice guidance has moved since the verdicts
  // were reached, they describe a rule that is no longer in force, and pruning
  // real copy on them would be worse than not pruning at all.
  const merged = { ...existing, ...kept }
  const reviewState = loadReviewState(
    readReviewState(path.join(I18N_DIR, 'review', `${locale}.json`)),
    glossaryFingerprint(terms, localeRubric(locale).guidance)
  )
  const findings = reviewViolations(locale, reviewState, english, merged)

  // Nothing translated tonight and nothing rejected on review: there is no
  // decision to record, so leave the published layer untouched rather than
  // rewriting it to prove it did not change.
  if (Object.keys(incoming).length === 0 && findings.length === 0) {
    process.stdout.write(
      `[i18n] ${locale}: nothing staged in ${incomingFile}, no review findings.\n`
    )
    return
  }

  const {
    kept: published,
    dropped: rejected,
    droppedShare: rejectedShare
  } = enforceTranslations(merged, findings)

  for (const key of rejected) {
    const why = findings.find((finding) => finding.key === key)?.detail ?? ''
    process.stdout.write(`  rejected ${key} (${why})\n`)
  }

  if (
    isSystemicFailure({
      dropped: rejected.length,
      total: Object.keys(merged).length
    })
  ) {
    console.error(
      `[i18n] ${locale}: the reviewer rejected ${Math.round(rejectedShare * 100)}% ` +
        `of the locale (${rejected.length} of ${Object.keys(merged).length}). ` +
        `That is a broken rubric or reviewer, not a weak tail. Publishing this ` +
        `would revert the locale to English.`
    )
    process.exit(1)
  }

  writeJson(contentFile, published)

  process.stdout.write(
    `[i18n] ${locale}: published ${Object.keys(kept).length}, ` +
      `dropped ${dropped.length} to English, ` +
      `rejected ${rejected.length} on review` +
      `; content now holds ${Object.keys(published).length} key(s).\n`
  )
}

main()
