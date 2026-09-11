<template>
  <div class="flex w-full flex-col">
    <h1
      class="mt-8 mb-0 text-2xl/snug font-light tracking-tighter text-primary-comfy-canvas sm:text-3xl/snug lg:text-4xl/snug xl:text-5xl/snug 2xl:text-6xl/snug"
    >
      {{ t('cloudForgotPassword_title') }}
    </h1>

    <p
      class="mt-12 mb-0 text-base/snug font-medium text-primary-comfy-canvas xl:text-lg/snug"
    >
      {{ t('cloudForgotPassword_instructions') }}
    </p>

    <form
      class="mt-16 flex flex-col gap-4 xl:gap-6"
      @submit.prevent="handleSubmit"
    >
      <div class="flex flex-col gap-2">
        <label
          class="mb-1 text-base text-primary-comfy-canvas/70"
          for="reset-email"
        >
          {{ t('cloudForgotPassword_emailLabel') }}
        </label>
        <InputText
          id="reset-email"
          v-model="email"
          type="email"
          :placeholder="t('cloudForgotPassword_emailPlaceholder')"
          :class="CLOUD_AUTH_FIELD_CLASS"
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

      <Button
        type="submit"
        variant="brand-solid"
        size="brand"
        class="mt-2 w-full"
        :loading="loading"
        :disabled="!email || loading"
      >
        {{ t('cloudForgotPassword_sendResetLink') }}
      </Button>

      <button
        type="button"
        :class="CLOUD_AUTH_LINK_BUTTON_CLASS"
        @click="navigateToLogin"
      >
        {{ t('cloudForgotPassword_backToLogin') }}
      </button>
    </form>

    <p class="mt-5 mb-8 text-sm text-primary-comfy-canvas/70">
      {{ t('cloudForgotPassword_didntReceiveEmail') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import {
  CLOUD_AUTH_FIELD_CLASS,
  CLOUD_AUTH_LINK_BUTTON_CLASS
} from '@/platform/cloud/onboarding/constants/authClasses'

const { t } = useI18n()
const router = useRouter()
const authActions = useAuthActions()

const email = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

let redirectTimer: ReturnType<typeof setTimeout> | undefined

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

  // Resolves undefined on a handled failure; only true means the email was sent.
  const sent = await authActions.sendPasswordReset(email.value)
  loading.value = false

  if (!sent) {
    errorMessage.value = t('cloudForgotPassword_passwordResetError')
    return
  }

  successMessage.value = t('cloudForgotPassword_passwordResetSent')
  redirectTimer = setTimeout(navigateToLogin, 3000)
}

// A view unmounted inside the 3s window must not navigate after disposal.
onUnmounted(() => clearTimeout(redirectTimer))
</script>
