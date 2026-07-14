import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import { escapeVueI18nMessageSyntax } from '@comfyorg/shared-frontend-utils/formatUtil'

/**
 * Node descriptions are compiled by vue-i18n via `t()`/`st()`, which parses
 * `@ { } | %` as message syntax — a literal `@` even crashes the compiler with
 * `Invalid linked format` (this broke the whole app after the 1.47.7 locale
 * sync). `collect-i18n-node-defs.ts` escapes such values with
 * `escapeVueI18nMessageSyntax` before writing them; this guards that the escaped
 * output actually compiles and renders the original literal text.
 */
describe('escapeVueI18nMessageSyntax output is compiled safely by vue-i18n', () => {
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
    'resolution {width}x{height}',
    'foreground | background',
    '50%{done}',
    'all of @ { } | % together',
    'no special chars here'
  ])('renders %s as the original literal text', (raw) => {
    expect(compile(escapeVueI18nMessageSyntax(raw))).toBe(raw)
  })
})
