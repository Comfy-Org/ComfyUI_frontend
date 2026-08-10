import { describe, expect, it } from 'vitest'
import type { SafeParseReturnType } from 'zod'

import {
  signInSchema,
  signUpSchema,
  updatePasswordSchema
} from '@/schemas/signInSchema'

const VALID_PASSWORD = 'Password1!'

const signUpValues = (overrides: Partial<Record<string, string>> = {}) => ({
  email: 'user@example.com',
  password: VALID_PASSWORD,
  confirmPassword: VALID_PASSWORD,
  ...overrides
})

/** The message a schema attached to `path`, or undefined if `path` passed. */
const errorAt = (
  result: SafeParseReturnType<unknown, unknown>,
  path: string
) =>
  result.success
    ? undefined
    : result.error.issues.find((issue) => issue.path[0] === path)?.message

describe('signInSchema', () => {
  it('accepts an email and any non-empty password', () => {
    // Sign-in deliberately does not apply the sign-up complexity rules: an
    // account created before those rules existed must still be able to log in.
    expect(
      signInSchema.safeParse({ email: 'a@b.co', password: 'x' }).success
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
  // 7/8 and 32/33 are the inclusive edges of the 8..32 rule. A regression that
  // slips the bound by one shows up here and nowhere else.
  it.for([
    ['7 chars is too short', 'Pas1!aa', false],
    ['8 chars is the minimum', 'Pass1!aa', true],
    ['32 chars is the maximum', `Pass1!${'a'.repeat(26)}`, true],
    ['33 chars is too long', `Pass1!${'a'.repeat(27)}`, false]
  ] as const)('%s', ([, password, expected]) => {
    const result = signUpSchema.safeParse(
      signUpValues({ password, confirmPassword: password })
    )

    expect(result.success).toBe(expected)
  })
})

describe('signUpSchema character classes', () => {
  // Each case is a password that satisfies every rule but the named one, so a
  // dropped regex fails exactly one of these instead of all four.
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
    // The refine must target confirmPassword: an error pinned to `password`
    // would render under the wrong input.
    expect(errorAt(result, 'confirmPassword')).toBeDefined()
    expect(errorAt(result, 'password')).toBeUndefined()
  })

  it('rejects an empty confirmPassword', () => {
    expect(
      signUpSchema.safeParse(signUpValues({ confirmPassword: '' })).success
    ).toBe(false)
  })
})

describe('updatePasswordSchema', () => {
  // Shares `passwordSchema` with sign-up, and refines separately. The password
  // reset flow is the one place these rules apply without an email field.
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
