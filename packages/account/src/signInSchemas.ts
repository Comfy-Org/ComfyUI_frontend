import { z } from 'zod'

/**
 * The exact message keys the schemas emit, so a host wires every one of them
 * or the compiler says which is missing. Both hosts already carry these keys:
 * the app in `src/locales/en/main.json`, the website in its translations map.
 */
export type AuthSchemaMessageKey =
  | 'validation.prefix'
  | 'validation.length'
  | 'validation.invalidEmail'
  | 'validation.required'
  | 'validation.minLength'
  | 'validation.maxLength'
  | 'validation.password.uppercase'
  | 'validation.password.lowercase'
  | 'validation.password.number'
  | 'validation.password.special'
  | 'validation.password.match'

export type AuthSchemaTranslate = (
  key: AuthSchemaMessageKey,
  params?: Record<string, string | number>
) => string

/**
 * Builds the auth validation schemas with the host's own translator, so the
 * rules live once while each host keeps its i18n system. Messages resolve
 * eagerly at build time, so a locale switch requires rebuilding the schemas.
 */
export function createAuthSchemas(t: AuthSchemaTranslate) {
  const apiKeySchema = z.object({
    apiKey: z
      .string()
      .trim()
      .startsWith('comfyui-', t('validation.prefix', { prefix: 'comfyui-' }))
      .length(72, t('validation.length', { length: 72 }))
  })

  const signInSchema = z.object({
    email: z
      .string()
      .email(t('validation.invalidEmail'))
      .min(1, t('validation.required')),
    password: z.string().min(1, t('validation.required'))
  })

  const passwordSchema = z.object({
    password: z
      .string()
      .min(8, t('validation.minLength', { length: 8 }))
      .max(32, t('validation.maxLength', { length: 32 }))
      .regex(/[A-Z]/, t('validation.password.uppercase'))
      .regex(/[a-z]/, t('validation.password.lowercase'))
      .regex(/\d/, t('validation.password.number'))
      .regex(/[^A-Za-z0-9]/, t('validation.password.special')),
    confirmPassword: z.string().min(1, t('validation.required'))
  })

  const updatePasswordSchema = passwordSchema.refine(
    (data) => data.password === data.confirmPassword,
    {
      message: t('validation.password.match'),
      path: ['confirmPassword']
    }
  )

  const signUpSchema = passwordSchema
    .extend({
      email: z
        .string()
        .email(t('validation.invalidEmail'))
        .min(1, t('validation.required'))
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.password.match'),
      path: ['confirmPassword']
    })

  return { apiKeySchema, signInSchema, updatePasswordSchema, signUpSchema }
}

type AuthSchemas = ReturnType<typeof createAuthSchemas>

export type SignInData = z.infer<AuthSchemas['signInSchema']>
export type SignUpData = z.infer<AuthSchemas['signUpSchema']>
