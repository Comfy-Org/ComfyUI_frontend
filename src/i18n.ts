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

export type SecureLocalizationMessage =
  | string
  | null
  | { readonly [key: string]: SecureLocalizationMessage }

export interface SecureLocalizationCatalog {
  readonly messages: Readonly<Record<string, SecureLocalizationMessage>>
  readonly phrases?: Readonly<Record<string, string>>
}

const secureCatalogs = new Map<
  SupportedLocale,
  Map<string, SecureLocalizationCatalog>
>()
const secureLocaleBases = new Map<SupportedLocale, Record<string, unknown>>()
const forbiddenCatalogKeys = new Set(['__proto__', 'prototype', 'constructor'])

interface CatalogBudget {
  entries: number
  bytes: number
  readonly seen: WeakSet<object>
  readonly encoder: TextEncoder
}

function cloneLocaleTree<T>(value: T): T {
  if (value === null || typeof value === 'string') return value
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(
      'localization catalogs contain only objects and strings'
    )
  }
  const result: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    result[key] = cloneLocaleTree(child)
  }
  return result as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function secureCatalogRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value))
    throw new TypeError('localization catalog must be an object')
  const raw = value
  const keys = Object.keys(raw)
  if (
    !keys.includes('messages') ||
    keys.some((key) => key !== 'messages' && key !== 'phrases') ||
    !isRecord(raw.messages)
  ) {
    throw new TypeError(
      'localization catalog requires messages and optional phrases'
    )
  }
  return raw
}

function addCatalogString(
  budget: CatalogBudget,
  text: string,
  maximum: number,
  label: string
): void {
  const size = budget.encoder.encode(text).byteLength
  if (size > maximum || text.includes('\0')) {
    throw new TypeError(`localization ${label} exceeds its bound`)
  }
  budget.bytes += size
  if (budget.bytes > 4 * 1024 * 1024) {
    throw new TypeError('localization catalog exceeds 4 MiB')
  }
}

function addCatalogEntry(budget: CatalogBudget): void {
  budget.entries++
  if (budget.entries > 20_000) {
    throw new TypeError('localization catalog has too many entries')
  }
}

function secureMessageRecord(
  input: unknown,
  depth: number
): Record<string, unknown> {
  if (!isRecord(input) || depth > 16) {
    throw new TypeError('localization message tree is invalid')
  }
  return input
}

function normalizeSecureMessage(
  input: unknown,
  budget: CatalogBudget,
  depth: number
): SecureLocalizationMessage {
  if (typeof input === 'string') {
    addCatalogString(budget, input, 4096, 'message')
    return input
  }
  if (input === null) return null

  const record = secureMessageRecord(input, depth)
  if (budget.seen.has(record)) {
    throw new TypeError('localization catalog is cyclic')
  }
  budget.seen.add(record)
  const output: Record<string, SecureLocalizationMessage> = {}
  for (const [key, child] of Object.entries(record)) {
    if (forbiddenCatalogKeys.has(key)) {
      throw new TypeError('localization catalog contains a forbidden key')
    }
    addCatalogEntry(budget)
    addCatalogString(budget, key, 512, 'key')
    output[key] = normalizeSecureMessage(child, budget, depth + 1)
  }
  budget.seen.delete(record)
  return output
}

function normalizeCatalogMessages(
  input: unknown,
  budget: CatalogBudget
): Readonly<Record<string, SecureLocalizationMessage>> {
  const messages = normalizeSecureMessage(input, budget, 0)
  if (!messages || typeof messages !== 'object' || Array.isArray(messages)) {
    throw new TypeError('localization messages must be an object')
  }
  return messages
}

function normalizeCatalogPhrases(
  input: unknown,
  budget: CatalogBudget
): Readonly<Record<string, string>> | undefined {
  if (input === undefined) return undefined
  if (!isRecord(input)) {
    throw new TypeError('localization phrases must be an object')
  }
  const phrases: Record<string, string> = {}
  for (const [source, translated] of Object.entries(input)) {
    if (forbiddenCatalogKeys.has(source) || typeof translated !== 'string') {
      throw new TypeError('localization phrase is invalid')
    }
    addCatalogEntry(budget)
    addCatalogString(budget, source, 4096, 'phrase source')
    addCatalogString(budget, translated, 4096, 'phrase translation')
    phrases[source] = translated
  }
  return phrases
}

