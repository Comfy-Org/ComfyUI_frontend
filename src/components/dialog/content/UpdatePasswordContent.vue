<template>
  <form
    data-testid="update-password-dialog"
    class="flex w-96 flex-col gap-6"
    @submit.prevent="onSubmit"
  >
    <PasswordFields
      v-model:password="values.password"
      v-model:confirm-password="values.confirmPassword"
      :password-error="errors.password"
      :confirm-password-error="errors.confirmPassword"
      @update:password="validatePassword"
      @update:confirm-password="validateConfirmPassword"
    />

    <!-- Submit Button -->
    <Button type="submit" class="mt-4 h-10 font-medium" :loading="loading">
      {{ $t('userSettings.updatePassword') }}
    </Button>
  </form>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'

import PasswordFields from '@/components/dialog/content/signin/PasswordFields.vue'
import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { updatePasswordSchema } from '@/schemas/signInSchema'
import type { SignUpData } from '@/schemas/signInSchema'
import { getZodFieldErrors } from '@/utils/zodFieldErrors'

const authActions = useAuthActions()
const loading = ref(false)
type UpdatePasswordData = Pick<SignUpData, 'password' | 'confirmPassword'>
const values = reactive<UpdatePasswordData>({
  password: '',
  confirmPassword: ''
})
const errors = reactive<Partial<Record<keyof UpdatePasswordData, string>>>({})

const { onSuccess } = defineProps<{
  onSuccess: () => void
}>()

function validateField(field: keyof UpdatePasswordData) {
  const result = updatePasswordSchema.safeParse(values)
  const message = result.success
    ? undefined
    : getZodFieldErrors(result.error)[field]

  if (message) errors[field] = message
  else delete errors[field]
}

function validatePassword() {
  validateField('password')
}

function validateConfirmPassword() {
  validateField('confirmPassword')
}

async function onSubmit() {
  const result = updatePasswordSchema.safeParse(values)
  if (!result.success) {
    Object.assign(errors, getZodFieldErrors(result.error))
    return
  }

  loading.value = true
  try {
    await authActions.updatePassword(result.data.password)
    onSuccess()
  } finally {
    loading.value = false
  }
}
</script>
