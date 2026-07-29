import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as I18nModule from './i18n'

let i18n: typeof I18nModule.i18n
let loadLocale: typeof I18nModule.loadLocale
let mergeCustomNodesI18n: typeof I18nModule.mergeCustomNodesI18n
let resolveSupportedLocale: typeof I18nModule.resolveSupportedLocale
let setActiveLocale: typeof I18nModule.setActiveLocale
let te: typeof I18nModule.te

async function importI18nModule() {
  const i18nModule = await import('./i18n')
  i18n = i18nModule.i18n
  loadLocale = i18nModule.loadLocale
  mergeCustomNodesI18n = i18nModule.mergeCustomNodesI18n
  resolveSupportedLocale = i18nModule.resolveSupportedLocale
  setActiveLocale = i18nModule.setActiveLocale
  te = i18nModule.te
}

// Mock the JSON imports before importing i18n module
vi.mock('./locales/en/main.json', () => ({
  default: { welcome: 'Welcome', enOnly: 'English only' }
}))
vi.mock('./locales/en/nodeDefs.json', () => ({
  default: { testNode: 'Test Node' }
}))
vi.mock('./locales/en/commands.json', () => ({
  default: { save: 'Save' }
}))
vi.mock('./locales/en/settings.json', () => ({
  default: { theme: 'Theme' }
}))

// Mock lazy-loaded locales
vi.mock('./locales/zh/main.json', () => ({ default: { welcome: 'æ¬¢è¿Ž' } }))
vi.mock('./locales/zh/nodeDefs.json', () => ({
  default: { testNode: 'æµ‹è¯•èŠ‚ç‚¹' }
}))
vi.mock('./locales/zh/commands.json', () => ({ default: { save: 'ä¿å­˜' } }))
vi.mock('./locales/zh/settings.json', () => ({ default: { theme: 'ä¸»é¢˜' } }))

