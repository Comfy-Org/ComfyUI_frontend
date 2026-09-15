import { createAuthSchemas } from '@comfyorg/account/signInSchemas'

import { t } from '@/i18n'

export type { SignInData, SignUpData } from '@comfyorg/account/signInSchemas'

export const {
  apiKeySchema,
  signInSchema,
  updatePasswordSchema,
  signUpSchema
} = createAuthSchemas(t)
