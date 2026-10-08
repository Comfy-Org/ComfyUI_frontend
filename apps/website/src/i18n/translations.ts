import { createI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, LOCALE_CODES, resolveLocale } from '@/config/locales'
import type { Locale } from '@/config/locales'

const catalogLoaders = {
  en: () => import('@/locales/en/main.json', { with: { type: 'json' } }),
  'zh-CN': () =>
    import('@/locales/zh-CN/main.json', { with: { type: 'json' } }),
  ja: () => import('@/locales/ja/main.json', { with: { type: 'json' } })
} satisfies Record<Locale, () => Promise<{ default: object }>>

type EnglishCatalog = Awaited<ReturnType<typeof catalogLoaders.en>>['default']

type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`
}[keyof T & string]

export type TranslationKey = MessageKey<EnglishCatalog>

export type LocalizedText = { en: string; 'zh-CN': string } & Partial<
  Record<Locale, string>
>

function createSiteComposer(locale: Locale) {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: DEFAULT_LOCALE,
    missingWarn: false,
    fallbackWarn: false,
    warnHtmlMessage: false
  }).global
}

const composers = {
  en: createSiteComposer('en'),
  'zh-CN': createSiteComposer('zh-CN'),
  ja: createSiteComposer('ja')
} satisfies Record<Locale, ReturnType<typeof createSiteComposer>>

type MessageTree = { [key: string]: string | MessageTree }

function isMessageTree(value: unknown): value is MessageTree {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (entry: unknown) => typeof entry === 'string' || isMessageTree(entry)
    )
  )
}

async function fetchDeclaredCatalog(
  page: Document,
  locale: Locale
): Promise<MessageTree | undefined> {
  const href = page
    .querySelector(`link[data-locale-catalog="${locale}"]`)
    ?.getAttribute('href')
  if (!href) return undefined
  const response = await fetch(href)
  if (!response.ok) {
    throw new Error(
      `The ${locale} catalog at ${href} returned ${response.status}`
    )
  }
  const catalog: unknown = await response.json()
  if (!isMessageTree(catalog)) {
    throw new Error(`The ${locale} catalog at ${href} is not a message catalog`)
  }
  return catalog
}

const loadedLocales = new Set<Locale>()
const localeLoads = new Map<Locale, Promise<void>>()

async function addCatalog(locale: Locale, page?: Document): Promise<void> {
  const declared = page ? await fetchDeclaredCatalog(page, locale) : undefined
  const catalog = declared ?? (await catalogLoaders[locale]()).default
  for (const composer of Object.values(composers)) {
    composer.setLocaleMessage(locale, catalog)
  }
  loadedLocales.add(locale)
}

function loadLocale(locale: Locale, page?: Document): Promise<void> {
  const load =
    localeLoads.get(locale) ??
    addCatalog(locale, page).catch((error: unknown) => {
      localeLoads.delete(locale)
      throw error
    })
  localeLoads.set(locale, load)
  return load
}

const pageDocument =
  typeof window !== 'undefined' && import.meta.env.PROD ? document : undefined

if (pageDocument) {
  pageDocument.addEventListener('astro:before-preparation', (event) => {
    const loadDocument = event.loader
    event.loader = async () => {
      await loadDocument()
      if (event.defaultPrevented) return
      const { newDocument } = event
      try {
        await loadLocale(
          resolveLocale(newDocument.documentElement.lang),
          newDocument
        )
      } catch {
        event.preventDefault()
      }
    }
  })
}

const initialLocales = new Set<Locale>(
  pageDocument
    ? [DEFAULT_LOCALE, resolveLocale(pageDocument.documentElement.lang)]
    : LOCALE_CODES
)

await Promise.all(
  [...initialLocales].map((locale) =>
    loadLocale(locale, pageDocument).catch(() => loadLocale(locale))
  )
)

if (pageDocument) {
  const locale = resolveLocale(pageDocument.documentElement.lang)
  await loadLocale(locale, pageDocument).catch(() => loadLocale(locale))
}

export function translationsFor(locale: Locale) {
  if (!loadedLocales.has(locale)) {
    throw new Error(`The ${locale} catalog is not loaded on this page`)
  }
  return composers[locale]
}

export const { t, te } = translationsFor(DEFAULT_LOCALE)

export type { Locale }