describe('i18n', () => {
  beforeEach(async () => {
    vi.resetModules()
    await importI18nModule()
  })

  describe('mergeCustomNodesI18n', () => {
    it('should immediately merge data for already loaded locales (en)', async () => {
      // English is pre-loaded, so merge should work immediately
      mergeCustomNodesI18n({
        en: {
          customNode: {
            title: 'Custom Node Title'
          }
        }
      })

      // Verify the custom node data was merged
      const messages = i18n.global.getLocaleMessage('en') as Record<
        string,
        unknown
      >
      expect(messages.customNode).toEqual({ title: 'Custom Node Title' })
    })

    it('should store data for not-yet-loaded locales', async () => {
      // Chinese is not pre-loaded, data should be stored but not merged yet
      mergeCustomNodesI18n({
        zh: {
          customNode: {
            title: 'è‡ªå®šä¹‰èŠ‚ç‚¹æ ‡é¢˜'
          }
        }
      })

      // zh locale should not exist yet (not loaded)
      const zhMessages = i18n.global.getLocaleMessage('zh') as Record<
        string,
        unknown
      >
      // Either empty or doesn't have our custom data merged directly
      // (since zh wasn't loaded yet, mergeLocaleMessage on non-existent locale
      // may create an empty locale or do nothing useful)
      expect(zhMessages.customNode).toBeUndefined()
    })

    it('should merge stored data when locale is lazily loaded', async () => {
      // First, store custom nodes i18n data (before locale is loaded)
      mergeCustomNodesI18n({
        zh: {
          customNode: {
            title: 'è‡ªå®šä¹‰èŠ‚ç‚¹æ ‡é¢˜'
          }
        }
      })

      await loadLocale('zh')

      // Verify both the base locale data and custom node data are present
      const zhMessages = i18n.global.getLocaleMessage('zh') as Record<
        string,
        unknown
      >
      expect(zhMessages.welcome).toBe('æ¬¢è¿Ž')
      expect(zhMessages.customNode).toEqual({ title: 'è‡ªå®šä¹‰èŠ‚ç‚¹æ ‡é¢˜' })
    })

    it('should preserve custom node data when locale is loaded after merge', async () => {
      // Simulate the real scenario:
      // 1. Custom nodes i18n is loaded first
      mergeCustomNodesI18n({
        zh: {
          customNode: {
            title: 'è‡ªå®šä¹‰èŠ‚ç‚¹æ ‡é¢˜'
          },
          settingsCategories: {
            Hotkeys: 'å¿«æ·é”®'
          }
        }
      })

      // 2. Then locale is lazily loaded (this would previously overwrite custom data)
      await loadLocale('zh')

      // 3. Verify custom node data is still present
      const zhMessages = i18n.global.getLocaleMessage('zh') as Record<
        string,
        unknown
      >
      expect(zhMessages.customNode).toEqual({ title: 'è‡ªå®šä¹‰èŠ‚ç‚¹æ ‡é¢˜' })
      expect(zhMessages.settingsCategories).toEqual({ Hotkeys: 'å¿«æ·é”®' })

      // 4. Also verify base locale data is present
      expect(zhMessages.welcome).toBe('æ¬¢è¿Ž')
      expect(zhMessages.nodeDefs).toEqual({ testNode: 'æµ‹è¯•èŠ‚ç‚¹' })
    })

    it('should handle multiple locales in custom nodes i18n data', async () => {
      // Merge data for multiple locales
      mergeCustomNodesI18n({
        en: {
          customPlugin: { name: 'Easy Use' }
        },
        zh: {
          customPlugin: { name: 'ç®€å•ä½¿ç”¨' }
        }
      })

      // English should be merged immediately (pre-loaded)
      const enMessages = i18n.global.getLocaleMessage('en') as Record<
        string,
        unknown
      >
      expect(enMessages.customPlugin).toEqual({ name: 'Easy Use' })

      await loadLocale('zh')
      const zhMessages = i18n.global.getLocaleMessage('zh') as Record<
        string,
        unknown
      >
      expect(zhMessages.customPlugin).toEqual({ name: 'ç®€å•ä½¿ç”¨' })
    })

    it('should handle calling mergeCustomNodesI18n multiple times', async () => {
      // Use fresh module instance to ensure clean state
      vi.resetModules()
      await importI18nModule()

      mergeCustomNodesI18n({
        zh: { plugin1: { name: 'æ’ä»¶1' } }
      })

      mergeCustomNodesI18n({
        zh: { plugin2: { name: 'æ’ä»¶2' } }
      })

      await loadLocale('zh')

      const zhMessages = i18n.global.getLocaleMessage('zh') as Record<
        string,
        unknown
      >
      // Only the second call's data should be present
      expect(zhMessages.plugin2).toEqual({ name: 'æ’ä»¶2' })
      // First call's data is overwritten
      expect(zhMessages.plugin1).toBeUndefined()
    })
  })

  describe('loadLocale', () => {
    it('should not reload already loaded locale', async () => {
      await loadLocale('zh')
      await loadLocale('zh')
    })

    it('should load shipped BCP-47 variants', async () => {
      await loadLocale('zh-TW')
      expect(i18n.global.getLocaleMessage('zh-TW')).toEqual(
        expect.objectContaining({
          commands: expect.any(Object),
          nodeDefs: expect.any(Object),
          settings: expect.any(Object)
        })
      )
    })

    it('should handle concurrent load requests for same locale', async () => {
      const promises = [loadLocale('zh'), loadLocale('zh'), loadLocale('zh')]
      await Promise.all(promises)
    })
  })

  describe('setActiveLocale', () => {
    it('clamps unsupported input to en', async () => {
      expect(await setActiveLocale('it')).toBe('en')
      expect(i18n.global.locale.value).toBe('en')
    })

    it('resolves shipped variants and sets the active locale', async () => {
      expect(await setActiveLocale('pt-BR')).toBe('pt-BR')
      expect(i18n.global.locale.value).toBe('pt-BR')
      // pt is not shipped — pt-BR must not be promoted as a base match
      expect(await setActiveLocale('pt')).toBe('en')
    })

    it('resolves de directly and via BCP-47 fallback', async () => {
      expect(await setActiveLocale('de')).toBe('de')
      expect(i18n.global.locale.value).toBe('de')
      expect(await setActiveLocale('de-DE')).toBe('de')
    })

    it('honors prioritized navigator.languages', async () => {
      // First preference unshipped, second shipped — should land on French.
      expect(await setActiveLocale(['it-IT', 'fr-CA', 'en'])).toBe('fr')
    })
  })

  describe('te', () => {
    it('checks only the active locale, never the fallback locale', async () => {
      expect(te('enOnly')).toBe(true)

      await setActiveLocale('zh')
      expect(te('welcome')).toBe(true)
      expect(te('enOnly')).toBe(false)
    })
  })

  describe('resolveSupportedLocale', () => {
    it('returns the canonical tag when the input is shipped', () => {
      expect(resolveSupportedLocale('en')).toBe('en')
      expect(resolveSupportedLocale('ja')).toBe('ja')
      expect(resolveSupportedLocale('zh-TW')).toBe('zh-TW')
      expect(resolveSupportedLocale('pt-BR')).toBe('pt-BR')
      expect(resolveSupportedLocale('de')).toBe('de')
    })

    it('matches case-insensitively per BCP-47 and returns canonical casing', () => {
      // Older browsers / OS configs may emit lowercase region tags.
      expect(resolveSupportedLocale('pt-br')).toBe('pt-BR')
      expect(resolveSupportedLocale('PT-BR')).toBe('pt-BR')
      expect(resolveSupportedLocale('zh-tw')).toBe('zh-TW')
      expect(resolveSupportedLocale('ZH-TW')).toBe('zh-TW')
      expect(resolveSupportedLocale('EN')).toBe('en')
      expect(resolveSupportedLocale('DE')).toBe('de')
    })

    it('falls back to the base tag when the full tag is unshipped', () => {
      // it-IT → it (unshipped) → en
      expect(resolveSupportedLocale('it-IT')).toBe('en')
      // fr-CA → fr (shipped) → fr
      expect(resolveSupportedLocale('fr-CA')).toBe('fr')
      // ko-KR → ko (shipped) → ko
      expect(resolveSupportedLocale('ko-KR')).toBe('ko')
      // zh-CN → zh (shipped) → zh (Simplified is the base)
      expect(resolveSupportedLocale('zh-CN')).toBe('zh')
      // de-DE → de (shipped) → de
      expect(resolveSupportedLocale('de-DE')).toBe('de')
    })

    it('falls back to en for unsupported and missing inputs', () => {
      expect(resolveSupportedLocale('it')).toBe('en')
      expect(resolveSupportedLocale('nl')).toBe('en')
      expect(resolveSupportedLocale('xx-YY')).toBe('en')
      expect(resolveSupportedLocale('')).toBe('en')
      expect(resolveSupportedLocale(undefined)).toBe('en')
      expect(resolveSupportedLocale(null)).toBe('en')
    })

    it('walks a prioritized array per RFC 4647 lookup order', () => {
      // First shipped match wins (it unshipped → fr shipped → fr).
      expect(resolveSupportedLocale(['it-IT', 'fr-CA', 'en'])).toBe('fr')
      // Empty / all-unshipped arrays fall back to en.
      expect(resolveSupportedLocale([])).toBe('en')
      expect(resolveSupportedLocale(['it', 'nl'])).toBe('en')
      // German present in the array resolves immediately.
      expect(resolveSupportedLocale(['de-DE', 'it'])).toBe('de')
    })
  })
})
