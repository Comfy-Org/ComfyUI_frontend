/**
 * build-resolved — flattens the layered copy into one dictionary per locale, the
 * form the browser actually loads.
 *
 * Run: `pnpm i18n:build-resolved` (no API key needed).
 *
 * Outputs `src/i18n/resolved/{locale}.json`: a flat `key -> string` map with the
 * approved -> machine -> English chain already applied, so nothing has to fall
 * back at render time and no page needs a second locale present to back it up.
 *
 * These files are committed. They are derived, so `resolved.test.ts` re-derives
 * them and fails if what is on disk has drifted — a drift would show up as a
 * hydration mismatch in the browser, which is far harder to diagnose than a red
 * test.
 *
 * Unlike every other artifact in this pipeline, keys are written in SOURCE
 * order, not sorted. `LegalContentSection.vue` walks `translationKeys` to order
 * the sections it renders, and in the browser that list is read back off one of
 * these files.
 */
import fs from 'node:fs'
import path from 'node:path'

import { LOCALE_CODES } from '../../src/config/locales'
import { translationsAdapter } from '../../src/i18n/pipeline/adapters/translations'
import { buildResolvedDictionary } from '../../src/i18n/pipeline/resolved'
import type {
  SourceAdapter,
  TranslationLayer
} from '../../src/i18n/pipeline/types'

const ADAPTERS: SourceAdapter[] = [translationsAdapter]

const I18N_DIR = path.join(process.cwd(), 'src', 'i18n')
const CONTENT_DIR = path.join(I18N_DIR, 'content')
const RESOLVED_DIR = path.join(I18N_DIR, 'resolved')

/**
 * An absent file is fine — a locale with no machine layer resolves to English,
 * which is the designed fallback. A file that exists but does not parse is not:
 * it would resolve the same way and quietly ship English on every page of that
 * locale, with the build green.
 */
function readMachineLayer(locale: string): TranslationLayer {
  const file = path.join(CONTENT_DIR, `${locale}.json`)
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
  return JSON.parse(text) as TranslationLayer
}

function main(): void {
  const entries = ADAPTERS.flatMap((adapter) => adapter.read())
  fs.mkdirSync(RESOLVED_DIR, { recursive: true })

  for (const locale of LOCALE_CODES) {
    const dictionary = buildResolvedDictionary(
      entries,
      locale,
      readMachineLayer(locale)
    )
    fs.writeFileSync(
      path.join(RESOLVED_DIR, `${locale}.json`),
      `${JSON.stringify(dictionary, null, 2)}\n`,
      'utf8'
    )
    process.stdout.write(
      `[i18n] resolved/${locale}.json: ${Object.keys(dictionary).length} keys\n`
    )
  }
}

main()
