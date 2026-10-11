import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { toTypedSchema } from '@/utils/zodTypedSchema'

describe('toTypedSchema', () => {
  it('returns the parsed output and no errors for valid input', async () => {
    const schema = toTypedSchema(z.object({ apiKey: z.string().trim() }))

    await expect(schema.parse({ apiKey: '  key  ' })).resolves.toEqual({
      value: { apiKey: 'key' },
      errors: []
    })
  })

  it.for([
    {
      name: 'groups messages by field',
      schema: z.object({
        password: z.string().min(8, 'too short').regex(/\d/, 'needs a digit')
      }),
      input: { password: 'abc' },
      errors: [{ path: 'password', errors: ['too short', 'needs a digit'] }]
    },
    {
      name: 'joins nested keys with dots and indexes with brackets',
      schema: z.object({
        users: z.array(z.object({ email: z.email('bad email') }))
      }),
      input: { users: [{ email: 'a@b.co' }, { email: 'nope' }] },
      errors: [{ path: 'users[1].email', errors: ['bad email'] }]
    },
    {
      name: 'reports refinements at their declared path',
      schema: z
        .object({ password: z.string(), confirmPassword: z.string() })
        .refine((data) => data.password === data.confirmPassword, {
          message: 'must match',
          path: ['confirmPassword']
        }),
      input: { password: 'a', confirmPassword: 'b' },
      errors: [{ path: 'confirmPassword', errors: ['must match'] }]
    },
    {
      name: 'flattens union branch issues under the union path',
      schema: z.object({
        contact: z.union([
          z.object({ email: z.email('bad email') }),
          z.object({ phone: z.string().min(3, 'bad phone') })
        ])
      }),
      input: { contact: { email: 'nope', phone: '1' } },
      errors: [
        { path: 'contact.email', errors: ['bad email'] },
        { path: 'contact.phone', errors: ['bad phone'] },
        { path: 'contact', errors: ['Invalid input'] }
      ]
    },
    {
      name: 'drops the root union message when branch issues explain it',
      schema: z.union([
        z.object({ email: z.email('bad email') }),
        z.object({ phone: z.string().min(3, 'bad phone') })
      ]),
      input: { email: 'nope', phone: '1' },
      errors: [
        { path: 'email', errors: ['bad email'] },
        { path: 'phone', errors: ['bad phone'] }
      ]
    }
  ])('$name', async ({ schema, input, errors }) => {
    await expect(toTypedSchema(schema).parse(input)).resolves.toEqual({
      errors
    })
  })
})
