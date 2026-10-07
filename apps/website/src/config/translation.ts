import type { Locale } from './locales'
import { DEFAULT_LOCALE, LOCALE_CODES } from './locales'

const languages = {
  'zh-CN': {
    name: 'Simplified Chinese',
    guidance: 'Use only Simplified Chinese characters (简体中文).'
  },
  ja: { name: 'Japanese' }
} satisfies Record<
  Exclude<Locale, typeof DEFAULT_LOCALE>,
  { name: string; guidance?: string }
>

export const translationExclusions = [
  'tos',
  'enterprise-msa',
  'privacy',
  'desktop_privacy',
  'affiliate-terms',
  'minimaxLicense'
] as const

export const websiteTranslationConfig = {
  output: 'apps/website/src/locales',
  strictProtectedTokens: true,
  translationContext:
    'comfy.org marketing, product, support, and legal content',
  glossary: `Keep these names untranslated: Comfy, ComfyUI, Comfy Cloud, Comfy Desktop, Managed Builds, MiniMax, Flux, LTX, Wan, Seedance, LoRA, ControlNet, MCP, Hugging Face, Civitai.
Keep URLs, paths, e-mail addresses, product slugs and version numbers exactly as written.
Write naturally in the target language rather than word for word.`,
  existingCopy: {
    kind: 'preserve',
    excludedKeyPrefixes: translationExclusions
  },
  outputLocales: LOCALE_CODES.filter((code) => code !== DEFAULT_LOCALE).map(
    (code) => ({ code, ...languages[code] })
  )
} as const
