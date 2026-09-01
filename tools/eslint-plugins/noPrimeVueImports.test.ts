import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { parser as tseslintParser } from 'typescript-eslint'

import { noPrimeVueImports } from './noPrimeVueImports'

const linter = new Linter()
const config = [
  {
    languageOptions: { parser: tseslintParser },
    plugins: {
      'primevue-removal': { rules: { 'no-imports': noPrimeVueImports } }
    },
    rules: { 'primevue-removal/no-imports': 'error' }
  }
] satisfies Linter.Config[]

describe('no-primevue-imports', () => {
  it('reports PrimeVue imports and re-exports', () => {
    const code = `
import 'primevue/button'
import type { PrimeVueConfiguration } from '@primevue/themes'
await import('primevue/config')
export { default } from '@primevue/forms'
export * from 'primevue'
`

    expect(linter.verify(code, config)).toEqual([
      expect.objectContaining({ ruleId: 'primevue-removal/no-imports' }),
      expect.objectContaining({ ruleId: 'primevue-removal/no-imports' }),
      expect.objectContaining({ ruleId: 'primevue-removal/no-imports' }),
      expect.objectContaining({ ruleId: 'primevue-removal/no-imports' }),
      expect.objectContaining({ ruleId: 'primevue-removal/no-imports' })
    ])
  })

  it('allows similar package names and non-literal dynamic imports', () => {
    const code = `
import 'primevue-extra'
import type { ZIndex } from '@primeuix/utils'
const moduleName = 'primevue/config'
await import(moduleName)
export * from '@primevuex/forms'
`

    expect(linter.verify(code, config)).toEqual([])
  })
})
