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
import fs from 'node:fs'
import path from 'node:path'

import { LOCALIZED_CODES } from '../../src/config/locales'
import {
  collectViolations,
  type Violation
} from '../../src/i18n/pipeline/validate'
import type {
  EnglishSource,
  TranslationLayer
} from '../../src/i18n/pipeline/types'

const I18N_DIR = path.join(process.cwd(), 'src', 'i18n')
const CONTENT_DIR = path.join(I18N_DIR, 'content')
const TERMS_FILE = path.join(I18N_DIR, 'glossary', 'preserve-terms.json')

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

function main(): void {
  const english = readJson<EnglishSource>(path.join(CONTENT_DIR, 'en.json'), {})
  if (Object.keys(english).length === 0) {
    // An empty content-of-record means the source build never ran, so passing
    // here would be a green tick over nothing at all.
    console.error(
      '[i18n] no English content-of-record. Run `pnpm i18n:build-source` first.'
    )
    process.exit(1)
  }

  const preserveTerms = readJson<string[]>(TERMS_FILE, [])
  if (preserveTerms.length === 0) {
    console.error(`[i18n] no preserve terms found at ${TERMS_FILE}`)
    process.exit(1)
  }

  const all: Violation[] = []
  for (const locale of LOCALIZED_CODES) {
    const translated = readJson<TranslationLayer>(
      path.join(CONTENT_DIR, `${locale}.json`),
      {}
    )
    all.push(...collectViolations(english, translated, locale, preserveTerms))
  }

  if (all.length === 0) {
    process.stdout.write(
      `[i18n] validated ${Object.keys(english).length} keys across ` +
        `${LOCALIZED_CODES.length} locale(s) against ${preserveTerms.length} ` +
        `preserve terms: no violations.\n`
    )
    return
  }

  const byKind = new Map<string, number>()
  for (const v of all) byKind.set(v.kind, (byKind.get(v.kind) ?? 0) + 1)

  console.error(`[i18n] ${all.length} violation(s):`)
  for (const v of all) {
    console.error(`  ${v.locale}  ${v.kind.padEnd(12)} ${v.key}: ${v.detail}`)
  }
  console.error(
    `\n[i18n] by kind: ${[...byKind].map(([k, n]) => `${k}=${n}`).join(', ')}`
  )
  process.exit(1)
}

main()
