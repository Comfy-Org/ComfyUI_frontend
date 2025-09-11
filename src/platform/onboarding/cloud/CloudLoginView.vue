<template>
  <BaseViewTemplate dark>
    <div class="flex items-center justify-center min-h-screen p-8">
      <div class="w-96 p-2">
        <!-- Header -->
        <div class="flex flex-col gap-4 mb-8">
          <h1 class="text-2xl font-medium leading-normal my-0">
            {{ t('auth.login.title') }}
          </h1>
          <p class="text-base my-0">
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
            class="h-10"
            severity="secondary"
            outlined
            @click="signInWithGoogle"
          >
            <i class="pi pi-google mr-2"></i>
            {{ t('auth.login.loginWithGoogle') }}
          </Button>

          <Button
            type="button"
            class="h-10"
            severity="secondary"
            outlined
            @click="signInWithGithub"
          >
            <i class="pi pi-github mr-2"></i>
            {{ t('auth.login.loginWithGithub') }}
          </Button>
        </div>

        <!-- Terms & Contact -->
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
            {{ t('auth.login.privacyLink') }} </a
          >.
          {{ t('auth.login.questionsContactPrefix') }}
          <a href="mailto:hello@comfy.org" class="text-blue-500 cursor-pointer">
            hello@comfy.org</a
          >.
        </p>
      </div>
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import Message from 'primevue/message'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { getMe } from '@/api/me'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import CloudSignInForm from '@/platform/onboarding/cloud/components/CloudSignInForm.vue'
import { type SignInData } from '@/schemas/signInSchema'
import { translateAuthError } from '@/utils/authErrorTranslation'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authActions = useFirebaseAuthActions()
const isSecureContext = window.isSecureContext
const authError = ref('')

const navigateToSignup = () => {
  void router.push({ name: 'cloud-signup', query: route.query })
}

const onSuccess = async () => {
  try {
    // Get user onboarding status
    const me = await getMe()

    // Check if there's a redirect URL
    const redirectPath = route.query.redirect as string

    // Navigate based on user status
    if (!me.surveyTaken) {
      await router.push({ name: 'cloud-survey' })
    } else if (!me.whitelisted) {
      await router.push({ name: 'cloud-waitlist' })
    } else if (redirectPath) {
      // User is fully onboarded, go to redirect URL
      await router.push(redirectPath)
    } else {
      // User is fully onboarded, go to main app
      await router.push({ path: '/' })
    }
  } catch (error) {
    console.error('Error checking user status:', error)
    // On error, go to main app
    void router.push({ path: '/' })
  }
}

// Custom error handler for inline display
const inlineErrorHandler = (error: unknown) => {
  authError.value = translateAuthError(error)
  authActions.reportError(error)
}

const signInWithGoogle = async () => {
  authError.value = ''
  if (await authActions.signInWithGoogle(inlineErrorHandler)()) {
    await onSuccess()
  }
}

const signInWithGithub = async () => {
  authError.value = ''
  if (await authActions.signInWithGithub(inlineErrorHandler)()) {
    await onSuccess()
  }
}

const signInWithEmail = async (values: SignInData) => {
  authError.value = ''
  if (
    await authActions.signInWithEmail(
      values.email,
      values.password,
      inlineErrorHandler
    )()
  ) {
    await onSuccess()
  }
}
</script>
