type LocaleJsonLoader = () => Promise<{
  default: Record<string, unknown>
}>

type LocaleLoaderBundle = {
  main: LocaleJsonLoader
  nodeDefs: LocaleJsonLoader
  commands: LocaleJsonLoader
  settings: LocaleJsonLoader
}

type LocaleDefinition = {
  text: string
  loaders: LocaleLoaderBundle | null
}

// Vite code-splits each matched module into its own async chunk; only the
// resolved locale's bundle is fetched at runtime.
const localeFiles = import.meta.glob<{ default: Record<string, unknown> }>(
  './*/{main,nodeDefs,commands,settings}.json'
)

function loadersFor(locale: string): LocaleLoaderBundle {
  return {
    main: localeFiles[`./${locale}/main.json`],
    nodeDefs: localeFiles[`./${locale}/nodeDefs.json`],
    commands: localeFiles[`./${locale}/commands.json`],
    settings: localeFiles[`./${locale}/settings.json`]
  }
}

export const localeDefinitions = {
  en: { text: 'English', loaders: null },
  zh: { text: '中文', loaders: loadersFor('zh') },
  'zh-TW': { text: '繁體中文', loaders: loadersFor('zh-TW') },
  ru: { text: 'Русский', loaders: loadersFor('ru') },
  ja: { text: '日本語', loaders: loadersFor('ja') },
  ko: { text: '한국어', loaders: loadersFor('ko') },
  fr: { text: 'Français', loaders: loadersFor('fr') },
  es: { text: 'Español', loaders: loadersFor('es') },
  ar: { text: 'عربي', loaders: loadersFor('ar') },
  tr: { text: 'Türkçe', loaders: loadersFor('tr') },
  'pt-BR': { text: 'Português (BR)', loaders: loadersFor('pt-BR') },
  fa: { text: 'فارسی', loaders: loadersFor('fa') }
} as const satisfies Record<string, LocaleDefinition>

export type SupportedLocale = keyof typeof localeDefinitions

const SUPPORTED_LOCALES = Object.keys(localeDefinitions) as SupportedLocale[]

export const SUPPORTED_LOCALE_OPTIONS = SUPPORTED_LOCALES.map((value) => ({
  value,
  text: localeDefinitions[value].text
}))

const supportedLocaleByLower = new Map<string, SupportedLocale>(
  SUPPORTED_LOCALES.map((locale) => [locale.toLowerCase(), locale])
)

function matchSingle(candidate: string): SupportedLocale | undefined {
  const normalized = candidate.toLowerCase()
  return (
    supportedLocaleByLower.get(normalized) ??
    supportedLocaleByLower.get(normalized.split('-')[0])
  )
}

export function resolveSupportedLocale(
  input?: string | readonly string[] | null
): SupportedLocale {
  const candidates = Array.isArray(input) ? input : input ? [input] : []
  for (const candidate of candidates) {
    if (!candidate) continue
    const matched = matchSingle(candidate)
    if (matched) return matched
  }
  return 'en'
}

export function getDefaultLocale(): SupportedLocale {
  return resolveSupportedLocale(navigator.languages)
}
