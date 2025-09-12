<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <BaseViewTemplate dark>
    <div class="flex items-center justify-center min-h-screen p-8">
      <div class="w-96 p-2">
        <!-- Header -->
        <div class="flex flex-col gap-4 mb-8">
          <h1 class="text-2xl font-medium leading-normal my-0">
            {{ t('cloudOnboarding.forgotPassword.title') }}
          </h1>
          <p class="text-base my-0 text-muted">
            {{ t('cloudOnboarding.forgotPassword.instructions') }}
          </p>
        </div>

        <!-- Form -->
        <form class="flex flex-col gap-6" @submit.prevent="handleSubmit">
          <div class="flex flex-col gap-2">
            <label
              class="opacity-80 text-base font-medium mb-2"
              for="reset-email"
            >
              {{ t('cloudOnboarding.forgotPassword.emailLabel') }}
            </label>
            <InputText
              id="reset-email"
              v-model="email"
              type="email"
              :placeholder="
                t('cloudOnboarding.forgotPassword.emailPlaceholder')
              "
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
              :label="t('cloudOnboarding.forgotPassword.sendResetLink')"
              :loading="loading"
              :disabled="!email || loading"
              class="h-10 font-medium"
            />

            <Button
              type="button"
              :label="t('cloudOnboarding.forgotPassword.backToLogin')"
              severity="secondary"
              outlined
              class="h-10"
              @click="navigateToLogin"
            />
          </div>
        </form>

        <!-- Help text -->
        <p class="text-xs text-muted mt-8 text-center">
          {{ t('cloudOnboarding.forgotPassword.didntReceiveEmail') }}
          <a
            href="https://support.comfy.org"
            class="text-blue-500 cursor-pointer"
            target="_blank"
            rel="noopener noreferrer"
          >
            support.comfy.org
          </a>
        </p>
      </div>
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

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
    errorMessage.value = t('cloudOnboarding.forgotPassword.emailRequired')
    return
  }

  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // sendPasswordReset is already wrapped and returns a promise
    await authActions.sendPasswordReset(email.value)

    successMessage.value = t('cloudOnboarding.forgotPassword.passwordResetSent')

    // Optionally redirect to login after a delay
    setTimeout(() => {
      navigateToLogin()
    }, 3000)
  } catch (error) {
    console.error('Password reset error:', error)
    errorMessage.value = t('cloudOnboarding.forgotPassword.passwordResetError')
  } finally {
    loading.value = false
  }
}
</script>
