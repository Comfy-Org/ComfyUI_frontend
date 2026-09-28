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
import { useUpdatePassword } from '@/composables/auth/useUpdatePassword'
import { updatePasswordSchema } from '@/schemas/signInSchema'

const { requestSignIn, onSuccess } = defineProps<{
  requestSignIn: () => Promise<boolean>
  onSuccess: () => void
}>()

const updatePassword = useUpdatePassword(requestSignIn)
const loading = ref(false)

const { handleSubmit } = useForm({
  validationSchema: toTypedSchema(updatePasswordSchema),
  initialValues: { password: '', confirmPassword: '' }
})

const onSubmit = handleSubmit(async ({ password }) => {
  loading.value = true
  try {
    await updatePassword(password)
    onSuccess()
  } finally {
    loading.value = false
  }
})
</script>
