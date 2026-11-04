import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'

import { noNewErrorThrow } from './noNewErrorThrow'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester({
  languageOptions: {
    globals: { Error: 'readonly' },
    parserOptions: { lang: 'ts' }
  }
}).run('no-new-error-throw', noNewErrorThrow, {
  valid: [
    {
      name: 'other throwing contracts and a shadowed Error',
      code: `
class DomainError extends Error {}
const ErrorAlias = Error
throw new TypeError('typed')
throw new DomainError('domain')
throw new ErrorAlias('alias')
try {} catch (error) { throw error }
{ class Error {}; throw new Error('shadowed') }
`
    }
  ],
  invalid: [
    {
      name: 'direct construction of the global Error',
      code: `throw new Error('new')`,
      errors: [{ messageId: 'forbidden' }]
    }
  ]
})
