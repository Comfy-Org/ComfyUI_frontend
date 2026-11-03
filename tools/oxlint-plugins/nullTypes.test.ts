import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'

import { noNullType } from './nullTypes'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } }
}).run('no-null-type', noNullType, {
  valid: [
    'type Missing = string | undefined',
    'type Derived = Legacy["nullableField"]',
    'type Result = ReturnType<typeof legacyFunction>',
    'type Input = Parameters<typeof legacyFunction>[0]',
    'type Empty = typeof empty; const empty = null',
    'const missing = value === null || value == null',
    'const context = Object.create(null)',
    'new ContextMenu(["A", null, "B"])',
    'const preference: AgentRunMode = { credit_limit: null }'
  ],
  invalid: [
    'type Missing = string | null',
    'interface State { value: null }',
    'function read(value: string | null): void {}',
    'function read(): string | null { return null }',
    'const value = ref<string | null>(null)',
    'const value = input as string | null',
    'type Wrapped = Promise<Array<string | null>>',
    'type Filtered<T> = T extends null ? never : T'
  ].map((code) => ({ code, errors: [{ messageId: 'forbidden' }] }))
})