function normalizeSecureCatalog(value: unknown): SecureLocalizationCatalog {
  const raw = secureCatalogRecord(value)
  const budget: CatalogBudget = {
    entries: 0,
    bytes: 0,
    seen: new WeakSet(),
    encoder: new TextEncoder()
  }
  const messages = normalizeCatalogMessages(raw.messages, budget)
  const phrases = normalizeCatalogPhrases(raw.phrases, budget)
  return { messages, ...(phrases ? { phrases } : {}) }
}

function applySecureCatalogs(locale: SupportedLocale): void {
  const base = secureLocaleBases.get(locale)
  const catalogs = secureCatalogs.get(locale)
  if (!base || !catalogs?.size) return
  i18n.global.setLocaleMessage(locale, cloneLocaleTree(base) as LocaleMessages)
  for (const catalog of catalogs.values()) {
    i18n.global.mergeLocaleMessage(
      locale,
      cloneLocaleTree(catalog.messages) as unknown as LocaleMessages
    )
  }
}

function restoreSecureLocaleBase(locale: SupportedLocale): void {
  const base = secureLocaleBases.get(locale)
  if (base) {
    i18n.global.setLocaleMessage(
      locale,
      cloneLocaleTree(base) as LocaleMessages
    )
  }
}

function refreshSecureLocaleBase(locale: SupportedLocale): void {
  if (!secureCatalogs.get(locale)?.size) return
  secureLocaleBases.set(
    locale,
    cloneLocaleTree(
      i18n.global.getLocaleMessage(locale) as Record<string, unknown>
    )
  )
  applySecureCatalogs(locale)
}

/**
 * Register one sandboxed pack's bounded, declarative locale contribution.
 * Pack identity is supplied by the host and is never chosen by guest code.
 */
export function registerSecureLocalizationCatalog(
  owner: string,
  locale: string,
  value: unknown
): () => void {
  if (
    typeof owner !== 'string' ||
    owner.length < 1 ||
    owner.length > 256 ||
    owner.includes('\0')
  ) {
    throw new TypeError('localization owner is invalid')
  }
  if (!Object.prototype.hasOwnProperty.call(localeDefinitions, locale)) {
    throw new TypeError(`unsupported localization locale "${locale}"`)
  }
  const supportedLocale = locale as SupportedLocale
  const catalog = normalizeSecureCatalog(value)
  let byOwner = secureCatalogs.get(supportedLocale)
  if (!byOwner) {
    byOwner = new Map()
    secureCatalogs.set(supportedLocale, byOwner)
  }
  if (byOwner.has(owner)) {
    throw new TypeError(`duplicate localization catalog for ${owner}/${locale}`)
  }
  byOwner.set(owner, catalog)
  if (loadedLocales.has(supportedLocale)) {
    if (!secureLocaleBases.has(supportedLocale)) {
      secureLocaleBases.set(
        supportedLocale,
        cloneLocaleTree(
          i18n.global.getLocaleMessage(supportedLocale) as Record<
            string,
            unknown
          >
        )
      )
    }
    applySecureCatalogs(supportedLocale)
  }

  let active = true
  return () => {
    if (!active) return
    active = false
    const current = secureCatalogs.get(supportedLocale)
    current?.delete(owner)
    if (!current?.size) secureCatalogs.delete(supportedLocale)
    if (!loadedLocales.has(supportedLocale)) return
    const base = secureLocaleBases.get(supportedLocale)
    if (!base) return
    if (current?.size) {
      applySecureCatalogs(supportedLocale)
    } else {
      i18n.global.setLocaleMessage(
        supportedLocale,
        cloneLocaleTree(base) as LocaleMessages
      )
      secureLocaleBases.delete(supportedLocale)
    }
  }
}

/** Exact-source fallback used only at host-owned translation render points. */
export function translateSecurePhrase(
  source: string,
  locale: string = i18n.global.locale.value
): string {
  const catalogs = secureCatalogs.get(locale as SupportedLocale)
  if (!catalogs || typeof source !== 'string') return source
  const ordered = [...catalogs.values()].reverse()
  for (const catalog of ordered) {
    const translated = catalog.phrases?.[source]
    if (typeof translated === 'string') return translated
  }
  return source
}

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
      refreshSecureLocaleBase(locale)
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
      restoreSecureLocaleBase(locale as SupportedLocale)
      i18n.global.mergeLocaleMessage(locale, message)
      refreshSecureLocaleBase(locale as SupportedLocale)
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
    if (typeof def.name !== 'string') continue
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

