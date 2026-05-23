<template>
  <div
    class="flex size-full items-center justify-center px-4 py-8 sm:px-6 md:px-8 lg:py-12"
  >
    <div class="flex w-full max-w-md flex-col items-start">
      <div class="flex w-full flex-col gap-4">
        <h1
          class="my-0 font-inter text-xl/8 font-extrabold tracking-wide text-sand-500 sm:text-2xl/8"
        >
          {{ t('auth.signup.title') }}
        </h1>
        <p class="my-0 text-base/6 tracking-[-0.02em] text-sand-500">
          <span class="text-sand-500/70">{{
            t('auth.signup.alreadyHaveAccount')
          }}</span>
          <span
            class="ml-1 cursor-pointer text-azure-600"
            @click="navigateToLogin"
            >{{ t('auth.signup.signIn') }}</span
          >
        </p>
      </div>

      <Message v-if="!isSecureContext" severity="warn" class="mt-4 w-full">
        {{ t('auth.login.insecureContextWarning') }}
      </Message>

      <div class="flex w-full flex-col gap-4 pt-5 pb-2">
        <template v-if="!showEmailForm">
          <p v-if="isFreeTierEnabled" class="m-0 text-sm text-sand-500/70">
            {{
              freeTierCredits
                ? t('auth.login.freeTierDescription', {
                    credits: freeTierCredits
                  })
                : t('auth.login.freeTierDescriptionGeneric')
            }}
          </p>

          <div class="relative">
            <Button
              type="button"
              variant="secondary"
              class="relative h-10 w-full gap-4 rounded-md border border-solid border-smoke-800/9 bg-smoke-800/10 text-sm/4 font-medium text-sand-500 shadow-inset-highlight hover:bg-sand-300/20"
              @click="signInWithGoogle"
            >
              <i class="pi pi-google text-base" />
              {{ t('auth.signup.signUpWithGoogle') }}
            </Button>
            <span
              v-if="isFreeTierEnabled"
              class="absolute -top-2.5 -right-2.5 rounded-full bg-brand-yellow px-2 py-0.5 text-2xs font-bold whitespace-nowrap text-charcoal-750"
            >
              {{ t('auth.login.freeTierBadge') }}
            </span>
          </div>

          <Button
            type="button"
            variant="secondary"
            class="relative h-10 w-full gap-4 rounded-md border border-solid border-smoke-800/10 bg-smoke-800/10 font-inter text-sm/4 font-medium text-sand-500 shadow-inset-highlight hover:bg-sand-300/20"
            @click="signInWithGithub"
          >
            <i class="pi pi-github text-base" />
            {{ t('auth.signup.signUpWithGithub') }}
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
          <Message v-if="isFreeTierEnabled" severity="warn" class="w-full">
            {{ t('auth.signup.emailNotEligibleForFreeTier') }}
          </Message>

          <Message v-if="userIsInChina" severity="warn" class="w-full">
            {{ t('auth.signup.regionRestrictionChina') }}
          </Message>
          <SignUpForm
            v-else
            :auth-error="authError"
            @submit="signUpWithEmail"
          />

          <Button
            variant="secondary"
            class="mt-1 h-10 w-full rounded-md border-none bg-smoke-800/5 text-sm/5 font-normal tracking-[-0.011em] text-sand-500/55 hover:bg-sand-300/10"
            @click="switchToSocialLogin"
          >
            {{ t('auth.login.backToSocialLogin') }}
          </Button>
        </template>
      </div>

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
      <p
        class="mx-auto mt-2 mb-0 flex w-full max-w-10/12 flex-wrap items-center justify-center gap-x-1 text-center text-sm/5 tracking-[-0.011em] text-sand-500"
      >
        {{ t('cloudWaitlist_questionsText') }}
        <a
          href="https://support.comfy.org"
          class="cursor-pointer text-azure-600 no-underline"
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
import Message from 'primevue/message'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import SignUpForm from '@/components/dialog/content/signin/SignUpForm.vue'
import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useFreeTierOnboarding } from '@/platform/cloud/onboarding/composables/useFreeTierOnboarding'
import { getSafePreviousFullPath } from '@/platform/cloud/onboarding/utils/previousFullPath'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { SignUpData } from '@/schemas/signInSchema'
import { isInChina } from '@/utils/networkUtil'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authActions = useAuthActions()
const isSecureContext = globalThis.isSecureContext
const authError = ref('')
const userIsInChina = ref(false)
const toastStore = useToastStore()
const telemetry = useTelemetry()
const {
  showEmailForm,
  freeTierCredits,
  isFreeTierEnabled,
  switchToEmailForm,
  switchToSocialLogin
} = useFreeTierOnboarding()

const navigateToLogin = async () => {
  await router.push({ name: 'cloud-login', query: route.query })
}

const onSuccess = async () => {
  toastStore.add({
    severity: 'success',
    summary: 'Sign up Completed',
    life: 2000
  })

  const previousFullPath = getSafePreviousFullPath(route.query)
  if (previousFullPath) {
    await router.replace(previousFullPath)
    return
  }

  // Default redirect to the normal onboarding flow
  await router.push({ path: '/', query: route.query })
}

const signInWithGoogle = async () => {
  authError.value = ''
  if (await authActions.signInWithGoogle({ isNewUser: true })) {
    await onSuccess()
  }
}

const signInWithGithub = async () => {
  authError.value = ''
  if (await authActions.signInWithGithub({ isNewUser: true })) {
    await onSuccess()
  }
}

const signUpWithEmail = async (values: SignUpData) => {
  authError.value = ''
  if (await authActions.signUpWithEmail(values.email, values.password)) {
    await onSuccess()
  }
}

onMounted(async () => {
  // Track signup screen opened
  if (isCloud) {
    telemetry?.trackSignupOpened()
  }

  userIsInChina.value = await isInChina()
})
</script>
<style scoped>
:deep(.p-inputtext) {
  border: none !important;
  box-shadow: none !important;
  background: #2d2e32 !important;
}

:deep(.p-password input) {
  border: none !important;
  box-shadow: none !important;
}
:deep(.p-checkbox-checked .p-checkbox-box) {
  background-color: #f0ff41 !important;
  border-color: #f0ff41 !important;
}
</style>
