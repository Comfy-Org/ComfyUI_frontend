// Import only English locale eagerly as the default/fallback
// ESLint cannot statically resolve dynamic imports with path aliases (@frontend-locales/*),
// but these are properly configured in tsconfig.json and resolved by Vite at build time.
// eslint-disable-next-line import-x/no-unresolved
import enCommands from '@frontend-locales/en/commands.json' with { type: 'json' }
// eslint-disable-next-line import-x/no-unresolved
import en from '@frontend-locales/en/main.json' with { type: 'json' }
// eslint-disable-next-line import-x/no-unresolved
import enNodes from '@frontend-locales/en/nodeDefs.json' with { type: 'json' }
// eslint-disable-next-line import-x/no-unresolved
import enSettings from '@frontend-locales/en/settings.json' with { type: 'json' }
import { createI18n } from 'vue-i18n'

function buildLocale<
  M extends Record<string, unknown>,
  N extends Record<string, unknown>,
  C extends Record<string, unknown>,
  S extends Record<string, unknown>
>(main: M, nodes: N, commands: C, settings: S) {
  return {
    ...main,
    nodeDefs: nodes,
    commands: commands,
    settings: settings
  } as M & { nodeDefs: N; commands: C; settings: S }
}

// Locale loader map - dynamically import locales only when needed
// ESLint cannot statically resolve these dynamic imports, but they are valid at build time
/* eslint-disable import-x/no-unresolved */
const localeLoaders: Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  ar: () => import('@frontend-locales/ar/main.json'),
  es: () => import('@frontend-locales/es/main.json'),
  fr: () => import('@frontend-locales/fr/main.json'),
  ja: () => import('@frontend-locales/ja/main.json'),
  ko: () => import('@frontend-locales/ko/main.json'),
  ru: () => import('@frontend-locales/ru/main.json'),
  tr: () => import('@frontend-locales/tr/main.json'),
  zh: () => import('@frontend-locales/zh/main.json'),
  'zh-TW': () => import('@frontend-locales/zh-TW/main.json')
}

const nodeDefsLoaders: Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  ar: () => import('@frontend-locales/ar/nodeDefs.json'),
  es: () => import('@frontend-locales/es/nodeDefs.json'),
  fr: () => import('@frontend-locales/fr/nodeDefs.json'),
  ja: () => import('@frontend-locales/ja/nodeDefs.json'),
  ko: () => import('@frontend-locales/ko/nodeDefs.json'),
  ru: () => import('@frontend-locales/ru/nodeDefs.json'),
  tr: () => import('@frontend-locales/tr/nodeDefs.json'),
  zh: () => import('@frontend-locales/zh/nodeDefs.json'),
  'zh-TW': () => import('@frontend-locales/zh-TW/nodeDefs.json')
}

const commandsLoaders: Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  ar: () => import('@frontend-locales/ar/commands.json'),
  es: () => import('@frontend-locales/es/commands.json'),
  fr: () => import('@frontend-locales/fr/commands.json'),
  ja: () => import('@frontend-locales/ja/commands.json'),
  ko: () => import('@frontend-locales/ko/commands.json'),
  ru: () => import('@frontend-locales/ru/commands.json'),
  tr: () => import('@frontend-locales/tr/commands.json'),
  zh: () => import('@frontend-locales/zh/commands.json'),
  'zh-TW': () => import('@frontend-locales/zh-TW/commands.json')
}

const settingsLoaders: Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  ar: () => import('@frontend-locales/ar/settings.json'),
  es: () => import('@frontend-locales/es/settings.json'),
  fr: () => import('@frontend-locales/fr/settings.json'),
  ja: () => import('@frontend-locales/ja/settings.json'),
  ko: () => import('@frontend-locales/ko/settings.json'),
  ru: () => import('@frontend-locales/ru/settings.json'),
  tr: () => import('@frontend-locales/tr/settings.json'),
  zh: () => import('@frontend-locales/zh/settings.json'),
  'zh-TW': () => import('@frontend-locales/zh-TW/settings.json')
}

// Track which locales have been loaded
const loadedLocales = new Set<string>(['en'])

// Track locales currently being loaded to prevent race conditions
const loadingLocales = new Map<string, Promise<void>>()

/**
 * Dynamically load a locale and its associated files (nodeDefs, commands, settings)
 */
export async function loadLocale(locale: string): Promise<void> {
  if (loadedLocales.has(locale)) {
    return
  }

  // If already loading, return the existing promise to prevent duplicate loads
  const existingLoad = loadingLocales.get(locale)
  if (existingLoad) {
    return existingLoad
  }

  const loader = localeLoaders[locale]
  const nodeDefsLoader = nodeDefsLoaders[locale]
  const commandsLoader = commandsLoaders[locale]
  const settingsLoader = settingsLoaders[locale]

  if (!loader || !nodeDefsLoader || !commandsLoader || !settingsLoader) {
    console.warn(`Locale "${locale}" is not supported`)
    return
  }

  // Create and track the loading promise
  const loadPromise = (async () => {
    try {
      const [main, nodes, commands, settings] = await Promise.all([
        loader(),
        nodeDefsLoader(),
        commandsLoader(),
        settingsLoader()
      ])

      const messages = buildLocale(
        main.default,
        nodes.default,
        commands.default,
        settings.default
      )

      i18n.global.setLocaleMessage(locale, messages as LocaleMessages)
      loadedLocales.add(locale)
    } catch (error) {
      console.error(`Failed to load locale "${locale}":`, error)
      throw error
    } finally {
      // Clean up the loading promise once complete
      loadingLocales.delete(locale)
    }
  })()

  loadingLocales.set(locale, loadPromise)
  return loadPromise
}

// Only include English in the initial bundle
const messages = {
  en: buildLocale(en, enNodes, enCommands, enSettings)
}

// Type for locale messages - inferred from the English locale structure
type LocaleMessages = typeof messages.en

export const i18n = createI18n({
  // Must set `false`, as Vue I18n Legacy API is for Vue 2
  legacy: false,
  locale: navigator.language.split('-')[0] || 'en',
  fallbackLocale: 'en',
  messages,
  // Ignore warnings for locale options as each option is in its own language.
  // e.g. "English", "中文", "Русский", "日本語", "한국어", "Français", "Español"
  missingWarn: /^(?!settings\.Comfy_Locale\.options\.).+/,
  fallbackWarn: /^(?!settings\.Comfy_Locale\.options\.).+/
})

/** Convenience shorthand: i18n.global */
export const { t, te } = i18n.global

/**
 * Safe translation function that returns the fallback message if the key is not found.
 *
 * @param key - The key to translate.
 * @param fallbackMessage - The fallback message to use if the key is not found.
 */
export function st(key: string, fallbackMessage: string) {
  return te(key) ? t(key) : fallbackMessage
}
