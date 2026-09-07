import { describe, expect, it } from 'vitest'
import type { SafeParseReturnType } from 'zod'

import { createAuthSchemas } from './signInSchemas'

const { signInSchema, signUpSchema, updatePasswordSchema } = createAuthSchemas(
  (key) => key
)

const VALID_PASSWORD = 'Password1!'

const signUpValues = (overrides: Partial<Record<string, string>> = {}) => ({
  email: 'user@example.com',
  password: VALID_PASSWORD,
  confirmPassword: VALID_PASSWORD,
  ...overrides
})

const errorAt = (
  result: SafeParseReturnType<unknown, unknown>,
  path: string
) =>
  result.success
    ? undefined
    : result.error.issues.find((issue) => issue.path[0] === path)?.message

describe('signInSchema', () => {
  it('accepts an email and any non-empty password', () => {
    expect(
      signInSchema.safeParse({ email: 'a@b.co', password: 'x' }).success,
      'sign-in must not apply the sign-up complexity rules, or accounts created before those rules can never log in'
    ).toBe(true)
  })

  it.for([
    ['missing @', 'nope'],
    ['missing domain', 'user@'],
    ['empty', '']
  ])('rejects %s as an email', ([, email]) => {
    expect(
      signInSchema.safeParse({ email, password: VALID_PASSWORD }).success
    ).toBe(false)
  })

  it('rejects an empty password', () => {
    expect(
      signInSchema.safeParse({ email: 'a@b.co', password: '' }).success
    ).toBe(false)
  })
})

describe('signUpSchema password length boundaries', () => {
  it.for([
    ['7 chars is too short', 'Pas1!aa', false],
    ['8 chars is the minimum', 'Pass1!aa', true],
    ['32 chars is the maximum', `Pass1!${'a'.repeat(26)}`, true],
    ['33 chars is too long', `Pass1!${'a'.repeat(27)}`, false]
  ] as const)('%s', ([, password, expected]) => {
    const result = signUpSchema.safeParse(
      signUpValues({ password, confirmPassword: password })
    )

    expect(
      result.success,
      'these are the inclusive edges of the 8..32 rule, so a bound that slips by one shows up here and nowhere else'
    ).toBe(expected)
  })
})

describe('signUpSchema character classes', () => {
  it.for([
    ['uppercase', 'password1!'],
    ['lowercase', 'PASSWORD1!'],
    ['number', 'Password!!'],
    ['special', 'Password12']
  ])('requires at least one %s character', ([, password]) => {
    const result = signUpSchema.safeParse(
      signUpValues({ password, confirmPassword: password })
    )

    expect(result.success).toBe(false)
    expect(errorAt(result, 'password')).toBeDefined()
  })

  it('accepts a password satisfying all four classes', () => {
    expect(signUpSchema.safeParse(signUpValues()).success).toBe(true)
  })
})

describe('signUpSchema confirmPassword', () => {
  it('reports a mismatch against the confirmPassword field', () => {
    const result = signUpSchema.safeParse(
      signUpValues({ confirmPassword: 'Password2!' })
    )

    expect(result.success).toBe(false)
    expect(
      errorAt(result, 'confirmPassword'),
      'the refine must target confirmPassword, or the error renders under the wrong input'
    ).toBeDefined()
    expect(errorAt(result, 'password')).toBeUndefined()
  })

  it('rejects an empty confirmPassword', () => {
    expect(
      signUpSchema.safeParse(signUpValues({ confirmPassword: '' })).success
    ).toBe(false)
  })
})

describe('updatePasswordSchema', () => {
  it('accepts a valid matching pair', () => {
    expect(
      updatePasswordSchema.safeParse({
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD
      }).success
    ).toBe(true)
  })

  it('applies the same complexity rules as sign-up', () => {
    expect(
      updatePasswordSchema.safeParse({
        password: 'password',
        confirmPassword: 'password'
      }).success
    ).toBe(false)
  })

  it('reports a mismatch against the confirmPassword field', () => {
    const result = updatePasswordSchema.safeParse({
      password: VALID_PASSWORD,
      confirmPassword: 'Password2!'
    })

    expect(result.success).toBe(false)
    expect(errorAt(result, 'confirmPassword')).toBeDefined()
  })
})

describe('createAuthSchemas message wiring', () => {
  it('resolves messages through the injected translator with its params', () => {
    const seen: Array<[string, unknown]> = []
    const { signUpSchema: schema } = createAuthSchemas((key, params) => {
      seen.push([key, params])
      return `msg:${key}`
    })

    const result = schema.safeParse(
      signUpValues({ password: 'short', confirmPassword: 'short' })
    )

    expect(result.success).toBe(false)
    expect(
      seen.some(
        ([key, params]) =>
          key === 'validation.minLength' &&
          (params as Record<string, unknown>).length === 8
      ),
      'the 8-char minimum must reach the translator as a param, not be baked into copy'
    ).toBe(true)
    expect(
      result.success ? [] : result.error.issues.map((issue) => issue.message)
    ).toContain('msg:validation.minLength')
  })
})
