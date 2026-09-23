import { createAuthSchemas } from '@comfyorg/account-core/signInSchemas'

import { t } from '@/i18n'

export type {
  SignInData,
  SignUpData
} from '@comfyorg/account-core/signInSchemas'

export const {
  apiKeySchema,
  signInSchema,
  updatePasswordSchema,
  signUpSchema
} = createAuthSchemas(t)
