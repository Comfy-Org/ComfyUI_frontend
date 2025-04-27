<template>
  <div class="w-96 p-2">
    <!-- Header -->
    <div class="flex flex-col gap-4 mb-8">
      <h1 class="text-2xl font-medium leading-normal my-0">
        {{ isSignIn ? t('auth.login.title') : t('auth.signup.title') }}
      </h1>
      <p class="text-base my-0">
        <span class="text-muted">{{
          isSignIn
            ? t('auth.login.newUser')
            : t('auth.signup.alreadyHaveAccount')
        }}</span>
        <span class="ml-1 cursor-pointer text-blue-500" @click="toggleState">{{
          isSignIn ? t('auth.login.signUp') : t('auth.signup.signIn')
        }}</span>
      </p>
    </div>

    <!-- Form -->
    <SignInForm v-if="isSignIn" @submit="signInWithEmail" />
    <SignUpForm v-else @submit="signInWithEmail" />

    <!-- Divider -->
    <Divider align="center" layout="horizontal" class="my-8">
      <span class="text-muted">{{ t('auth.login.orContinueWith') }}</span>
    </Divider>

    <!-- Social Login Buttons -->
    <div class="flex flex-col gap-6">
      <Button
        type="button"
        class="h-10"
        severity="secondary"
        outlined
        @click="signInWithGoogle"
      >
        <i class="pi pi-google mr-2"></i>
        {{
          isSignIn
            ? t('auth.login.loginWithGoogle')
            : t('auth.signup.signUpWithGoogle')
        }}
      </Button>

      <Button
        type="button"
        class="h-10"
        severity="secondary"
        outlined
        @click="signInWithGithub"
      >
        <i class="pi pi-github mr-2"></i>
        {{
          isSignIn
            ? t('auth.login.loginWithGithub')
            : t('auth.signup.signUpWithGithub')
        }}
      </Button>
    </div>
    <!-- Terms -->
    <p class="text-xs text-muted mt-8">
      {{ t('auth.login.termsText') }}
      <a
        href="https://www.comfy.org/terms-of-service"
        target="_blank"
        class="text-blue-500 cursor-pointer"
      >
        {{ t('auth.login.termsLink') }}
      </a>
      {{ t('auth.login.andText') }}
      <a
        href="https://www.comfy.org/privacy"
        target="_blank"
        class="text-blue-500 cursor-pointer"
      >
        {{ t('auth.login.privacyLink') }}
      </a>
      .
    </p>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { SignInData, SignUpData } from '@/schemas/signInSchema'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

import SignInForm from './signin/SignInForm.vue'
import SignUpForm from './signin/SignUpForm.vue'

const { t } = useI18n()

const { onSuccess } = defineProps<{
  onSuccess: () => void
}>()

const firebaseAuthStore = useFirebaseAuthStore()
const { wrapWithErrorHandlingAsync } = useErrorHandling()

const isSignIn = ref(true)
const toggleState = () => {
  isSignIn.value = !isSignIn.value
}

const signInWithGoogle = wrapWithErrorHandlingAsync(async () => {
  await firebaseAuthStore.loginWithGoogle()
  onSuccess()
})

const signInWithGithub = wrapWithErrorHandlingAsync(async () => {
  await firebaseAuthStore.loginWithGithub()
  onSuccess()
})

const signInWithEmail = wrapWithErrorHandlingAsync(
  async (values: SignInData | SignUpData) => {
    const { email, password } = values
    if (isSignIn.value) {
      await firebaseAuthStore.login(email, password)
    } else {
      await firebaseAuthStore.register(email, password)
    }
    onSuccess()
  }
)
</script>
