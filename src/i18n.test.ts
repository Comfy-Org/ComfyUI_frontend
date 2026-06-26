import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as I18nModule from './i18n'

let i18n: typeof I18nModule.i18n
let loadLocale: typeof I18nModule.loadLocale
let mergeCustomNodesI18n: typeof I18nModule.mergeCustomNodesI18n
let resolveSupportedLocale: typeof I18nModule.resolveSupportedLocale
let setActiveLocale: typeof I18nModule.setActiveLocale

async function importI18nModule() {
  const i18nModule = await import('./i18n')
  i18n = i18nModule.i18n
  loadLocale = i18nModule.loadLocale
  mergeCustomNodesI18n = i18nModule.mergeCustomNodesI18n
  resolveSupportedLocale = i18nModule.resolveSupportedLocale
  setActiveLocale = i18nModule.setActiveLocale
}

// Mock the JSON imports before importing i18n module
vi.mock('./locales/en/main.json', () => ({ default: { welcome: 'Welcome' } }))
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
vi.mock('./locales/zh/main.json', () => ({ default: { welcome: '欢迎' } }))
vi.mock('./locales/zh/nodeDefs.json', () => ({
  default: { testNode: '测试节点' }
}))
vi.mock('./locales/zh/commands.json', () => ({ default: { save: '保存' } }))
vi.mock('./locales/zh/settings.json', () => ({ default: { theme: '主题' } }))

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
            title: '自定义节点标题'
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
            title: '自定义节点标题'
          }
        }
      })

      await loadLocale('zh')

      // Verify both the base locale data and custom node data are present
      const zhMessages = i18n.global.getLocaleMessage('zh') as Record<
        string,
        unknown
      >
      expect(zhMessages.welcome).toBe('欢迎')
      expect(zhMessages.customNode).toEqual({ title: '自定义节点标题' })
    })

    it('should preserve custom node data when locale is loaded after merge', async () => {
      // Simulate the real scenario:
      // 1. Custom nodes i18n is loaded first
      mergeCustomNodesI18n({
        zh: {
          customNode: {
            title: '自定义节点标题'
          },
          settingsCategories: {
            Hotkeys: '快捷键'
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
      expect(zhMessages.customNode).toEqual({ title: '自定义节点标题' })
      expect(zhMessages.settingsCategories).toEqual({ Hotkeys: '快捷键' })

      // 4. Also verify base locale data is present
      expect(zhMessages.welcome).toBe('欢迎')
      expect(zhMessages.nodeDefs).toEqual({ testNode: '测试节点' })
    })

    it('should handle multiple locales in custom nodes i18n data', async () => {
      // Merge data for multiple locales
      mergeCustomNodesI18n({
        en: {
          customPlugin: { name: 'Easy Use' }
        },
        zh: {
          customPlugin: { name: '简单使用' }
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
      expect(zhMessages.customPlugin).toEqual({ name: '简单使用' })
    })

    it('should handle calling mergeCustomNodesI18n multiple times', async () => {
      // Use fresh module instance to ensure clean state
      vi.resetModules()
      await importI18nModule()

      mergeCustomNodesI18n({
        zh: { plugin1: { name: '插件1' } }
      })

      mergeCustomNodesI18n({
        zh: { plugin2: { name: '插件2' } }
      })

      await loadLocale('zh')

      const zhMessages = i18n.global.getLocaleMessage('zh') as Record<
        string,
        unknown
      >
      // Only the second call's data should be present
      expect(zhMessages.plugin2).toEqual({ name: '插件2' })
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
      expect(await setActiveLocale('de')).toBe('en')
      expect(i18n.global.locale.value).toBe('en')
    })

    it('resolves shipped variants and sets the active locale', async () => {
      expect(await setActiveLocale('pt-BR')).toBe('pt-BR')
      expect(i18n.global.locale.value).toBe('pt-BR')
      // pt is not shipped — pt-BR must not be promoted as a base match
      expect(await setActiveLocale('pt')).toBe('en')
    })

    it('honors prioritized navigator.languages', async () => {
      // First preference unsupported, second shipped — should land on French.
      expect(await setActiveLocale(['de-DE', 'fr-CA', 'en'])).toBe('fr')
    })
  })

  describe('resolveSupportedLocale', () => {
    it('returns the canonical tag when the input is shipped', () => {
      expect(resolveSupportedLocale('en')).toBe('en')
      expect(resolveSupportedLocale('ja')).toBe('ja')
      expect(resolveSupportedLocale('zh-TW')).toBe('zh-TW')
      expect(resolveSupportedLocale('pt-BR')).toBe('pt-BR')
    })

    it('matches case-insensitively per BCP-47 and returns canonical casing', () => {
      // Older browsers / OS configs may emit lowercase region tags.
      expect(resolveSupportedLocale('pt-br')).toBe('pt-BR')
      expect(resolveSupportedLocale('PT-BR')).toBe('pt-BR')
      expect(resolveSupportedLocale('zh-tw')).toBe('zh-TW')
      expect(resolveSupportedLocale('ZH-TW')).toBe('zh-TW')
      expect(resolveSupportedLocale('EN')).toBe('en')
    })

    it('falls back to the base tag when the full tag is unshipped', () => {
      // de-DE → de (unshipped) → en
      expect(resolveSupportedLocale('de-DE')).toBe('en')
      // fr-CA → fr (shipped) → fr
      expect(resolveSupportedLocale('fr-CA')).toBe('fr')
      // ko-KR → ko (shipped) → ko
      expect(resolveSupportedLocale('ko-KR')).toBe('ko')
      // zh-CN → zh (shipped) → zh (Simplified is the base)
      expect(resolveSupportedLocale('zh-CN')).toBe('zh')
    })

    it('falls back to en for unsupported and missing inputs', () => {
      expect(resolveSupportedLocale('de')).toBe('en')
      expect(resolveSupportedLocale('it')).toBe('en')
      expect(resolveSupportedLocale('nl')).toBe('en')
      expect(resolveSupportedLocale('xx-YY')).toBe('en')
      expect(resolveSupportedLocale('')).toBe('en')
      expect(resolveSupportedLocale(undefined)).toBe('en')
      expect(resolveSupportedLocale(null)).toBe('en')
    })

    it('walks a prioritized array per RFC 4647 lookup order', () => {
      // First shipped match wins (de unshipped → fr shipped → fr).
      expect(resolveSupportedLocale(['de-DE', 'fr-CA', 'en'])).toBe('fr')
      // Empty / all-unshipped arrays fall back to en.
      expect(resolveSupportedLocale([])).toBe('en')
      expect(resolveSupportedLocale(['de', 'it'])).toBe('en')
    })
  })
})
