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
    `async function loadDependency() {
  return import('./dependency')
}`,
    `import { vi } from 'vitest'
vi.mock('./dependency', async () => {
  const { ref } = await import('vue')
  return { dependency: ref(false) }
})`,
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
    },
    {
      code: `import { vi } from 'vitest'
vi.mock('./dependency', async () => {
  const original = await import('./dependency')
  return { ...original, dependency: vi.fn() }
})`,
      errors: [{ message: /Do not dynamically import/ }]
    },
    {
      code: `import { vi } from 'vitest'
vi.doMock('./dependency', async (importOriginal) => importOriginal())`,
      errors: [{ message: /Avoid importOriginal/ }]
    },
    {
      code: `import { vi } from 'vitest'
const factory = async (importOriginal: () => Promise<object>) => importOriginal()
vi.mock('./dependency', factory)`,
      errors: [{ message: /Avoid importOriginal/ }]
    },
    {
      code: `import { vi } from 'vitest'
async function factory() {
  const original = await import('./dependency')
  return { ...original, dependency: vi.fn() }
}
vi.mock('./dependency', factory)`,
      errors: [{ message: /Do not dynamically import/ }]
    },
    {
      code: `import { vi } from 'vitest'
vi.mock(\`./dependency\`, async () => {
  const original = await import(\`./dependency\`)
  return { ...original, dependency: vi.fn() }
})`,
      errors: [{ message: /Do not dynamically import/ }]
    }
  ]
})
