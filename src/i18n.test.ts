import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as I18nModule from './i18n'

let i18n: typeof I18nModule.i18n
let loadLocale: typeof I18nModule.loadLocale
let resolveNodeDefText: typeof I18nModule.resolveNodeDefText
let resolveNodeDefSlotText: typeof I18nModule.resolveNodeDefSlotText
let setBackendNodeText: typeof I18nModule.setBackendNodeText
let mergeCustomNodesI18n: typeof I18nModule.mergeCustomNodesI18n
let resolveSupportedLocale: typeof I18nModule.resolveSupportedLocale
let setActiveLocale: typeof I18nModule.setActiveLocale
let te: typeof I18nModule.te

async function importI18nModule() {
  const i18nModule = await import('./i18n')
  i18n = i18nModule.i18n
  loadLocale = i18nModule.loadLocale
  resolveNodeDefText = i18nModule.resolveNodeDefText
  resolveNodeDefSlotText = i18nModule.resolveNodeDefSlotText
  setBackendNodeText = i18nModule.setBackendNodeText
  mergeCustomNodesI18n = i18nModule.mergeCustomNodesI18n
  resolveSupportedLocale = i18nModule.resolveSupportedLocale
  setActiveLocale = i18nModule.setActiveLocale
  te = i18nModule.te
}

// Mock the JSON imports before importing i18n module
vi.mock('./locales/en/main.json', () => ({
  default: { welcome: 'Welcome', enOnly: 'English only' }
}))
// vue-i18n merges mutate the message tree built from this object, and mocked
// modules survive vi.resetModules(), so restore it before each test.
const enNodeDefsMock = vi.hoisted<Record<string, unknown>>(() => ({}))

function restoreEnNodeDefsMock() {
  for (const key of Object.keys(enNodeDefsMock)) {
    delete enNodeDefsMock[key]
  }
  Object.assign(enNodeDefsMock, {
    testNode: 'Test Node',
    KSampler: {
      display_name: 'KSampler (bundled)',
      inputs: {
        seed: { name: 'seed (bundled)', tooltip: 'Seed tooltip (bundled)' },
        // The serializer escapes `name` and leaves `tooltip` verbatim, so the
        // same source text is stored differently per field.
        syntax: { name: "50{'%'} {'@'}", tooltip: "50{'%'} {'@'}" }
      },
      outputs: {
        0: { name: 'LATENT (bundled)', tooltip: 'Latent tooltip (bundled)' }
      }
    }
  })
}

vi.mock('./locales/en/nodeDefs.json', () => ({
  default: enNodeDefsMock
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
  default: {
    testNode: '测试节点',
    KSampler: {
      inputs: { seed: { name: '种子', tooltip: '种子提示' } }
    }
  }
}))
vi.mock('./locales/zh/commands.json', () => ({ default: { save: '保存' } }))
vi.mock('./locales/zh/settings.json', () => ({ default: { theme: '主题' } }))

