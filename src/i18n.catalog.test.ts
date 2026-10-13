import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import mainMessages from './locales/en/main.json' with { type: 'json' }

import { i18n, t, te } from './i18n'

type SignupBlockedMessages = { auth: { errors: { signupBlocked: string } } }

const localeCatalogs = Object.entries(
  import.meta.glob<SignupBlockedMessages>('./locales/*/main.json', {
    eager: true,
    import: 'default'
  })
).map(([path, messages]) => ({ locale: path.split('/')[2], messages }))

// Deliberately unmocked, unlike i18n.test.ts: these assertions are only
// meaningful against the real src/locales catalog.
// te() consults the active locale only, and these keys ship in en alone.
beforeEach(() => {
  i18n.global.locale.value = 'en'
})

describe('locale keys referenced from source', () => {
  it.for([
    ['g.selected'],
    ['toastMessages.extraResourcesUploadFailed'],
    ['assetBrowser.downloadFailed'],
    ['menuLabels.Paste with Connect']
  ])('%s resolves instead of echoing the key path', ([key]) => {
    expect(te(key)).toBe(true)
    expect(t(key)).not.toBe(key)
  })

  it('interpolates the asset name into assetBrowser.downloadFailed', () => {
    expect(
      t('assetBrowser.downloadFailed', { name: 'sd_xl_base.safetensors' })
    ).toContain('sd_xl_base.safetensors')
  })
})

// buildLocale overwrites these namespaces with the generated catalogs, while
// eslint.config.ts reads main.json and those catalogs as separate localeDir
// entries and unions them. A key here would therefore pass lint and resolve to
// nothing at runtime.
describe('main.json', () => {
  it.for([['commands'], ['nodeDefs'], ['settings']])(
    'leaves %s to the generated catalog',
    ([namespace]) => {
      expect(mainMessages).not.toHaveProperty(namespace)
    }
  )
})

describe('literal at signs in locale messages', () => {
  it.for(localeCatalogs)(
    '$locale renders the support email address',
    ({ locale, messages }) => {
      const catalog = createI18n({
        legacy: false,
        locale,
        fallbackLocale: false,
        messages: { [locale]: messages }
      }).global

      expect(catalog.t('auth.errors.signupBlocked')).toContain(
        'support@comfy.org'
      )
    }
  )
})
