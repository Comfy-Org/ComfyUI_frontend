import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'

import { noDirectWebStorage } from './noDirectWebStorage'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } }
}).run('no-direct-web-storage', noDirectWebStorage, {
  valid: [
    {
      name: 'provider usage, shadowed names, and unrelated VueUse imports',
      code: `
import { safeLocalStorage } from '@/base/storage/safeStorage'
import { useSafeLocalStorage } from '@/platform/storage/useSafeStorage'
import { useDebounceFn } from '@vueuse/core'
import type { useStorage } from '@vueuse/core'
import { useStorage as other } from './local'
safeLocalStorage.getItem('a')
function read(localStorage: { getItem(k: string): string }) {
  return localStorage.getItem('a')
}
const options = { localStorage: true }
const { localStorage: enabled } = options
options.localStorage
const env = { sessionStorage: { getItem: (k: string) => k } }
env.sessionStorage.getItem('a')
function shadowed(window: { localStorage: string }) {
  return window.localStorage
}
function shadowedNamespace(V: { useStorage: () => void }) {
  const { useStorage } = V
  V.useStorage()
  return useStorage
}
import * as V from '@vueuse/core'
V.useDebounceFn(() => {})
export { useDebounceFn } from '@vueuse/core'
`
    }
  ],
  invalid: [
    {
      name: 'bare globals',
      code: `
localStorage.getItem('a')
sessionStorage.setItem('a', 'b')
const area = { storageArea: localStorage }
`,
      errors: [
        { messageId: 'global' },
        { messageId: 'global' },
        { messageId: 'global' }
      ]
    },
    {
      name: 'member access through window-like objects',
      code: `
window.localStorage.getItem('a')
globalThis.sessionStorage
self['localStorage']
`,
      errors: [
        { messageId: 'global' },
        { messageId: 'global' },
        { messageId: 'global' }
      ]
    },
    {
      name: 'destructuring storage off window-like objects',
      code: `
const { localStorage } = window
const { sessionStorage: session } = globalThis
`,
      errors: [{ messageId: 'global' }, { messageId: 'global' }]
    },
    {
      name: 'VueUse storage composables via namespace import and re-export',
      code: `
import * as V from '@vueuse/core'
V.useStorage('k', 1)
export { useLocalStorage } from '@vueuse/core'
const { useStorage: alias, useDebounceFn } = V
`,
      errors: [
        { messageId: 'composable' },
        { messageId: 'composable' },
        { messageId: 'composable' }
      ]
    },
    {
      name: 'VueUse storage composables',
      code: `
import { useLocalStorage, useSessionStorage, useStorage as us } from '@vueuse/core'
`,
      errors: [
        { messageId: 'composable' },
        { messageId: 'composable' },
        { messageId: 'composable' }
      ]
    }
  ]
})