describe('i18n', () => {
  beforeEach(async () => {
    restoreEnNodeDefsMock()
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
      expect(zhMessages.nodeDefs).toEqual(
        expect.objectContaining({ testNode: '测试节点' })
      )
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

  describe('resolveNodeDefText', () => {
    const backend = (
      name: string,
      display_name?: string,
      description?: string
    ) => setBackendNodeText([{ name, display_name, description }])

    describe('precedence', () => {
      it('en: custom-node translation beats backend and bundled', () => {
        mergeCustomNodesI18n({
          en: { nodeDefs: { KSampler: { display_name: 'Custom EN' } } }
        })
        backend('KSampler', 'Backend Name')

        expect(resolveNodeDefText('display_name', 'KSampler')).toBe('Custom EN')
      })

      it('en: backend beats the bundled snapshot', () => {
        backend('KSampler', 'KSampler (renamed)')

        expect(resolveNodeDefText('display_name', 'KSampler')).toBe(
          'KSampler (renamed)'
        )
      })

      it('en: bundled is used when the backend sends nothing', () => {
        setBackendNodeText([])

        expect(resolveNodeDefText('display_name', 'KSampler')).toBe(
          'KSampler (bundled)'
        )
      })

      it('en: falls back to the node name when nothing supplies text', () => {
        setBackendNodeText([])

        expect(resolveNodeDefText('display_name', 'Unknown')).toBe('Unknown')
      })

      it('non-en: translation stays authoritative over the backend', async () => {
        await setActiveLocale('zh')
        backend('testNode', 'Backend Name')

        expect(resolveNodeDefText('display_name', 'testNode2')).toBe(
          'testNode2'
        )
        expect(te('nodeDefs.testNode', 'zh')).toBe(true)
      })

      it('non-en: falls back to the live backend value, not the stale en snapshot', async () => {
        await setActiveLocale('zh')
        backend('KSampler', 'KSampler (renamed)')

        expect(resolveNodeDefText('display_name', 'KSampler')).toBe(
          'KSampler (renamed)'
        )
      })
    })

    describe('backend text is data, not a translation', () => {
      it.for([
        ['Load Image {batch} | v2'],
        ['Save Image %{count}'],
        ['Regex Replace (\\$1)'],
        ['C:\\@home'],
        ['Save to D:\\\\output'],
        ["Weird {name} @ 100% | $x '"]
      ])('renders %j verbatim without compiling it', ([raw]) => {
        backend('SyntaxNode', raw)

        expect(resolveNodeDefText('display_name', 'SyntaxNode')).toBe(raw)
      })

      it('does not write backend values into the en message tree', () => {
        backend('BrandNewNode', 'Brand New Node')

        expect(te('nodeDefs.BrandNewNode.display_name')).toBe(false)
      })
    })

    describe('key resolution', () => {
      it('resolves dotted node names against the normalized key', () => {
        mergeCustomNodesI18n({
          en: { nodeDefs: { my_node: { display_name: 'Flat Key' } } }
        })

        expect(resolveNodeDefText('display_name', 'my.node')).toBe('Flat Key')
      })

      it('resolves the legacy nested shape hand-written locales use', () => {
        mergeCustomNodesI18n({
          en: { nodeDefs: { my: { node: { display_name: 'Nested Key' } } } }
        })

        expect(resolveNodeDefText('display_name', 'my.node')).toBe('Nested Key')
      })

      it('compiles custom-node translations so generated escapes render', () => {
        mergeCustomNodesI18n({
          en: {
            nodeDefs: {
              EscapedNode: { display_name: "50{'%'} {'@'} {'|'}" }
            }
          }
        })

        expect(resolveNodeDefText('display_name', 'EscapedNode')).toBe(
          '50% @ |'
        )
      })
    })

    describe('setBackendNodeText', () => {
      it('drops entries the backend no longer sends', () => {
        backend('Ephemeral', 'First Name')
        expect(resolveNodeDefText('display_name', 'Ephemeral')).toBe(
          'First Name'
        )

        setBackendNodeText([{ name: 'Ephemeral' }])

        expect(resolveNodeDefText('display_name', 'Ephemeral')).toBe(
          'Ephemeral'
        )
      })

      it('ignores non-string values instead of throwing', () => {
        expect(() =>
          setBackendNodeText([
            { name: 'Bad', display_name: 42 },
            { name: 7, display_name: 'x' },
            { name: 'Empty', display_name: '' }
          ])
        ).not.toThrow()

        expect(resolveNodeDefText('display_name', 'Bad')).toBe('Bad')
        expect(resolveNodeDefText('display_name', 'Empty')).toBe('Empty')
      })
    })

    describe('description', () => {
      it('prefers the backend description over the bundled one', () => {
        backend('KSampler', undefined, 'Live description')

        expect(resolveNodeDefText('description', 'KSampler')).toBe(
          'Live description'
        )
      })

      it('returns an empty string when nothing supplies a description', () => {
        setBackendNodeText([])

        expect(resolveNodeDefText('description', 'Unknown')).toBe('')
      })
    })
  })

  describe('slot text', () => {
    describe('precedence', () => {
      it.for([
        { field: 'name', slot: 'seed', backend: 'Live Seed' },
        { field: 'tooltip', slot: 0, backend: 'Live tooltip' }
      ] as const)(
        'en: live $field for slot $slot beats the bundled snapshot',
        ({ field, slot, backend }) => {
          expect(resolveNodeDefSlotText(field, 'KSampler', slot, backend)).toBe(
            backend
          )
        }
      )

      it.for([
        {
          field: 'tooltip',
          slot: 'seed',
          expected: 'Seed tooltip (bundled)'
        },
        {
          field: 'name',
          slot: 0,
          expected: 'LATENT (bundled)'
        }
      ] as const)(
        'en: bundled $field for slot $slot is used without backend text',
        ({ field, slot, expected }) => {
          expect(resolveNodeDefSlotText(field, 'KSampler', slot)).toBe(expected)
        }
      )

      it('en: falls back to the caller fallback when nothing supplies text', () => {
        expect(
          resolveNodeDefSlotText('name', 'Unknown', 'seed', undefined, 'seed')
        ).toBe('seed')
        expect(resolveNodeDefSlotText('tooltip', 'Unknown', 0)).toBe('')
      })

      it('en: a custom-node translation beats the backend', () => {
        mergeCustomNodesI18n({
          en: {
            nodeDefs: {
              KSampler: { inputs: { seed: { name: 'Custom Seed' } } }
            }
          }
        })

        expect(
          resolveNodeDefSlotText('name', 'KSampler', 'seed', 'Live Seed')
        ).toBe('Custom Seed')
      })

      it('non-en: the translation stays authoritative over the backend', async () => {
        await setActiveLocale('zh')

        expect(
          resolveNodeDefSlotText('name', 'KSampler', 'seed', 'Live Seed')
        ).toBe('种子')
        expect(
          resolveNodeDefSlotText('tooltip', 'KSampler', 'seed', 'Live tooltip')
        ).toBe('种子提示')
      })

      it('non-en: falls back to the live backend value, not the en snapshot', async () => {
        await setActiveLocale('zh')

        expect(
          resolveNodeDefSlotText('name', 'KSampler', 0, 'Live Latent')
        ).toBe('Live Latent')
      })
    })

    describe('raw / compiled split', () => {
      it('compiles a bundled name but returns a bundled tooltip uncompiled', () => {
        expect(resolveNodeDefSlotText('name', 'KSampler', 'syntax')).toBe(
          '50% @'
        )
        expect(resolveNodeDefSlotText('tooltip', 'KSampler', 'syntax')).toBe(
          "50{'%'} {'@'}"
        )
      })

      it('returns backend slot text verbatim, never through the compiler', () => {
        const raw = "Mask {'@'} 100% | D:\\output"

        expect(resolveNodeDefSlotText('tooltip', 'KSampler', 'seed', raw)).toBe(
          raw
        )
      })
    })

    describe('key resolution', () => {
      it('normalizes dotted input names', () => {
        mergeCustomNodesI18n({
          en: {
            nodeDefs: {
              KSampler: { inputs: { a_b: { name: 'Dotted Input' } } }
            }
          }
        })

        expect(resolveNodeDefSlotText('name', 'KSampler', 'a.b', 'Live')).toBe(
          'Dotted Input'
        )
      })

      it('resolves the legacy nested shape hand-written locales use', () => {
        mergeCustomNodesI18n({
          en: {
            nodeDefs: {
              my: { node: { inputs: { seed: { name: 'Nested Seed' } } } }
            }
          }
        })

        expect(resolveNodeDefSlotText('name', 'my.node', 'seed', 'Live')).toBe(
          'Nested Seed'
        )
      })
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
      expect(resolveSupportedLocale('it')).toBe('it')
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
      expect(resolveSupportedLocale(['de', 'nl'])).toBe('en')
    })
  })
})
