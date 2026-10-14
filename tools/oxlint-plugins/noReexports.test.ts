import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'

import { noReexports } from './noReexports'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } }
}).run('no-reexports', noReexports, {
  valid: [
    {
      name: 'local declarations and re-exports of packages',
      code: `
import { a } from './a'
import { pkg } from '@comfyorg/shared-frontend-utils'
export const b = a
const c = 1
export { c, pkg }
export function d() {}
export default b
export type { Contract } from '@comfyorg/ingest-types'
export * from 'vue'
`
    }
  ],
  invalid: [
    {
      name: 'named, type, and namespace re-exports',
      code: `
export { a } from './a'
export type { T } from '@/types/t'
export * from '../all'
export * as ns from './ns'
`,
      errors: [
        { messageId: 'reexport' },
        { messageId: 'reexport' },
        { messageId: 'reexport' },
        { messageId: 'reexport' }
      ]
    },
    {
      name: 'an imported binding exported again, by name or as the default',
      code: `
import { a, b } from '@/lib/a'
import c from './c'
export { a, b as renamed }
export default c
`,
      errors: [
        { messageId: 'reexport' },
        { messageId: 'reexport' },
        { messageId: 'reexport' }
      ]
    }
  ]
})
