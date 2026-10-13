import type { Locale } from './locales'
import { DEFAULT_LOCALE, LOCALE_CODES, isLocale } from './locales'
import { localizeHref } from './routes'

const siteOrigin = 'https://comfy.org'

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

const messageGroups = [
  [
    ['models', 'list', 'heroTitleBefore'],
    ['models', 'list', 'heroTitleAfter']
  ]
] as const

function localizeSiteHref(href: string, localeCode: string): string {
  if (!isLocale(localeCode)) return href
  const origin = href.startsWith(`${siteOrigin}/`) ? siteOrigin : ''
  return `${origin}${localizeHref(href.slice(origin.length), localeCode)}`
}

export const websiteTranslationConfig = {
  output: 'apps/website/src/locales',
  strictProtectedTokens: true,
  messageGroups,
  localizeHref: localizeSiteHref,
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
