/**
 * enforce-translations — the gate between what the model produced and what the
 * site publishes.
 *
 * Run: `WEBSITE_I18N_LOCALE=ja pnpm i18n:enforce` (no API key needed).
 *
 * Reads  src/i18n/incoming/{locale}.json   raw model output
 * Writes src/i18n/content/{locale}.json    the layer the site actually reads
 *
 * Anything failing a deterministic check is DROPPED, not corrected. The key
 * becomes absent, the resolver falls back to English, and the reader sees
 * English rather than a translation that failed review. That is what makes
 * publishing on the AI pass safe.
 *
 * Existing entries in `content` are merged with, never replaced, so a run that
 * translates ten new keys cannot discard the hundred already there.
 */
import fs from 'node:fs'
import path from 'node:path'

import { isLocale } from '../../src/config/locales'
import { enforceTranslations } from '../../src/i18n/pipeline/enforce'
import type {
  EnglishSource,
  TranslationLayer
} from '../../src/i18n/pipeline/types'
import { collectViolations } from '../../src/i18n/pipeline/validate'
import { OUTPUT_LOCALES, preserveTerms } from './config'

const I18N_DIR = path.join(process.cwd(), 'src', 'i18n')

/**
 * Above this share of a run being dropped, the model or the config is broken
 * rather than the tail being weak, and continuing would quietly revert a locale
 * to English. Fail instead, so someone looks.
 */
const SYSTEMIC_DROP_THRESHOLD = 0.5

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
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
  if (!isLocale(locale) || !OUTPUT_LOCALES[locale]) {
    console.error(
      `[i18n] set WEBSITE_I18N_LOCALE to one of: ${Object.keys(OUTPUT_LOCALES).join(', ')}`
    )
    process.exit(1)
  }

  const incomingFile = path.join(I18N_DIR, 'incoming', `${locale}.json`)
  const incoming = readJson<TranslationLayer>(incomingFile, {})
  if (Object.keys(incoming).length === 0) {
    process.stdout.write(
      `[i18n] ${locale}: nothing staged in ${incomingFile}.\n`
    )
    return
  }

  const english = readJson<EnglishSource>(
    path.join(I18N_DIR, 'content', 'en.json'),
    {}
  )
  const violations = collectViolations(
    english,
    incoming,
    locale,
    preserveTerms()
  )
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

  if (droppedShare > SYSTEMIC_DROP_THRESHOLD) {
    console.error(
      `[i18n] ${locale}: dropped ${Math.round(droppedShare * 100)}% of the run ` +
        `(${dropped.length} of ${Object.keys(incoming).length}). That is a broken ` +
        `model or config, not a weak tail. Publishing this would revert the ` +
        `locale to English.`
    )
    process.exit(1)
  }

  const contentFile = path.join(I18N_DIR, 'content', `${locale}.json`)
  const existing = readJson<TranslationLayer>(contentFile, {})
  writeJson(contentFile, { ...existing, ...kept })

  process.stdout.write(
    `[i18n] ${locale}: published ${Object.keys(kept).length}, ` +
      `dropped ${dropped.length} to English` +
      `; content now holds ${Object.keys({ ...existing, ...kept }).length} key(s).\n`
  )
}

main()
