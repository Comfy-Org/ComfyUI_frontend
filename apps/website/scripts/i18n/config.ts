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

const GLOSSARY_FILE = path.join(
  process.cwd(),
  'src',
  'i18n',
  'glossary',
  'preserve-terms.json'
)

export function preserveTerms(): string[] {
  return JSON.parse(fs.readFileSync(GLOSSARY_FILE, 'utf8')) as string[]
}

/**
 * Brand voice, shared across locales.
 *
 * The hype ban is not decoration: `validate-translations` fails CI on any of
 * these words appearing in a translation whose English did not use it, so the
 * model is told up front rather than being caught afterwards.
 */
function glossaryText(): string {
  return `This is marketing and SEO copy for comfy.org, the site for ComfyUI, a node-based interface for generative AI.

Translate for how each market actually searches, not word for word. Common technique terms (inpainting, upscaling, image to video) should become the natural local term.

Tone: direct, factual, creator-first. The person directs the model; never phrase it as the AI creating for the user. Never introduce hype the English did not claim: no local equivalent of stunning, powerful, seamless, effortless, unlock, revolutionary, game-changing, cutting-edge or unleash.

Keep these untranslated, byte for byte:
${preserveTerms().join(', ')}`
}

const japaneseGuidance = `Use natural Japanese for a professional creative-software audience. Prefer です・ます form for body copy and noun-ending phrases for headings and buttons, as Japanese software marketing does.
Keep widely recognised technical terms in katakana or Latin script rather than inventing translations: ワークフロー, ノード, モデル, API, GPU.
Do not pad sentences. Japanese marketing copy is shorter than the English; a literal translation reads as machine output.`

const chineseSimplifiedGuidance = `Use ONLY Simplified Chinese characters (简体中文). Never mix Simplified and Traditional.
Match the terminology already used across comfy.org's Chinese pages: 工作流 for workflow, 节点 for node, 模型 for model.`

/** The locales the website translates, keyed to `config/locales.ts`. */
export const OUTPUT_LOCALES: Record<string, OutputLocale> = {
  ja: { code: 'ja', name: 'Japanese', guidance: japaneseGuidance },
  'zh-CN': {
    code: 'zh-CN',
    name: 'Simplified Chinese',
    guidance: chineseSimplifiedGuidance
  }
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
  get glossary(): string {
    return glossaryText()
  }
}
