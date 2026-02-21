<template>
  <form class="flex w-96 flex-col gap-6" @submit="onSubmit">
    <PasswordFields />

    <!-- Submit Button -->
    <Button type="submit" class="mt-4 h-10 font-medium" :loading="loading">
      {{ $t('userSettings.updatePassword') }}
    </Button>
  </form>
</template>

<script setup lang="ts">
import { useForm } from 'vee-validate'
import { ref } from 'vue'

import PasswordFields from '@/components/dialog/content/signin/PasswordFields.vue'
import Button from '@/components/ui/button/Button.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { updatePasswordSchema } from '@/schemas/signInSchema'

const authActions = useFirebaseAuthActions()
const loading = ref(false)

const { onSuccess } = defineProps<{
  onSuccess: () => void
}>()

const { handleSubmit } = useForm({
  initialValues: {
    confirmPassword: '',
    password: ''
  },
  validationSchema: updatePasswordSchema
})

const onSubmit = handleSubmit(async (submittedValues) => {
  if (submittedValues.password) {
    loading.value = true
    try {
      await authActions.updatePassword(submittedValues.password)
      onSuccess()
    } finally {
      loading.value = false
    }
  }
})
</script>
