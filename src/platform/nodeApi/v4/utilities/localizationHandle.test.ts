import { describe, expect, it } from 'vitest'

import { i18n, loadLocale, t } from '@/i18n'
import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'

function localizationApi() {
  return createComfyApi({ getGraph: () => null }).comfy.localization
}

function messagesOf(locale: string): Record<string, unknown> {
  return i18n.global.getLocaleMessage(locale)
}

describe('registering a catalog', () => {
  it('adds its messages to a loaded locale, where the app translates with them', () => {
    localizationApi().registerCatalog('en', {
      messages: { MyPackA: { greeting: 'Hello from the pack' } }
    })

    expect(t('MyPackA.greeting')).toBe('Hello from the pack')
  })

  it('lets a later catalog replace a message and keeps the rest', () => {
    const localization = localizationApi()
    localization.registerCatalog('en', {
      messages: { MyPackB: { a: 'first', b: 'kept' } }
    })
    localization.registerCatalog('en', {
      messages: { MyPackB: { a: 'second' } }
    })

    expect(messagesOf('en').MyPackB).toEqual({ a: 'second', b: 'kept' })
  })

  it('keeps a catalog for a locale not loaded, and adds it when the locale loads', async () => {
    localizationApi().registerCatalog('fr', {
      messages: { MyPackC: { greeting: 'Bonjour' } }
    })

    expect(messagesOf('fr').MyPackC).toBeUndefined()
    await loadLocale('fr')

    expect(messagesOf('fr').MyPackC).toEqual({ greeting: 'Bonjour' })
  })

  it('adds a copy, so a change the pack makes later reaches nothing', async () => {
    const loaded = { MyPackD: { greeting: 'Hello' } }
    const waiting = { MyPackD: { greeting: 'Hallo' } }
    localizationApi().registerCatalog('en', { messages: loaded })
    localizationApi().registerCatalog('es', { messages: waiting })

    loaded.MyPackD.greeting = 'changed'
    waiting.MyPackD.greeting = 'changed'
    await loadLocale('es')

    expect(messagesOf('en').MyPackD).toEqual({ greeting: 'Hello' })
    expect(messagesOf('es').MyPackD).toEqual({ greeting: 'Hallo' })
  })

  it('takes null as a message, and objects with no prototype', () => {
    const group: Record<string, string | null> = Object.create(null)
    group.gone = null
    group.kept = 'kept'

    localizationApi().registerCatalog('en', { messages: { MyPackE: group } })

    expect(messagesOf('en').MyPackE).toEqual({ gone: null, kept: 'kept' })
  })

  it.for([
    {
      name: 'a locale the app does not ship',
      locale: 'xx',
      catalog: { messages: {} },
      needs: 'a locale the app ships (en, zh, zh-TW'
    },
    {
      name: 'a legacy locale id',
      locale: 'zh-CN',
      catalog: { messages: {} },
      needs: 'a locale the app ships'
    },
    {
      name: 'a locale that is not text',
      locale: 1,
      catalog: { messages: {} },
      needs: 'a locale the app ships'
    },
    {
      name: 'no catalog',
      locale: 'en',
      catalog: null,
      needs: 'a catalog'
    },
    {
      name: 'a catalog without messages',
      locale: 'en',
      catalog: {},
      needs: 'messages as an object of strings, null and nested objects'
    },
    {
      name: 'messages that are a list',
      locale: 'en',
      catalog: { messages: ['a'] },
      needs: 'messages as an object'
    },
    {
      name: 'a message that is a number',
      locale: 'en',
      catalog: { messages: { MyPackF: { count: 1 } } },
      needs: 'messages as an object'
    },
    {
      name: 'a message that is a function',
      locale: 'en',
      catalog: { messages: { MyPackF: { label: () => 'x' } } },
      needs: 'messages as an object'
    },
    {
      name: 'a group that is a list',
      locale: 'en',
      catalog: { messages: { MyPackF: ['a'] } },
      needs: 'messages as an object'
    }
  ])('refuses $name, and adds nothing', ({ locale, catalog, needs }) => {
    const localization = localizationApi()

    expect(() =>
      Reflect.apply(localization.registerCatalog, localization, [
        locale,
        catalog
      ])
    ).toThrow(
      expect.objectContaining({
        name: 'TypeError',
        message: expect.stringContaining(
          `localization.registerCatalog needs ${needs}`
        )
      })
    )
    expect(messagesOf('en').MyPackF).toBeUndefined()
  })

  it('refuses messages that hold themselves', () => {
    const group: Record<string, unknown> = { name: 'loop' }
    group.again = group

    const localization = localizationApi()

    expect(() =>
      Reflect.apply(localization.registerCatalog, localization, [
        'en',
        { messages: { MyPackG: group } }
      ])
    ).toThrow(TypeError)
    expect(messagesOf('en').MyPackG).toBeUndefined()
  })

  it('takes one group under two keys, which is not a loop', () => {
    const shared = { label: 'Shared' }

    localizationApi().registerCatalog('en', {
      messages: { MyPackH: { first: shared, second: shared } }
    })

    expect(messagesOf('en').MyPackH).toEqual({ first: shared, second: shared })
  })
})
