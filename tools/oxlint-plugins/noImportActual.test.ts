import { fromAny } from '@total-typescript/shoehorn'
import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'

import { noImportActual } from './vitestCleanup'

type Rule = Parameters<RuleTester['run']>[1]

RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } }
})

ruleTester.run('no-import-actual', fromAny<Rule, unknown>(noImportActual), {
  valid: [
    `import { vi } from 'vitest'
vi.mock(import('./dependency'), () => ({ dependency: vi.fn() }))
vi.spyOn(dependency, 'method')`,
    `const vi = { importActual: () => undefined }
vi.importActual()`
  ],
  invalid: [
    {
      code: `import { vi } from 'vitest'
vi.mock(import('./dependency'), async (importOriginal) => importOriginal())`,
      errors: [{ message: /Avoid importOriginal/ }]
    },
    {
      code: `import { vi as vitest } from 'vitest'
vitest.importActual('./dependency')`,
      errors: [{ message: /vi\.importActual/ }]
    },
    {
      code: `import * as Vitest from 'vitest'
Vitest.vi.mock('./dependency', function (importOriginal) {
  return importOriginal()
})`,
      errors: [{ message: /Avoid importOriginal/ }]
    }
  ]
})