function customNodesProvide(nodeName: string, path: string): boolean {
  const data = customNodesI18nData[i18n.global.locale.value]
  if (typeof data !== 'object' || data === null) return false
  const nodeDefs = (data as Record<string, unknown>)['nodeDefs']
  if (typeof nodeDefs !== 'object' || nodeDefs === null) return false

  for (const candidate of nodeDefKeyCandidates(nodeName)) {
    let cursor: unknown = nodeDefs
    for (const segment of `${candidate}.${path}`.split('.')) {
      if (typeof cursor !== 'object' || cursor === null) {
        cursor = undefined
        break
      }
      cursor = (cursor as Record<string, unknown>)[segment]
    }
    if (typeof cursor === 'string') return true
  }
  return false
}

function secureMessageAtPath(
  root: Readonly<Record<string, SecureLocalizationMessage>>,
  path: string
): SecureLocalizationMessage | undefined {
  let cursor: SecureLocalizationMessage | undefined = root
  for (const segment of path.split('.')) {
    if (typeof cursor !== 'object' || cursor === null) return undefined
    cursor = cursor[segment]
  }
  return cursor
}

function secureCatalogHasNodeText(
  catalog: SecureLocalizationCatalog,
  candidates: readonly string[],
  path: string
): boolean {
  const nodeDefs = catalog.messages['nodeDefs']
  if (typeof nodeDefs !== 'object' || nodeDefs === null) return false
  return candidates.some(
    (candidate) =>
      typeof secureMessageAtPath(nodeDefs, `${candidate}.${path}`) === 'string'
  )
}

function secureCatalogProvides(nodeName: string, path: string): boolean {
  const catalogs = secureCatalogs.get(i18n.global.locale.value)
  if (!catalogs) return false
  const candidates = nodeDefKeyCandidates(nodeName)
  return [...catalogs.values()].some((catalog) =>
    secureCatalogHasNodeText(catalog, candidates, path)
  )
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

/**
 * Reads a resolved locale message. `st` compiles it; `stRaw` does not.
 */
type MessageReader = (key: string, fallbackMessage: string) => string

function translateNodeDefText(
  nodeName: string,
  path: string,
  fallback: string,
  read: MessageReader
): string {
  for (const candidate of nodeDefKeyCandidates(nodeName)) {
    const key = `nodeDefs.${candidate}.${path}`
    if (te(key)) return read(key, fallback)
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
function resolveNodeDefPath(
  nodeName: string,
  path: string,
  backend: string | undefined,
  fallback: string,
  read: MessageReader
): string {
  if (
    customNodesProvide(nodeName, path) ||
    secureCatalogProvides(nodeName, path)
  ) {
    return translateNodeDefText(nodeName, path, fallback, read)
  }
  if (i18n.global.locale.value === 'en' && backend !== undefined) return backend

  return translateSecurePhrase(
    translateNodeDefText(nodeName, path, fallback, read)
  )
}

export function resolveNodeDefText(
  field: NodeDefTextField,
  nodeName: string,
  backendValue?: string
): string {
  const backend = backendValue ?? backendNodeText.get(nodeName)?.[field]
  const fallback = backend ?? (field === 'display_name' ? nodeName : '')

  return resolveNodeDefPath(nodeName, field, backend, fallback, st)
}

/** Slot fields the generated locales carry text for. */
export type NodeDefSlotTextField = 'name' | 'tooltip'

/**
 * `name` is escaped by `scripts/nodeDefLocaleSerializer.ts` and has to be
 * compiled back; `tooltip` is stored verbatim and must never reach the message
 * compiler, or a literal `{'@'}` would render to the user.
 */
function slotMessageReader(field: NodeDefSlotTextField): MessageReader {
  return field === 'tooltip' ? stRaw : st
}

export function resolveNodeDefSlotText(
  field: NodeDefSlotTextField,
  nodeName: string,
  slot: string | number,
  backendValue?: string,
  fallbackValue = ''
): string {
  const slotPath =
    typeof slot === 'string'
      ? `inputs.${normalizeI18nKey(slot)}`
      : `outputs.${slot}`

  return resolveNodeDefPath(
    nodeName,
    `${slotPath}.${field}`,
    backendValue,
    backendValue ?? fallbackValue,
    slotMessageReader(field)
  )
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
  if (!te(key)) return translateSecurePhrase(fallbackMessage)

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
  if (!te(key)) return translateSecurePhrase(fallbackMessage)

  return rawTranslationOrFallback(key, fallbackMessage)
}
