<template>
  <Form
    class="flex flex-col gap-6 w-96"
    :resolver="zodResolver(updatePasswordSchema)"
    @submit="onSubmit"
  >
    <PasswordFields />

    <!-- Submit Button -->
    <Button
      type="submit"
      :label="$t('userSettings.updatePassword')"
      class="h-10 font-medium mt-4"
      :loading="loading"
    />
  </Form>
</template>

<script setup lang="ts">
import { Form, FormSubmitEvent } from '@primevue/forms'
import { zodResolver } from '@primevue/forms/resolvers/zod'
import Button from 'primevue/button'
import { ref } from 'vue'

import PasswordFields from '@/components/dialog/content/signin/PasswordFields.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { updatePasswordSchema } from '@/schemas/signInSchema'

const authActions = useFirebaseAuthActions()
const loading = ref(false)

const { onSuccess } = defineProps<{
  onSuccess: () => void
}>()

const onSubmit = async (event: FormSubmitEvent) => {
  if (event.valid) {
    loading.value = true
    try {
      await authActions.updatePassword(event.values.password)
      onSuccess()
    } finally {
      loading.value = false
    }
  }
}
</script>
