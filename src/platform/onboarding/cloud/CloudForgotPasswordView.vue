<template>
  <div class="h-full flex items-center justify-center p-8">
    <div class="w-96 p-2">
      <!-- Header -->
      <div class="flex flex-col gap-4 mb-8">
        <h1 class="text-xl font-medium leading-normal my-0">
          {{ t('cloudForgotPassword_title') }}
        </h1>
        <p class="text-base my-0 text-muted">
          {{ t('cloudForgotPassword_instructions') }}
        </p>
      </div>

      <!-- Form -->
      <form class="flex flex-col gap-6" @submit.prevent="handleSubmit">
        <div class="flex flex-col gap-2">
          <label
            class="opacity-80 text-base font-medium mb-2"
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
            :label="t('cloudForgotPassword_sendResetLink')"
            :loading="loading"
            :disabled="!email || loading"
            class="h-10 font-medium text-white"
          />

          <Button
            type="button"
            :label="t('cloudForgotPassword_backToLogin')"
            severity="secondary"
            class="h-10 bg-[#2d2e32]"
            @click="navigateToLogin"
          />
        </div>
      </form>

      <!-- Help text -->
      <p class="mt-5 text-sm text-gray-600">
        {{ t('cloudForgotPassword_didntReceiveEmail') }}
        <a
          href="https://support.comfy.org"
          class="text-blue-400 no-underline cursor-pointer"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('cloudWaitlist_contactLink') }}</a
        >.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'

const { t } = useI18n()
const router = useRouter()
const authActions = useFirebaseAuthActions()

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
  border: none !important;
  box-shadow: none !important;
  background: #2d2e32 !important;
}
</style>
