import { createAuthSchemas } from '@comfyorg/account-core/signInSchemas'
import { computed } from 'vue'

import { t } from '@/i18n'
import { toTypedSchema } from '@/utils/zodTypedSchema'

export type {
  SignInData,
  SignUpData
} from '@comfyorg/account-core/signInSchemas'

const authSchemas = computed(() => createAuthSchemas(t))

export const apiKeySchema = toTypedSchema(() => authSchemas.value.apiKeySchema)
export const signInSchema = toTypedSchema(() => authSchemas.value.signInSchema)
export const updatePasswordSchema = toTypedSchema(
  () => authSchemas.value.updatePasswordSchema
)
export const signUpSchema = toTypedSchema(() => authSchemas.value.signUpSchema)
