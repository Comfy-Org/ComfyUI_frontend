<template>
  <form
    data-testid="update-password-dialog"
    class="flex w-96 flex-col gap-6"
    @submit.prevent="onSubmit"
  >
    <PasswordFields />

    <Button type="submit" class="mt-4 h-10 font-medium" :loading="loading">
      {{ $t('userSettings.updatePassword') }}
    </Button>
  </form>
</template>

<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { ref } from 'vue'

import PasswordFields from '@/components/dialog/content/signin/PasswordFields.vue'
import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { updatePasswordSchema } from '@/schemas/signInSchema'

const authActions = useAuthActions()
const loading = ref(false)

const { onSuccess } = defineProps<{
  onSuccess: () => void
}>()

const { handleSubmit } = useForm({
  validationSchema: toTypedSchema(updatePasswordSchema),
  initialValues: { password: '', confirmPassword: '' }
})

const onSubmit = handleSubmit(async ({ password }) => {
  loading.value = true
  try {
    await authActions.updatePassword(password)
    onSuccess()
  } finally {
    loading.value = false
  }
})
</script>
