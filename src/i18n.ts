import { createI18n } from 'vue-i18n'

import {
  getDefaultLocale,
  localeDefinitions,
  resolveSupportedLocale
} from '@/locales/localeConfig'
import type { SupportedLocale } from '@/locales/localeConfig'
import { normalizeI18nKey } from '@/utils/formatUtil'

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
 *
 * Returns the resolved tag so callers can detect a clamp (e.g. a stale stored
 * `Comfy.Locale` from an older build) and self-heal persisted state.
 */
export async function setActiveLocale(
  input: string | readonly string[] | null | undefined
): Promise<SupportedLocale> {
  const resolved = resolveSupportedLocale(input)
  if (typeof input === 'string' && input && input !== resolved) {
    // Single warn — gated on a real clamp event, never per missing key — so
    // stale stored locales surface in logs without re-introducing #1867's spam.
    console.warn(`Locale "${input}" not shipped; using "${resolved}"`)
  }
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

export type NodeDefTextField = 'display_name' | 'description'

/**
 * Raw `/object_info` text, kept out of the vue-i18n message tree so English
 * never reaches the message compiler. Rebuilt on every fetch, so a def that
 * stops sending a field stops resolving to the previous value.
 */
const backendNodeText = new Map<
  string,
  Partial<Record<NodeDefTextField, string>>
>()

export function setBackendNodeText(
  defs: Iterable<{
    name?: unknown
    display_name?: unknown
    description?: unknown
  }>
): void {
  backendNodeText.clear()
  for (const def of defs) {
    if (typeof def?.name !== 'string') continue
    const entry: Partial<Record<NodeDefTextField, string>> = {}
    if (typeof def.display_name === 'string' && def.display_name) {
      entry.display_name = def.display_name
    }
    if (typeof def.description === 'string' && def.description) {
      entry.description = def.description
    }
    if (entry.display_name ?? entry.description)
      backendNodeText.set(def.name, entry)
  }
}

function customNodesProvide(
  nodeName: string,
  field: NodeDefTextField
): boolean {
  const data = customNodesI18nData[i18n.global.locale.value]
  if (typeof data !== 'object' || data === null) return false
  const nodeDefs = (data as Record<string, unknown>)['nodeDefs']
  if (typeof nodeDefs !== 'object' || nodeDefs === null) return false

  for (const path of nodeDefKeyCandidates(nodeName)) {
    let cursor: unknown = nodeDefs
    for (const segment of path.split('.')) {
      if (typeof cursor !== 'object' || cursor === null) break
      cursor = (cursor as Record<string, unknown>)[segment]
    }
    if (typeof cursor === 'object' && cursor !== null) {
      if (typeof (cursor as Record<string, unknown>)[field] === 'string')
        return true
    }
  }
  return false
}

/**
 * Generated locales key dotted node ids flat (`my_node`). Locales written by
 * hand before that convention nest them (`my.node`), which vue-i18n resolves by
 * path traversal, so both are tried.
 */
function nodeDefKeyCandidates(nodeName: string): string[] {
  const normalized = normalizeI18nKey(nodeName)
  return normalized === nodeName ? [normalized] : [normalized, nodeName]
}

function translateNodeDefText(
  nodeName: string,
  field: NodeDefTextField,
  fallback: string
): string {
  for (const path of nodeDefKeyCandidates(nodeName)) {
    const key = `nodeDefs.${path}.${field}`
    if (te(key)) return st(key, fallback)
  }
  return fallback
}

/**
 * Resolves node text in priority order.
 *
 * `en`: custom-node `/api/i18n` translations, then the live backend value, then
 * the bundled snapshot. English is the source language, so a backend value is
 * data rather than a translation and is returned without being compiled.
 *
 * Other locales: translations stay authoritative, falling back to the live
 * backend value rather than the stale English snapshot.
 */
export function resolveNodeDefText(
  field: NodeDefTextField,
  nodeName: string,
  backendValue?: string
): string {
  const backend = backendValue ?? backendNodeText.get(nodeName)?.[field]
  const fallback = backend ?? (field === 'display_name' ? nodeName : '')

  if (customNodesProvide(nodeName, field)) {
    return translateNodeDefText(nodeName, field, fallback)
  }
  if (i18n.global.locale.value === 'en' && backend !== undefined) return backend

  return translateNodeDefText(nodeName, field, fallback)
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
export const t: (typeof i18n.global)['t'] = i18n.global.t
// vue-i18n 11's te() consults the fallback locale; default to the active
// locale to preserve the v9 behavior our fallback paths rely on.
export const te: (typeof i18n.global)['te'] = (key, locale) =>
  i18n.global.te(key, locale ?? i18n.global.locale.value)
export const d: (typeof i18n.global)['d'] = i18n.global.d
const tm = i18n.global.tm

function rawTranslationOrFallback(key: string, fallbackMessage: string) {
  const message = tm(key)
  return typeof message === 'string' ? message : fallbackMessage
}

/**
 * Safe translation function that returns the fallback message if the key is not found.
 * Invalid message syntax falls back to the raw locale message instead of crashing.
 *
 * @param key - The key to translate.
 * @param fallbackMessage - The fallback message to use if the key is not found.
 */
export function st(key: string, fallbackMessage: string) {
  if (!te(key)) return fallbackMessage

  try {
    // The normal defaultMsg overload fails in some cases for custom nodes
    return t(key)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return rawTranslationOrFallback(key, fallbackMessage)
  }
}

/**
 * Safe raw translation function for strings that may contain i18n syntax.
 *
 * @param key - The key for the raw locale message.
 * @param fallbackMessage - The fallback message to use if the key is not found
 * or the locale message is not a string.
 */
export function stRaw(key: string, fallbackMessage: string) {
  if (!te(key)) return fallbackMessage

  return rawTranslationOrFallback(key, fallbackMessage)
}
