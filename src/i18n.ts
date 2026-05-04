import { createI18n } from 'vue-i18n'

import {
  getDefaultLocale,
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
 * Dynamically load a shipped locale's bundles (nodeDefs, commands, settings).
 * Callers must pre-resolve untrusted input via `resolveSupportedLocale` or
 * `setActiveLocale`, which is the boundary helper for arbitrary input.
 */
export async function loadLocale(locale: SupportedLocale): Promise<void> {
  if (loadedLocales.has(locale)) {
    return
  }

  const existingLoad = loadingLocales.get(locale)
  if (existingLoad) {
    await existingLoad
    return
  }

  const loaders = localeDefinitions[locale].loaders
  if (!loaders) {
    return
  }

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

      i18n.global.setLocaleMessage(locale, messages as LocaleMessages)
      loadedLocales.add(locale)

      if (customNodesI18nData[locale]) {
        i18n.global.mergeLocaleMessage(locale, customNodesI18nData[locale])
      }
    } catch (error) {
      console.error(`Failed to load locale "${locale}":`, error)
      throw error
    } finally {
      loadingLocales.delete(locale)
    }
  })()

  loadingLocales.set(locale, loadPromise)
  await loadPromise
}

/**
 * Boundary helper for arbitrary locale input (settings, browser preferences):
 * resolves to a shipped tag, loads it, and updates the active locale.
 */
export async function setActiveLocale(
  input: string | readonly string[] | null | undefined
): Promise<SupportedLocale> {
  const resolved = resolveSupportedLocale(input)
  await loadLocale(resolved)
  i18n.global.locale.value = resolved
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

// Only include English in the initial bundle; other locales lazy-load.
const enMessages = buildLocale(en, enNodes, enCommands, enSettings)
type LocaleMessages = typeof enMessages

const messages: Partial<Record<SupportedLocale, LocaleMessages>> = {
  en: enMessages
}

export const i18n = createI18n({
  // Must set `false`, as Vue I18n Legacy API is for Vue 2
  legacy: false,
  locale: getDefaultLocale(),
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
