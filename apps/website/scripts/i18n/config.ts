/**
 * Translation settings for the marketing site.
 *
 * Deliberately reuses the repo's existing translator (`scripts/i18n/translate.ts`),
 * which already runs the ComfyUI app UI: `openai` is a dependency, the model is
 * newer than the hub's, and batching, concurrency, preserve-term validation and
 * retry are proven there. Adding a second translation stack for the website
 * would have meant maintaining two.
 *
 * NOTHING here modifies that pipeline. `translate.ts` imports only TYPES from
 * its own config, so the website supplies its own values and calls the same
 * functions. `pnpm locale:check` still guards the app UI unchanged.
 *
 * The two knobs that carry marketing voice into the model are `glossary` and
 * each locale's `guidance`; both are injected into the system prompt.
 */
import fs from 'node:fs'
import path from 'node:path'

import type { OutputLocale } from '../../../../scripts/i18n/config'
import { BANNED_HYPE } from '../../src/i18n/pipeline/validate'

const GLOSSARY_FILE = path.join(
  process.cwd(),
  'src',
  'i18n',
  'glossary',
  'preserve-terms.json'
)

/**
 * The glossary is injected into a paid translation prompt and is also what the
 * page-coverage gate treats as legitimately-English text, so a wrong shape
 * surfaces a long way from its cause. Validated here, once, at the read.
 */
export function parsePreserveTerms(text: string, file: string): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`${file} is not valid JSON.`, { cause: error })
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${file} must be a JSON array of strings.`)
  }

  const items: unknown[] = parsed
  const terms: string[] = []
  for (const [index, term] of items.entries()) {
    if (typeof term !== 'string') {
      throw new Error(`${file} entry ${index} is not a string.`)
    }
    terms.push(term)
  }
  return terms
}

export function preserveTerms(): string[] {
  return parsePreserveTerms(
    fs.readFileSync(GLOSSARY_FILE, 'utf8'),
    GLOSSARY_FILE
  )
}

const japaneseGuidance = `Use natural Japanese for a professional creative-software audience. Prefer です・ます form for body copy and noun-ending phrases for headings and buttons, as Japanese software marketing does.
Keep widely recognised technical terms in katakana or Latin script rather than inventing translations: ワークフロー, ノード, モデル, API, GPU.
Do not pad sentences. Japanese marketing copy is shorter than the English; a literal translation reads as machine output.`

const chineseSimplifiedGuidance = `Use ONLY Simplified Chinese characters (简体中文). Never mix Simplified and Traditional.
Match the terminology already used across comfy.org's Chinese pages: 工作流 for workflow, 节点 for node, 模型 for model.`

/**
 * The locales the website translates, keyed to `config/locales.ts`.
 *
 * The value is optional because the site serves locales this map does not
 * translate — English is the source, so it has no entry. Typed as always
 * present, every `!OUTPUT_LOCALES[locale]` guard reads as dead code to a
 * type-aware linter, including the one in `check-config.ts` whose whole job is
 * to catch a served locale with no entry here.
 */
export const OUTPUT_LOCALES: Record<string, OutputLocale | undefined> = {
  ja: { code: 'ja', name: 'Japanese', guidance: japaneseGuidance },
  'zh-CN': {
    code: 'zh-CN',
    name: 'Simplified Chinese',
    guidance: chineseSimplifiedGuidance
  }
}

export function localeVoice(locale: string): {
  name: string
  guidance: string
} {
  const output = OUTPUT_LOCALES[locale]
  if (!output) {
    throw new Error(`[i18n] OUTPUT_LOCALES has no entry for "${locale}".`)
  }
  const guidance = output.guidance?.trim()
  if (!guidance) {
    throw new Error(
      `[i18n] OUTPUT_LOCALES["${locale}"] has no voice guidance for the translator.`
    )
  }
  return { name: output.name, guidance }
}

/**
 * Batching and retry, matching the app UI's proven values. Marketing strings are
 * longer than UI labels, so the per-request item count is lower while the
 * character budget stays the same.
 */
export const websiteTranslationConfig = {
  model: process.env.WEBSITE_I18N_MODEL || 'gpt-5.6-terra',
  reasoningEffort: 'high' as const,
  maxItemsPerRequest: 25,
  maxSourceCharsPerRequest: 6000,
  maxTruncationSplitDepth: 3,
  requestConcurrency: 2,
  maxTranslationRounds: 3,
  glossary: `This is marketing copy for comfy.org. Use natural local search
terminology and a direct, factual voice. Preserve the creator's
agency and the source's claims without adding hype.
Do not introduce these words unless present in the source: ${BANNED_HYPE.join(', ')}.`
}
