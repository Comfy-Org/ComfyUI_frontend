/**
 * validate-translations — the deterministic quality gate for the marketing
 * pipeline. CI fails on any violation.
 *
 * Run: `pnpm i18n:validate` (no API key needed).
 *
 * Checks what EXISTS, never what is missing. A key with no translation yet is
 * normal between runs and is handled by the indexing predicate, which holds the
 * page back rather than blocking anyone's merge. The rules themselves live in
 * `src/i18n/pipeline/validate.ts` so they can be tested against fixtures rather
 * than a full pipeline run.
 */
import path from 'node:path'

import { LOCALIZED_CODES } from '../../src/config/locales'
import { readTranslationLayer } from '../../src/i18n/pipeline/artifacts'
import { isUsableEnglishSource } from '../../src/i18n/pipeline/enforce'
import { collectViolations } from '../../src/i18n/pipeline/validate'
import { preserveTerms } from './config'
import type { Violation } from '../../src/i18n/pipeline/validate'
import type { EnglishSource } from '../../src/i18n/pipeline/types'

const I18N_DIR = path.join(process.cwd(), 'src', 'i18n')
const CONTENT_DIR = path.join(I18N_DIR, 'content')

function reportViolations(all: Violation[]): void {
  const byKind = new Map<string, number>()
  for (const v of all) byKind.set(v.kind, (byKind.get(v.kind) ?? 0) + 1)

  console.error(`[i18n] ${all.length} violation(s):`)
  for (const v of all) {
    console.error(`  ${v.locale}  ${v.kind.padEnd(12)} ${v.key}: ${v.detail}`)
  }
  console.error(
    `\n[i18n] by kind: ${[...byKind].map(([k, n]) => `${k}=${n}`).join(', ')}`
  )
}

function main(): void {
  const english: EnglishSource = readTranslationLayer(
    path.join(CONTENT_DIR, 'en.json')
  )
  if (!isUsableEnglishSource(english)) {
    // An empty content-of-record means the source build never ran, so passing
    // here would be a green tick over nothing at all.
    console.error(
      '[i18n] no English content-of-record. Run `pnpm i18n:build-source` first.'
    )
    process.exit(1)
  }

  const terms = preserveTerms()
  if (terms.length === 0) {
    console.error(
      '[i18n] no preserve terms found in glossary/preserve-terms.json'
    )
    process.exit(1)
  }

  const all = LOCALIZED_CODES.flatMap((locale) => {
    const translated = readTranslationLayer(
      path.join(CONTENT_DIR, `${locale}.json`)
    )
    return collectViolations(english, translated, locale, terms)
  })

  if (all.length === 0) {
    process.stdout.write(
      `[i18n] validated ${Object.keys(english).length} keys across ` +
        `${LOCALIZED_CODES.length} locale(s) against ${terms.length} ` +
        `preserve terms: no violations.\n`
    )
    return
  }

  reportViolations(all)
  process.exit(1)
}

main()
