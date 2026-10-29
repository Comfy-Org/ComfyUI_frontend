import type { Reasoning } from 'openai/resources/shared'

export interface OutputLocale {
  code: string
  name: string
  guidance?: string
}

export interface TranslationPipelineConfig {
  output: string
  strictProtectedTokens: boolean
  model: string
  reasoningEffort: NonNullable<Reasoning['effort']>
  maxItemsPerRequest: number
  maxSourceCharsPerRequest: number
  maxTruncationSplitDepth: number
  localeFileConcurrency: number
  requestConcurrency: number
  maxTranslationRounds: number
  translationContext: string
  glossary: string
  outputLocales: OutputLocale[]
  existingCopy:
    | { kind: 'regenerate' }
    | { kind: 'preserve'; excludedKeyPrefixes: readonly string[] }
}

const glossary = `Keep these names untranslated: flux, photomaker, clip, vae, cfg, stable audio, stable cascade, stable zero, controlnet, lora, HiDream, Civitai, Hugging Face.
'latent' is the short form of 'latent space'.
'mask' is in the context of image processing.`

const chineseSimplifiedGuidance = `Use ONLY Simplified Chinese characters (简体中文). Common examples: 节点 (not 節點), 画布 (not 畫布), 图像 (not 圖像), 选择 (not 選擇), 减小 (not 減小). NEVER mix Simplified and Traditional Chinese characters.`

const chineseTraditionalGuidance = `Use ONLY Traditional Chinese characters (繁體中文) with Taiwan-specific terminology. NEVER mix Simplified and Traditional Chinese characters.`

const persianGuidance = `Use formal Persian (فارسی رسمی) for a professional tone throughout the UI.
Keep commonly used technical terms in English when they are standard in Persian software (e.g., node, workflow).
Use Arabic-Indic numerals (۰-۹) for ordinary numbers, but NEVER inside placeholders, algebraic expressions such as 17k+5, or any "preserve" substring — those must stay in ASCII exactly as written.`

const hebrewGuidance = `Use modern, formal Hebrew (עברית תקנית) for a professional tone throughout the UI.
Hebrew is a right-to-left (RTL) language. Keep all interpolation placeholders ({name}, {count}), pipe-separated plural forms, and English technical terms intact.
Preferred glossary: node = צומת (plural צמתים), workflow = תהליך עבודה, queue = תור, canvas = קנבס, widget = פקד, subgraph = תת-גרף, prompt = פרומפט/הנחיה (per context), bypass = עקיפה, mute = השתקה.
Keep widely-recognized technical terms in English (Latin script): API, GPU, CUDA, VAE, CLIP, LoRA, ControlNet, Civitai, Hugging Face, Nodes 2.0, etc.`

const germanGuidance = `Use formal German (Sie-Form) consistently for a professional tone throughout the UI. Never mix Sie and du.
Keep widely-recognized technical terms in English rather than inventing German equivalents, as German creative and developer software does: Node, Workflow, Prompt, Queue, Canvas, Widget, Subgraph, Seed, Sampler, Checkpoint, LoRA, VAE, CLIP, ControlNet.
German compounds are written closed, not spaced: "Bildgenerierung", not "Bild Generierung". Where a compound joins an English technical term to a German noun, hyphenate: "Node-Editor", "Workflow-Vorlage".
Prefer the imperative for button labels ("Speichern", "Abbrechen") and avoid the infinitive-with-zu form, which reads like documentation rather than an interface.`

const vietnameseGuidance = `Use natural, neutral Vietnamese with a professional tone. Leave out the pronoun when the sentence reads well without one; when the user must be addressed, use "bạn" consistently.
Keep widely-recognized technical terms in English, as Vietnamese AI and creative-tool users do: node, workflow, prompt, canvas, widget, subgraph, seed, sampler, scheduler, checkpoint, latent, LoRA, VAE, CLIP, ControlNet. Translate everyday UI words: queue = hàng đợi, model = mô hình, image = ảnh, settings = cài đặt, template = mẫu, extension = tiện ích mở rộng.
Vietnamese nouns do not inflect for number. Keep every pipe-separated plural form, repeating the same wording where English only changes the noun's number.
Use sentence case: capitalize only the first word and proper nouns, never every word of a label. Button labels are short verbs: "Lưu", "Hủy", "Xóa", "Chạy".
Write precomposed (NFC) characters and place tone marks consistently in the style common in Vietnamese software: "hóa", "xóa", "hủy", not "hoá", "xoá", "huỷ".`

const generationDefaults = {
  model: 'gpt-5.6-terra',
  reasoningEffort: 'high',
  maxItemsPerRequest: 40,
  maxSourceCharsPerRequest: 6000,
  maxTruncationSplitDepth: 3,
  localeFileConcurrency: 3,
  requestConcurrency: 2,
  maxTranslationRounds: 3
} as const

const appTranslationConfig: TranslationPipelineConfig = {
  ...generationDefaults,
  output: 'src/locales',
  strictProtectedTokens: false,
  existingCopy: { kind: 'regenerate' },
  translationContext: 'ComfyUI, a node-based generative AI application',
  glossary,
  outputLocales: [
    {
      code: 'zh',
      name: 'Simplified Chinese',
      guidance: chineseSimplifiedGuidance
    },
    {
      code: 'zh-TW',
      name: 'Traditional Chinese (Taiwan)',
      guidance: chineseTraditionalGuidance
    },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'ar', name: 'Arabic' },
    { code: 'tr', name: 'Turkish' },
    { code: 'pt-BR', name: 'Brazilian Portuguese' },
    { code: 'fa', name: 'Persian', guidance: persianGuidance },
    { code: 'he', name: 'Hebrew', guidance: hebrewGuidance },
    { code: 'it', name: 'Italian' },
    { code: 'de', name: 'German', guidance: germanGuidance },
    { code: 'vi', name: 'Vietnamese', guidance: vietnameseGuidance }
  ]
}

export const translationTargets = {
  app: appTranslationConfig
} as const satisfies Record<string, TranslationPipelineConfig>
