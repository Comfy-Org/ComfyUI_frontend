import { createAuthSchemas } from '@comfyorg/account-core/signInSchemas'

import { t } from '@/i18n'
import { toTypedSchema } from '@/utils/zodTypedSchema'

export type {
  SignInData,
  SignUpData
} from '@comfyorg/account-core/signInSchemas'

function authSchemas() {
  return createAuthSchemas(t)
}

export const apiKeySchema = toTypedSchema(() => authSchemas().apiKeySchema)
export const signInSchema = toTypedSchema(() => authSchemas().signInSchema)
export const updatePasswordSchema = toTypedSchema(
  () => authSchemas().updatePasswordSchema
)
export const signUpSchema = toTypedSchema(() => authSchemas().signUpSchema)
