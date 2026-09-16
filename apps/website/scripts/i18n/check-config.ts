/**
 * check-config — catches pipeline misconfiguration before it wastes a model run
 * or, worse, produces a quietly wrong one.
 *
 * Run: `pnpm i18n:check-config` (no API key needed).
 *
 * Every check here failed silently at some point in this work, or would have.
 */
import fs from 'node:fs'
import path from 'node:path'

import { LOCALES, LOCALIZED_CODES } from '../../src/config/locales'
import { localeVoice, OUTPUT_LOCALES, preserveTerms } from './config'

const I18N_DIR = path.join(process.cwd(), 'src', 'i18n')

function checkVoices(problems: string[]): void {
  for (const locale of LOCALIZED_CODES) {
    if (!OUTPUT_LOCALES[locale]) continue
    try {
      localeVoice(locale)
    } catch (error) {
      problems.push((error as Error).message)
    }
  }
}

function checkOutputLocales(problems: string[]): void {
  for (const code of Object.keys(OUTPUT_LOCALES)) {
    if (!(code in LOCALES)) {
      problems.push(
        `OUTPUT_LOCALES has "${code}", which is not a locale this site serves`
      )
    }
  }
}

function checkLocales(problems: string[]): void {
  for (const locale of LOCALIZED_CODES) {
    if (!OUTPUT_LOCALES[locale]) {
      problems.push(
        `locale "${locale}" is served by the site but has no entry in OUTPUT_LOCALES, ` +
          `so the pipeline will never translate it`
      )
    }
  }

  checkOutputLocales(problems)

  checkVoices(problems)
}

function checkEnglishSource(problems: string[]): void {
  if (!fs.existsSync(path.join(I18N_DIR, 'content', 'en.json'))) {
    problems.push(
      'no content/en.json; run `pnpm i18n:build-source` before anything else'
    )
  }
}

function main(): void {
  const problems: string[] = []

  checkLocales(problems)

  // A short preserve term used to match inside ordinary words. `Wan` is a
  //    video model and also the first three letters of `Want`, which made 51
  //    real strings impossible to validate. A term now has to equal a whole
  //    visible text node to count (`isTranslatable` in `utils/pageCoverage.ts`
  //    asks `preserved.has(text)`), so it cannot reach inside a word at all and
  //    a two-character term is safe: `AI`, `CI`, `H3`, `T5` and `TB` are all
  //    real terms here. A single character cannot carry meaning as a term and
  //    is still rejected.
  const terms = preserveTerms()
  const tooShort = terms.filter((term) => term.trim().length < 2)
  if (tooShort.length > 0) {
    problems.push(`preserve terms too short to be safe: ${tooShort.join(', ')}`)
  }

  const duplicates = terms.filter((term, i) => terms.indexOf(term) !== i)
  if (duplicates.length > 0) {
    problems.push(
      `duplicate preserve terms: ${[...new Set(duplicates)].join(', ')}`
    )
  }

  checkEnglishSource(problems)

  if (problems.length > 0) {
    console.error('[i18n] configuration problems:')
    problems.forEach((problem) => console.error(`  - ${problem}`))
    process.exit(1)
  }

  process.stdout.write(
    `[i18n] config OK: ${LOCALIZED_CODES.length} locale(s), ` +
      `${terms.length} preserve terms.\n`
  )
}

main()
