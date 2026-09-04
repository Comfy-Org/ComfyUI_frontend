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
import { OUTPUT_LOCALES, preserveTerms } from './config'

const I18N_DIR = path.join(process.cwd(), 'src', 'i18n')

function main(): void {
  const problems: string[] = []

  // 1. Every locale the site serves must be translatable, or the pipeline
  //    silently skips it and the locale stays English forever.
  for (const locale of LOCALIZED_CODES) {
    if (!OUTPUT_LOCALES[locale]) {
      problems.push(
        `locale "${locale}" is served by the site but has no entry in OUTPUT_LOCALES, ` +
          `so the pipeline will never translate it`
      )
    }
  }

  // 2. And nothing may be configured for translation that the site does not
  //    serve, which would spend money producing text no page can display.
  for (const code of Object.keys(OUTPUT_LOCALES)) {
    if (!(code in LOCALES)) {
      problems.push(
        `OUTPUT_LOCALES has "${code}", which is not a locale this site serves`
      )
    }
  }

  // 3. A short preserve term matches inside ordinary words. `Wan` is a video
  //    model and also the first three letters of `Want`, which made 51 real
  //    strings impossible to validate. The check is word-boundary aware now, but
  //    a one- or two-character term would still be far too blunt.
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

  // 4. A machine layer file must exist for every locale, because `translations.ts`
  //    imports them statically and a missing file is a build error rather than an
  //    empty layer.
  for (const locale of LOCALIZED_CODES) {
    const file = path.join(I18N_DIR, 'content', `${locale}.json`)
    if (!fs.existsSync(file)) {
      problems.push(`missing machine layer ${file}`)
    }
  }

  // 5. The content-of-record must exist, or every other step is a green tick
  //    over nothing.
  if (!fs.existsSync(path.join(I18N_DIR, 'content', 'en.json'))) {
    problems.push(
      'no content/en.json; run `pnpm i18n:build-source` before anything else'
    )
  }

  if (problems.length > 0) {
    console.error('[i18n] configuration problems:')
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exit(1)
  }

  process.stdout.write(
    `[i18n] config OK: ${LOCALIZED_CODES.length} locale(s), ` +
      `${terms.length} preserve terms.\n`
  )
}

main()
