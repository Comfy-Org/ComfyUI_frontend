import { createI18n } from 'vue-i18n'

// Import only English locale eagerly as the default/fallback
import enCommands from './locales/en/commands.json' with { type: 'json' }
import en from './locales/en/main.json' with { type: 'json' }
import enNodes from './locales/en/nodeDefs.json' with { type: 'json' }
import enSettings from './locales/en/settings.json' with { type: 'json' }

function buildLocale<M, N, C, S>(main: M, nodes: N, commands: C, settings: S) {
  return {
    ...main,
    nodeDefs: nodes,
    commands: commands,
    settings: settings
  }
}

// Locale loader map - dynamically import locales only when needed
const localeLoaders: Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  ar: () => import('./locales/ar/main.json'),
  es: () => import('./locales/es/main.json'),
  fr: () => import('./locales/fr/main.json'),
  ja: () => import('./locales/ja/main.json'),
  ko: () => import('./locales/ko/main.json'),
  ru: () => import('./locales/ru/main.json'),
  tr: () => import('./locales/tr/main.json'),
  zh: () => import('./locales/zh/main.json'),
  'zh-TW': () => import('./locales/zh-TW/main.json')
}

const nodeDefsLoaders: Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  ar: () => import('./locales/ar/nodeDefs.json'),
  es: () => import('./locales/es/nodeDefs.json'),
  fr: () => import('./locales/fr/nodeDefs.json'),
  ja: () => import('./locales/ja/nodeDefs.json'),
  ko: () => import('./locales/ko/nodeDefs.json'),
  ru: () => import('./locales/ru/nodeDefs.json'),
  tr: () => import('./locales/tr/nodeDefs.json'),
  zh: () => import('./locales/zh/nodeDefs.json'),
  'zh-TW': () => import('./locales/zh-TW/nodeDefs.json')
}

const commandsLoaders: Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  ar: () => import('./locales/ar/commands.json'),
  es: () => import('./locales/es/commands.json'),
  fr: () => import('./locales/fr/commands.json'),
  ja: () => import('./locales/ja/commands.json'),
  ko: () => import('./locales/ko/commands.json'),
  ru: () => import('./locales/ru/commands.json'),
  tr: () => import('./locales/tr/commands.json'),
  zh: () => import('./locales/zh/commands.json'),
  'zh-TW': () => import('./locales/zh-TW/commands.json')
}

const settingsLoaders: Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  ar: () => import('./locales/ar/settings.json'),
  es: () => import('./locales/es/settings.json'),
  fr: () => import('./locales/fr/settings.json'),
  ja: () => import('./locales/ja/settings.json'),
  ko: () => import('./locales/ko/settings.json'),
  ru: () => import('./locales/ru/settings.json'),
  tr: () => import('./locales/tr/settings.json'),
  zh: () => import('./locales/zh/settings.json'),
  'zh-TW': () => import('./locales/zh-TW/settings.json')
}

// Track which locales have been loaded
const loadedLocales = new Set<string>(['en'])

/**
 * Dynamically load a locale and its associated files (nodeDefs, commands, settings)
 */
export async function loadLocale(locale: string): Promise<void> {
  if (loadedLocales.has(locale)) {
    return
  }

  const loader = localeLoaders[locale]
  const nodeDefsLoader = nodeDefsLoaders[locale]
  const commandsLoader = commandsLoaders[locale]
  const settingsLoader = settingsLoaders[locale]

  if (!loader || !nodeDefsLoader || !commandsLoader || !settingsLoader) {
    console.warn(`Locale "${locale}" is not supported`)
    return
  }

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

    i18n.global.setLocaleMessage(locale, messages as any)
    loadedLocales.add(locale)
  } catch (error) {
    console.error(`Failed to load locale "${locale}":`, error)
    throw error
  }
}

// Only include English in the initial bundle
const messages = {
  en: buildLocale(en, enNodes, enCommands, enSettings)
}

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
export const { t, te, d } = i18n.global

/**
 * Safe translation function that returns the fallback message if the key is not found.
 *
 * @param key - The key to translate.
 * @param fallbackMessage - The fallback message to use if the key is not found.
 */
export function st(key: string, fallbackMessage: string) {
  return te(key) ? t(key) : fallbackMessage
}
