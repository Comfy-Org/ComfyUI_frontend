import { describe, expect, it } from 'vitest'

import { authSchemasFor } from './auth-schemas'

describe('authSchemasFor', () => {
  it('renders localized, parameterized messages through the site translator', () => {
    const result = authSchemasFor('en').signUpSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
      confirmPassword: 'short'
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.map((issue) => issue.message)).toContain(
      'Must be at least 8 characters'
    )
  })

  it('localizes for zh-CN', () => {
    const result = authSchemasFor('zh-CN').signInSchema.safeParse({
      email: 'nope',
      password: 'x'
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.message).toBe('无效的电子邮件地址')
  })
})
