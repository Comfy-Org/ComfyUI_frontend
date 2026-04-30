import { createI18n } from 'vue-i18n'

import {
  localeDefinitions,
  resolveSupportedLocale
} from '@/locales/localeConfig'
import type { SupportedLocale } from '@/locales/localeConfig'

// Import only English locale eagerly as the default/fallback
import enCommands from './locales/en/commands.json' with { type: 'json' }
import en from './locales/en/main.json' with { type: 'json' }
import enNodes from './locales/en/nodeDefs.json' with { type: 'json' }
import enSettings from './locales/en/settings.json' with { type: 'json' }

export { resolveSupportedLocale }

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

// Track which locales have been loaded
const loadedLocales = new Set<string>(['en'])

// Track locales currently being loaded to prevent race conditions
const loadingLocales = new Map<string, Promise<void>>()

// Store custom nodes i18n data for merging when locales are lazily loaded
const customNodesI18nData: Record<string, unknown> = {}

/**
 * Dynamically load a locale and its associated files (nodeDefs, commands, settings).
 * Unsupported locales are clamped to `'en'`.
 */
export async function loadLocale(locale: string): Promise<SupportedLocale> {
  const resolved = resolveSupportedLocale(locale)
  if (loadedLocales.has(resolved)) {
    return resolved
  }

  // If already loading, return the existing promise to prevent duplicate loads
  const existingLoad = loadingLocales.get(resolved)
  if (existingLoad) {
    await existingLoad
    return resolved
  }

  const loaders = localeDefinitions[resolved].loaders
  if (!loaders) {
    return resolved
  }

  // Create and track the loading promise
  const loadPromise = (async () => {
    try {
      const [main, nodes, commands, settings] = await Promise.all([
        loaders.main(),
        loaders.nodeDefs(),
        loaders.commands(),
        loaders.settings()
      ])

      const messages = buildLocale(
        main.default,
        nodes.default,
        commands.default,
        settings.default
      )

      i18n.global.setLocaleMessage(resolved, messages as LocaleMessages)
      loadedLocales.add(resolved)

      if (customNodesI18nData[resolved]) {
        i18n.global.mergeLocaleMessage(resolved, customNodesI18nData[resolved])
      }
    } catch (error) {
      console.error(`Failed to load locale "${resolved}":`, error)
      throw error
    } finally {
      // Clean up the loading promise once complete
      loadingLocales.delete(resolved)
    }
  })()

  loadingLocales.set(resolved, loadPromise)
  await loadPromise
  return resolved
}

/**
 * Stores the data for later use when locales are lazily loaded,
 * and immediately merges data for already-loaded locales.
 */
export function mergeCustomNodesI18n(i18nData: Record<string, unknown>): void {
  // Clear existing data and replace with new data
  for (const key of Object.keys(customNodesI18nData)) {
    delete customNodesI18nData[key]
  }
  Object.assign(customNodesI18nData, i18nData)

  for (const [locale, message] of Object.entries(i18nData)) {
    if (loadedLocales.has(locale)) {
      i18n.global.mergeLocaleMessage(locale, message)
    }
  }
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
  locale: resolveSupportedLocale(navigator.language),
  fallbackLocale: 'en',
  escapeParameter: true,
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
  // The normal defaultMsg overload fails in some cases for custom nodes
  return te(key) ? t(key) : fallbackMessage
}
