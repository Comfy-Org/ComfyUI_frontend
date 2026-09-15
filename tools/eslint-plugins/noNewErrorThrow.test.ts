import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'

import { noNewErrorThrow } from './noNewErrorThrow'

const linter = new Linter()
const config = [
  {
    plugins: {
      comfy: { rules: { 'no-new-error-throw': noNewErrorThrow } }
    },
    rules: { 'comfy/no-new-error-throw': 'error' }
  }
] satisfies Linter.Config[]

describe('no-new-error-throw', () => {
  it('reports direct construction of the global Error', () => {
    expect(linter.verify("throw new Error('new')", config)).toEqual([
      expect.objectContaining({
        ruleId: 'comfy/no-new-error-throw',
        severity: 2
      })
    ])
  })

  it('allows other throwing contracts and shadowed Error', () => {
    const code = `
class DomainError extends Error {}
const ErrorAlias = Error
throw new TypeError('typed')
throw new DomainError('domain')
throw new ErrorAlias('alias')
try {} catch (error) { throw error }
{ class Error {}; throw new Error('shadowed') }
`

    expect(linter.verify(code, config)).toEqual([])
  })
})
