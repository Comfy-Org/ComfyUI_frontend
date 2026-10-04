import { beforeEach, describe, expect, it } from 'vitest'

import { i18n, t, te } from './i18n'

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
