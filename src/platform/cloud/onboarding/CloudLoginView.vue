<template>
  <div class="flex h-full items-center justify-center p-8">
    <div class="max-w-screen p-2 lg:w-96">
      <!-- Header -->
      <div class="mt-6 mb-8 flex flex-col gap-4">
        <h1 class="my-0 text-xl leading-normal font-medium">
          {{ t('auth.login.title') }}
        </h1>
        <p class="my-0 text-base">
          <span class="text-muted">{{ t('auth.login.newUser') }}</span>
          <span
            class="ml-1 cursor-pointer text-blue-500"
            @click="navigateToSignup"
            >{{ t('auth.login.signUp') }}</span
          >
        </p>
      </div>

      <Message v-if="!isSecureContext" severity="warn" class="mb-4">
        {{ t('auth.login.insecureContextWarning') }}
      </Message>

      <!-- Form -->
      <CloudSignInForm :auth-error="authError" @submit="signInWithEmail" />

      <!-- Divider -->
      <Divider align="center" layout="horizontal" class="my-8">
        <span class="text-muted">{{ t('auth.login.orContinueWith') }}</span>
      </Divider>

      <!-- Social Login Buttons -->
      <div class="flex flex-col gap-6">
        <Button
          type="button"
          class="h-10 bg-[#2d2e32]"
          variant="secondary"
          @click="signInWithGoogle"
        >
          <i class="pi pi-google mr-2"></i>
          {{ t('auth.login.loginWithGoogle') }}
        </Button>

        <Button
          type="button"
          class="h-10 bg-[#2d2e32]"
          variant="secondary"
          @click="signInWithGithub"
        >
          <i class="pi pi-github mr-2"></i>
          {{ t('auth.login.loginWithGithub') }}
        </Button>
      </div>

      <!-- Terms & Contact -->
      <p class="mt-5 text-sm text-gray-600">
        {{ t('auth.login.termsText') }}
        <a
          href="https://www.comfy.org/terms-of-service"
          target="_blank"
          class="cursor-pointer text-blue-400 no-underline"
        >
          {{ t('auth.login.termsLink') }}
        </a>
        {{ t('auth.login.andText') }}
        <a
          href="https://www.comfy.org/privacy-policy"
          target="_blank"
          class="cursor-pointer text-blue-400 no-underline"
        >
          {{ t('auth.login.privacyLink') }} </a
        >.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'
import Message from 'primevue/message'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import Button from '@/components/ui/button/Button.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import CloudSignInForm from '@/platform/cloud/onboarding/components/CloudSignInForm.vue'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { SignInData } from '@/schemas/signInSchema'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authActions = useFirebaseAuthActions()
const isSecureContext = window.isSecureContext
const authError = ref('')
const toastStore = useToastStore()

const navigateToSignup = () => {
  void router.push({ name: 'cloud-signup', query: route.query })
}

const onSuccess = async () => {
  toastStore.add({
    severity: 'success',
    summary: 'Login Completed',
    life: 2000
  })
  await router.push({ name: 'cloud-user-check', query: route.query })
}

const signInWithGoogle = async () => {
  authError.value = ''
  if (await authActions.signInWithGoogle()) {
    await onSuccess()
  }
}

const signInWithGithub = async () => {
  authError.value = ''
  if (await authActions.signInWithGithub()) {
    await onSuccess()
  }
}

const signInWithEmail = async (values: SignInData) => {
  authError.value = ''
  if (await authActions.signInWithEmail(values.email, values.password)) {
    await onSuccess()
  }
}
</script>
