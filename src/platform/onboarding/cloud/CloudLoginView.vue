<template>
  <div class="h-full flex items-center justify-center p-8">
    <div class="lg:w-96 max-w-[100vw] p-2">
      <template v-if="!hasInviteCode">
        <div class="bg-[#2d2e32] p-4 rounded-lg">
          <h4 class="m-0 pb-2 text-lg">
            {{ t('cloudPrivateBeta_title') }}
          </h4>
          <p class="m-0 text-base leading-6">
            {{ t('cloudPrivateBeta_desc') }}
          </p>
        </div>

        <!-- Header -->
        <div class="flex flex-col gap-4 mt-6 mb-8">
          <h1 class="text-xl font-medium leading-normal my-0">
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
      </template>

      <template v-else>
        <div class="flex flex-col gap-1 mt-6 mb-8">
          <h1
            class="text-white font-abcrom font-black italic uppercase my-0 text-2xl"
          >
            {{ t('cloudStart_invited') }}
          </h1>
          <p class="text-base my-0">
            <span class="text-muted">{{ t('cloudStart_invited_signin') }}</span>
          </p>
        </div>
      </template>

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
          severity="secondary"
          @click="signInWithGoogle"
        >
          <i class="pi pi-google mr-2"></i>
          {{ t('auth.login.loginWithGoogle') }}
        </Button>

        <Button
          type="button"
          class="h-10 bg-[#2d2e32]"
          severity="secondary"
          @click="signInWithGithub"
        >
          <i class="pi pi-github mr-2"></i>
          {{ t('auth.login.loginWithGithub') }}
        </Button>
      </div>

      <!-- Terms & Contact -->
      <p v-if="!hasInviteCode" class="mt-5 text-sm text-gray-600">
        {{ t('cloudWaitlist_questionsText') }}
        <a
          href="https://support.comfy.org"
          class="text-blue-400 no-underline cursor-pointer"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('cloudWaitlist_contactLink') }}</a
        >.
      </p>
      <p v-else class="mt-5 text-sm text-gray-600">
        {{ t('cloudStart_invited_signup_title') }}
        <span
          class="text-blue-400 no-underline cursor-pointer"
          @click="navigateToSignup"
        >
          {{ t('cloudStart_invited_signup_description') }}</span
        >
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import Message from 'primevue/message'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import CloudSignInForm from '@/platform/onboarding/cloud/components/CloudSignInForm.vue'
import { type SignInData } from '@/schemas/signInSchema'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { translateAuthError } from '@/utils/authErrorTranslation'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authActions = useFirebaseAuthActions()
const isSecureContext = window.isSecureContext
const authError = ref('')

const hasInviteCode = computed(() => !!route.query.inviteCode)

const navigateToSignup = () => {
  void router.push({ name: 'cloud-signup', query: route.query })
}

const onSuccess = async () => {
  // Check if there's an invite code
  const inviteCode = route.query.inviteCode as string | undefined
  const { isEmailVerified } = useFirebaseAuthStore()
  if (!isEmailVerified) {
    await router.push({ name: 'cloud-verify-email', query: { inviteCode } })
  } else {
    if (inviteCode) {
      // Handle invite code flow - go to invite check
      await router.push({
        name: 'cloud-invite-check',
        query: { inviteCode }
      })
    } else {
      // Normal login flow - go to user check
      await router.push({ name: 'cloud-user-check' })
    }
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

onMounted(async () => {
  await authActions.logout()
})
</script>
