import type { OpenAI } from 'openai'

export interface OutputLocale {
  code: string
  name: string
  guidance?: string
}

export interface TranslationPipelineConfig {
  model: string
  reasoningEffort: NonNullable<OpenAI.ChatCompletionReasoningEffort>
  maxItemsPerRequest: number
  maxSourceCharsPerRequest: number
  maxTruncationSplitDepth: number
  requestConcurrency: number
  maxTranslationRounds: number
  glossary: string
  outputLocales: OutputLocale[]
}

const glossary = `Keep these names untranslated: ComfyUI, Comfy, Comfy Cloud, Comfy Desktop, Comfy API, LoRA, ControlNet, VAE, CLIP, flux, HiDream.
This is marketing copy for a professional creative-AI tool, not documentation: match the source's brevity and confidence, but never introduce a claim, statistic, or superlative that is not already in the English source.`

const japaneseGuidance = `Use natural, professional Japanese as written by a native marketing copywriter, not a literal word-for-word rendering of the English sentence structure. Titles and CTAs should read like real Japanese marketing copy, not a translated tagline.
Keep widely-recognized technical and product terms in English (Latin script): API, GPU, node, workflow, LoRA, ControlNet, VAE, CLIP.
Never overclaim: if the English source is measured or hedged, the Japanese must be too.`

export const translationPipelineConfig: TranslationPipelineConfig = {
  model: 'gpt-5.6-terra',
  reasoningEffort: 'high',
  maxItemsPerRequest: 40,
  maxSourceCharsPerRequest: 6000,
  maxTruncationSplitDepth: 3,
  requestConcurrency: 2,
  maxTranslationRounds: 3,
  glossary,
  outputLocales: [
    { code: 'zh-CN', name: 'Simplified Chinese' },
    { code: 'ja', name: 'Japanese', guidance: japaneseGuidance }
  ]
}
