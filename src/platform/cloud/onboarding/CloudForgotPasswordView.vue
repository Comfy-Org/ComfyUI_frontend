<template>
  <div class="flex h-full items-center justify-center p-8">
    <div class="max-w-[100vw] p-2 lg:w-96">
      <!-- Header -->
      <div class="mb-8 flex flex-col gap-4">
        <h1 class="my-0 text-xl/normal font-medium">
          {{ t('cloudForgotPassword_title') }}
        </h1>
        <p class="my-0 text-base text-primary-comfy-canvas/70">
          {{ t('cloudForgotPassword_instructions') }}
        </p>
      </div>

      <!-- Form -->
      <form class="flex flex-col gap-6" @submit.prevent="handleSubmit">
        <div class="flex flex-col gap-2">
          <label
            class="mb-2 text-base font-medium opacity-80"
            for="reset-email"
          >
            {{ t('cloudForgotPassword_emailLabel') }}
          </label>
          <InputText
            id="reset-email"
            v-model="email"
            type="email"
            :placeholder="t('cloudForgotPassword_emailPlaceholder')"
            class="h-10"
            :invalid="!!errorMessage && !email"
            autocomplete="email"
            required
          />
          <small v-if="errorMessage" class="text-red-500">
            {{ errorMessage }}
          </small>
        </div>

        <Message v-if="successMessage" severity="success">
          {{ successMessage }}
        </Message>

        <div class="flex flex-col gap-4">
          <Button
            type="submit"
            variant="secondary"
            :loading="loading"
            :disabled="!email || loading"
            class="h-10 border-none bg-primary-comfy-canvas/10 font-medium text-primary-comfy-canvas hover:bg-primary-comfy-canvas/15"
          >
            {{ t('cloudForgotPassword_sendResetLink') }}
          </Button>

          <Button
            type="button"
            variant="secondary"
            class="h-10 border border-solid border-primary-comfy-canvas/20 bg-transparent text-primary-comfy-canvas hover:bg-primary-comfy-canvas/5"
            @click="navigateToLogin"
          >
            {{ t('cloudForgotPassword_backToLogin') }}
          </Button>
        </div>
      </form>

      <!-- Help text -->
      <p class="mt-5 text-sm text-primary-comfy-canvas/60">
        {{ t('cloudForgotPassword_didntReceiveEmail') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'

const { t } = useI18n()
const router = useRouter()
const authActions = useAuthActions()

const email = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const navigateToLogin = () => {
  void router.push({ name: 'cloud-login' })
}

const handleSubmit = async () => {
  if (!email.value) {
    errorMessage.value = t('cloudForgotPassword_emailRequired')
    return
  }

  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // sendPasswordReset is already wrapped and returns a promise
    await authActions.sendPasswordReset(email.value)

    successMessage.value = t('cloudForgotPassword_passwordResetSent')

    // Optionally redirect to login after a delay
    setTimeout(() => {
      navigateToLogin()
    }, 3000)
  } catch (error) {
    console.error('Password reset error:', error)
    errorMessage.value = t('cloudForgotPassword_passwordResetError')
  } finally {
    loading.value = false
  }
}
</script>
<style scoped>
:deep(.p-inputtext) {
  border: 1px solid rgb(from var(--color-primary-comfy-canvas) r g b / 0.2) !important;
  box-shadow: none !important;
  background: transparent !important;
  color: var(--color-primary-comfy-canvas) !important;
  caret-color: var(--color-primary-comfy-canvas);
}

:deep(.p-inputtext::placeholder) {
  color: rgb(from var(--color-primary-comfy-canvas) r g b / 0.5);
}

:deep(.p-message-success) {
  background: rgb(from var(--color-jade-400) r g b / 0.12) !important;
  border-color: rgb(from var(--color-jade-400) r g b / 0.2) !important;
  color: var(--color-jade-400) !important;
}
</style>
