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

export const localeDefinitions = {
  en: {
    text: 'English',
    loaders: null
  },
  zh: {
    text: '中文',
    loaders: {
      main: () => import('./zh/main.json'),
      nodeDefs: () => import('./zh/nodeDefs.json'),
      commands: () => import('./zh/commands.json'),
      settings: () => import('./zh/settings.json')
    }
  },
  'zh-TW': {
    text: '繁體中文',
    loaders: {
      main: () => import('./zh-TW/main.json'),
      nodeDefs: () => import('./zh-TW/nodeDefs.json'),
      commands: () => import('./zh-TW/commands.json'),
      settings: () => import('./zh-TW/settings.json')
    }
  },
  ru: {
    text: 'Русский',
    loaders: {
      main: () => import('./ru/main.json'),
      nodeDefs: () => import('./ru/nodeDefs.json'),
      commands: () => import('./ru/commands.json'),
      settings: () => import('./ru/settings.json')
    }
  },
  ja: {
    text: '日本語',
    loaders: {
      main: () => import('./ja/main.json'),
      nodeDefs: () => import('./ja/nodeDefs.json'),
      commands: () => import('./ja/commands.json'),
      settings: () => import('./ja/settings.json')
    }
  },
  ko: {
    text: '한국어',
    loaders: {
      main: () => import('./ko/main.json'),
      nodeDefs: () => import('./ko/nodeDefs.json'),
      commands: () => import('./ko/commands.json'),
      settings: () => import('./ko/settings.json')
    }
  },
  fr: {
    text: 'Français',
    loaders: {
      main: () => import('./fr/main.json'),
      nodeDefs: () => import('./fr/nodeDefs.json'),
      commands: () => import('./fr/commands.json'),
      settings: () => import('./fr/settings.json')
    }
  },
  es: {
    text: 'Español',
    loaders: {
      main: () => import('./es/main.json'),
      nodeDefs: () => import('./es/nodeDefs.json'),
      commands: () => import('./es/commands.json'),
      settings: () => import('./es/settings.json')
    }
  },
  ar: {
    text: 'عربي',
    loaders: {
      main: () => import('./ar/main.json'),
      nodeDefs: () => import('./ar/nodeDefs.json'),
      commands: () => import('./ar/commands.json'),
      settings: () => import('./ar/settings.json')
    }
  },
  tr: {
    text: 'Türkçe',
    loaders: {
      main: () => import('./tr/main.json'),
      nodeDefs: () => import('./tr/nodeDefs.json'),
      commands: () => import('./tr/commands.json'),
      settings: () => import('./tr/settings.json')
    }
  },
  'pt-BR': {
    text: 'Português (BR)',
    loaders: {
      main: () => import('./pt-BR/main.json'),
      nodeDefs: () => import('./pt-BR/nodeDefs.json'),
      commands: () => import('./pt-BR/commands.json'),
      settings: () => import('./pt-BR/settings.json')
    }
  },
  fa: {
    text: 'فارسی',
    loaders: {
      main: () => import('./fa/main.json'),
      nodeDefs: () => import('./fa/nodeDefs.json'),
      commands: () => import('./fa/commands.json'),
      settings: () => import('./fa/settings.json')
    }
  }
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

export function resolveSupportedLocale(
  input: string | undefined | null
): SupportedLocale {
  if (!input) return 'en'
  const normalized = input.toLowerCase()
  const exact = supportedLocaleByLower.get(normalized)
  if (exact) return exact
  const base = normalized.split('-')[0]
  const baseMatch = supportedLocaleByLower.get(base)
  if (baseMatch) return baseMatch
  return 'en'
}
