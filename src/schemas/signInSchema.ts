import { createAuthSchemas } from '@comfyorg/auth-core/signInSchemas'

import { t } from '@/i18n'

export type { SignInData, SignUpData } from '@comfyorg/auth-core/signInSchemas'

export const {
  apiKeySchema,
  signInSchema,
  updatePasswordSchema,
  signUpSchema
} = createAuthSchemas(t)
