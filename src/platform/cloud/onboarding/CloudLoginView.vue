<template>
  <div
    class="flex size-full items-center justify-center px-4 py-8 sm:px-6 md:px-8 lg:py-12"
  >
    <div class="flex w-full max-w-md flex-col items-start">
      <!-- Heading group: gap-4 (16px) -->
      <div class="flex w-full flex-col gap-4">
        <h1
          class="my-0 font-inter text-xl/8 font-extrabold tracking-wide text-sand-500 sm:text-2xl/8"
        >
          {{ t('auth.login.title') }}
        </h1>
        <i18n-t
          v-if="isFreeTierEnabled"
          keypath="auth.login.signUpFreeTierPromo"
          tag="p"
          class="my-0 text-sm/6 tracking-[-0.02em] text-sand-500 sm:text-base/6"
          :plural="freeTierCredits ?? undefined"
        >
          <template #signUp>
            <span
              class="cursor-pointer text-azure-600"
              @click="navigateToSignup"
              >{{ t('auth.login.signUp') }}</span
            >
          </template>
          <template #credits>{{ freeTierCredits }}</template>
        </i18n-t>
        <p v-else class="my-0 text-base/6 tracking-[-0.02em] text-sand-500">
          {{ t('auth.login.newUser') }}
          <span
            class="cursor-pointer text-azure-600"
            @click="navigateToSignup"
            >{{ t('auth.login.signUp') }}</span
          >
        </p>
      </div>

      <Message v-if="!isSecureContext" severity="warn" class="mt-4 w-full">
        {{ t('auth.login.insecureContextWarning') }}
      </Message>

      <!-- Buttons section: py-2, gap-4 between buttons -->
      <div class="flex w-full flex-col gap-4 pt-5 pb-2">
        <template v-if="!showEmailForm">
          <Button
            type="button"
            variant="secondary"
            class="relative h-10 w-full gap-4 rounded-md border border-solid border-smoke-800/9 bg-smoke-800/10 text-sm/4 font-medium text-sand-500 shadow-inset-highlight hover:bg-sand-300/20"
            @click="signInWithGoogle"
          >
            <i class="pi pi-google text-base" />
            {{ t('auth.login.loginWithGoogle') }}
          </Button>

          <Button
            type="button"
            variant="secondary"
            class="relative h-10 w-full gap-4 rounded-md border border-solid border-smoke-800/10 bg-smoke-800/10 font-inter text-sm/4 font-medium text-sand-500 shadow-inset-highlight hover:bg-sand-300/20"
            @click="signInWithGithub"
          >
            <i class="pi pi-github text-base" />
            {{ t('auth.login.loginWithGithub') }}
          </Button>

          <Button
            variant="secondary"
            class="mt-1 h-10 w-full rounded-md border-none bg-smoke-800/5 text-sm/5 font-normal tracking-[-0.011em] text-sand-500/55 hover:bg-sand-300/10"
            @click="switchToEmailForm"
          >
            {{ t('auth.login.useEmailInstead') }}
          </Button>
        </template>

        <template v-else>
          <CloudSignInForm :auth-error="authError" @submit="signInWithEmail" />

          <Button
            variant="secondary"
            class="mt-1 h-10 w-full rounded-md border-none bg-smoke-800/5 text-sm/5 font-normal tracking-[-0.011em] text-sand-500/55 hover:bg-sand-300/10"
            @click="switchToSocialLogin"
          >
            {{ t('auth.login.backToSocialLogin') }}
          </Button>
        </template>
      </div>

      <!-- Terms: py-[17px], text-sm/20, tracking -0.011em -->
      <p
        class="mx-auto my-0 flex w-full max-w-10/12 flex-wrap items-center justify-center gap-x-1 py-[17px] text-center text-sm/5 tracking-[-0.011em] text-sand-500"
      >
        {{ t('auth.login.termsText') }}
        <a
          href="https://www.comfy.org/terms-of-service"
          target="_blank"
          class="cursor-pointer text-azure-600 no-underline"
        >
          {{ t('auth.login.termsLink') }}
        </a>
        {{ t('auth.login.andText') }}
        <a
          href="https://www.comfy.org/privacy-policy"
          target="_blank"
          class="cursor-pointer text-azure-600 no-underline"
        >
          {{ t('auth.login.privacyLink') }} </a
        >.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import Message from 'primevue/message'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import CloudSignInForm from '@/platform/cloud/onboarding/components/CloudSignInForm.vue'
import { useFreeTierOnboarding } from '@/platform/cloud/onboarding/composables/useFreeTierOnboarding'
import { getSafePreviousFullPath } from '@/platform/cloud/onboarding/utils/previousFullPath'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { SignInData } from '@/schemas/signInSchema'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authActions = useAuthActions()
const isSecureContext = globalThis.isSecureContext
const authError = ref('')
const toastStore = useToastStore()
const showEmailForm = ref(false)
const { isFreeTierEnabled, freeTierCredits } = useFreeTierOnboarding()

function switchToEmailForm() {
  showEmailForm.value = true
}

function switchToSocialLogin() {
  showEmailForm.value = false
}

const navigateToSignup = async () => {
  await router.push({ name: 'cloud-signup', query: route.query })
}

const onSuccess = async () => {
  toastStore.add({
    severity: 'success',
    summary: 'Login Completed',
    life: 2000
  })

  const previousFullPath = getSafePreviousFullPath(route.query)
  if (previousFullPath) {
    await router.replace(previousFullPath)
    return
  }

  await router.push({ name: 'cloud-user-check' })
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
