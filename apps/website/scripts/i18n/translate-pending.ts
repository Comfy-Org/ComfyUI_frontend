/**
 * translate-pending — sends one locale's outstanding English to the model and
 * stages the result.
 *
 * Run: `WEBSITE_I18N_LOCALE=ja pnpm i18n:translate` (needs OPENAI_API_KEY).
 *
 * Reads  src/i18n/pending/{locale}.json   what the source build says is missing
 * Writes src/i18n/incoming/{locale}.json  raw model output, NOT yet published
 *
 * Staging matters. `incoming` is what the reviewer and `enforce` operate on, and
 * only what survives both reaches `content/{locale}.json`, which is the layer the
 * site actually reads. Nothing the model produces is published without passing
 * through that gate.
 *
 * The translation itself is the repo's existing app-UI translator, unmodified.
 */
// Loads apps/website/.env so a local run picks up OPENAI_API_KEY without the
// key living in shell history. The file is gitignored; CI passes the key as an
// environment variable instead, and dotenv leaves an already-set value alone.
import 'dotenv/config'

import fs from 'node:fs'
import path from 'node:path'

import { protectedTokens } from '../../../../scripts/i18n/protected-tokens'
import {
  createOpenAiTranslator,
  translateLocaleItems,
  type TranslationItem
} from '../../../../scripts/i18n/translate'
import { isLocale } from '../../src/config/locales'
import { containsTerm } from '../../src/i18n/pipeline/validate'
import {
  OUTPUT_LOCALES,
  preserveTerms,
  websiteTranslationConfig
} from './config'

const I18N_DIR = path.join(process.cwd(), 'src', 'i18n')

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

async function main(): Promise<void> {
  const locale = process.env.WEBSITE_I18N_LOCALE
  if (!isLocale(locale) || !OUTPUT_LOCALES[locale]) {
    console.error(
      `[i18n] set WEBSITE_I18N_LOCALE to one of: ${Object.keys(OUTPUT_LOCALES).join(', ')}`
    )
    process.exit(1)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    // Fail loudly. A silent skip here would let a scheduled run report success
    // having translated nothing at all.
    console.error('[i18n] OPENAI_API_KEY is not set')
    process.exit(1)
  }

  const pending = readJson<Record<string, string>>(
    path.join(I18N_DIR, 'pending', `${locale}.json`),
    {}
  )
  const keys = Object.keys(pending)
  if (keys.length === 0) {
    process.stdout.write(`[i18n] ${locale}: nothing pending.\n`)
    return
  }

  const terms = preserveTerms()
  const items: TranslationItem[] = keys.map((key) => ({
    id: key,
    // The key doubles as context: `pricing.hero.title` tells the model this is a
    // page heading rather than body copy, which the app UI uses its JSON path for.
    context: key,
    source: pending[key],
    // Interpolation tokens from the repo's own extractor, plus any glossary term
    // actually present. The translator validates these and retries with a note
    // when the model drops one, so they are enforced rather than merely asked for.
    //
    // `containsTerm` matches whole words, never substrings. A plain `includes`
    // found `Wan` inside `Want` and told the model that "Wan" must appear byte
    // for byte, so it dutifully produced "Wanとともに" — "together with Wan" —
    // in three sentences that had nothing to do with the model. Nothing
    // downstream would have caught it: the text has kana, the right line count
    // and no banned words, so it would have shipped.
    preserve: [
      ...protectedTokens(pending[key], true),
      ...terms.filter((term) => containsTerm(pending[key], term))
    ]
  }))

  process.stdout.write(
    `[i18n] ${locale}: translating ${items.length} key(s) with ` +
      `${websiteTranslationConfig.model}...\n`
  )

  const translateBatch = createOpenAiTranslator({
    apiKey,
    model: websiteTranslationConfig.model,
    reasoningEffort: websiteTranslationConfig.reasoningEffort,
    glossary: websiteTranslationConfig.glossary,
    maxTruncationSplitDepth: websiteTranslationConfig.maxTruncationSplitDepth
  })

  const translated = await translateLocaleItems(
    OUTPUT_LOCALES[locale],
    items,
    translateBatch,
    websiteTranslationConfig
  )

  const out: Record<string, string> = {}
  for (const [key, value] of translated) out[key] = value
  writeJson(path.join(I18N_DIR, 'incoming', `${locale}.json`), out)

  const missed = items.length - translated.size
  process.stdout.write(
    `[i18n] ${locale}: ${translated.size} translated -> src/i18n/incoming/${locale}.json` +
      (missed > 0 ? `; ${missed} not returned by the model` : '') +
      '\n'
  )
}

void main()
