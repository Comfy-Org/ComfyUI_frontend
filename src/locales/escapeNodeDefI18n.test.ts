import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import { escapeVueI18nLinkedSyntax } from '@comfyorg/shared-frontend-utils/formatUtil'

/**
 * Node descriptions are compiled by vue-i18n via `t()`/`st()`. A literal `@` is
 * read as the start of a linked-message reference and makes the compiler throw
 * `Invalid linked format` (this crashed the whole app after the 1.47.7 locale
 * sync). `collect-i18n-node-defs.ts` escapes such values with
 * `escapeVueI18nLinkedSyntax` before writing them; this guards that the escaped
 * output actually compiles and renders the original literal text.
 */
describe('escapeVueI18nLinkedSyntax output is compiled safely by vue-i18n', () => {
  const compile = (message: string) => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: { value: message } }
    })
    return i18n.global.t('value')
  }

  it.for([
    'clips (tagged @Audio1-3 in the prompt)',
    'support@comfy.org',
    'no at sign here'
  ])('renders %s as the original literal text', (raw) => {
    expect(compile(escapeVueI18nLinkedSyntax(raw))).toBe(raw)
  })
})
