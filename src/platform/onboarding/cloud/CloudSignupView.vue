<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <BaseViewTemplate dark>
    <div class="flex items-center justify-center min-h-screen p-8">
      <div class="w-96 p-2">
        <!-- Header -->
        <div class="flex flex-col gap-4 mb-8">
          <h1 class="text-2xl font-medium leading-normal my-0">
            {{ t('auth.signup.title') }}
          </h1>
          <p class="text-base my-0">
            <span class="text-muted">{{
              t('auth.signup.alreadyHaveAccount')
            }}</span>
            <span
              class="ml-1 cursor-pointer text-blue-500"
              @click="navigateToLogin"
              >{{ t('auth.signup.signIn') }}</span
            >
          </p>
        </div>

        <Message v-if="!isSecureContext" severity="warn" class="mb-4">
          {{ t('auth.login.insecureContextWarning') }}
        </Message>

        <!-- Form -->
        <Message v-if="userIsInChina" severity="warn" class="mb-4">
          {{ t('auth.signup.regionRestrictionChina') }}
        </Message>
        <SignUpForm v-else :auth-error="authError" @submit="signUpWithEmail" />

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
            {{ t('auth.signup.signUpWithGoogle') }}
          </Button>

          <Button
            type="button"
            class="h-10"
            severity="secondary"
            outlined
            @click="signInWithGithub"
          >
            <i class="pi pi-github mr-2"></i>
            {{ t('auth.signup.signUpWithGithub') }}
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
import Divider from 'primevue/divider'
import Message from 'primevue/message'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { getMe } from '@/api/auth'
import SignUpForm from '@/components/dialog/content/signin/SignUpForm.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { SignUpData } from '@/schemas/signInSchema'
import { translateAuthError } from '@/utils/authErrorTranslation'
import { isInChina } from '@/utils/networkUtil'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authActions = useFirebaseAuthActions()
const isSecureContext = window.isSecureContext
const authError = ref('')
const userIsInChina = ref(false)

const navigateToLogin = () => {
  void router.push({ name: 'cloud-login', query: route.query })
}

const onSuccess = async () => {
  try {
    // Get user onboarding status (new users won't have survey/whitelist yet)
    const me = await getMe()

    // Navigate based on user status
    if (me && !me.surveyCompleted) {
      void router.push({ name: 'cloud-survey' })
    } else if (me && !me.whitelisted) {
      void router.push({ name: 'cloud-waitlist' })
    } else {
      // User is fully onboarded (rare for signup, but possible)
      void router.push({ path: '/' })
    }
  } catch (error) {
    console.error('Error checking user status:', error)
    // For new signups, default to survey
    void router.push({ name: 'cloud-survey' })
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

const signUpWithEmail = async (values: SignUpData) => {
  authError.value = ''
  if (
    await authActions.signUpWithEmail(
      values.email,
      values.password,
      inlineErrorHandler
    )()
  ) {
    await onSuccess()
  }
}

onMounted(async () => {
  userIsInChina.value = await isInChina()
})
</script>
