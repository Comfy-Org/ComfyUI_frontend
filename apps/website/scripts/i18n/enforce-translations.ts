import path from 'node:path'

import { isLocale } from '../../src/config/locales'
import { readTranslationLayer } from '../../src/i18n/pipeline/artifacts'
import {
  enforceTranslations,
  isSystemicFailure,
  isUsableEnglishSource
} from '../../src/i18n/pipeline/enforce'
import type { EnglishSource } from '../../src/i18n/pipeline/types'
import type { Violation } from '../../src/i18n/pipeline/validate'
import { collectViolations } from '../../src/i18n/pipeline/validate'
import { OUTPUT_LOCALES, preserveTerms } from './config'
import { writeSortedJson } from './write-json'

const I18N_DIR = path.join(process.cwd(), 'src', 'i18n')

function reportDeterministicResult(
  locale: string,
  incoming: EnglishSource,
  violations: Violation[],
  dropped: string[],
  droppedShare: number
): void {
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
}

function configuredLocale() {
  const locale = process.env.WEBSITE_I18N_LOCALE
  const output = isLocale(locale) ? OUTPUT_LOCALES[locale] : undefined
  if (!isLocale(locale) || !output) {
    console.error(
      `[i18n] set WEBSITE_I18N_LOCALE to one of: ${Object.keys(OUTPUT_LOCALES).join(', ')}`
    )
    process.exit(1)
  }
  return { locale, output }
}

function requireEnglish(): EnglishSource {
  const englishFile = path.join(I18N_DIR, 'content', 'en.json')
  const english: EnglishSource = readTranslationLayer(englishFile)
  if (!isUsableEnglishSource(english)) {
    throw new Error(
      `${englishFile} is empty; every translation would enforce against nothing.`
    )
  }
  return english
}

function main(): void {
  const { locale } = configuredLocale()

  const incomingFile = path.join(I18N_DIR, 'incoming', `${locale}.json`)
  const incoming = readTranslationLayer(incomingFile)
  const contentFile = path.join(I18N_DIR, 'content', `${locale}.json`)
  const existing = readTranslationLayer(contentFile)
  const english = requireEnglish()
  const terms = preserveTerms()

  const violations = collectViolations(english, incoming, locale, terms)
  const { kept, dropped, droppedShare } = enforceTranslations(
    incoming,
    violations
  )

  reportDeterministicResult(locale, incoming, violations, dropped, droppedShare)

  if (Object.keys(incoming).length === 0) {
    process.stdout.write(
      `[i18n] ${locale}: nothing staged in ${incomingFile}.\n`
    )
    return
  }

  const published = { ...existing, ...kept }
  writeSortedJson(contentFile, published)

  process.stdout.write(
    `[i18n] ${locale}: published ${Object.keys(kept).length}, ` +
      `dropped ${dropped.length} to English; ` +
      `content now holds ${Object.keys(published).length} key(s).\n`
  )
}

main()
