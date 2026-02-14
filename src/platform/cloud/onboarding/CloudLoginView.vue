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

      <template v-if="!showEmailForm">
        <p
          v-if="showFreeTierBadge"
          class="mb-4 text-center text-xs text-muted-foreground"
        >
          {{
            freeTierCredits
              ? t('auth.login.freeTierDescription', {
                  credits: freeTierCredits
                })
              : t('auth.login.freeTierDescriptionGeneric')
          }}
        </p>

        <!-- OAuth Buttons (primary) -->
        <div class="flex flex-col gap-4">
          <div class="relative">
            <Button type="button" class="h-10 w-full" @click="signInWithGoogle">
              <i class="pi pi-google mr-2"></i>
              {{ t('auth.login.loginWithGoogle') }}
            </Button>
            <span
              v-if="showFreeTierBadge"
              class="absolute -top-2.5 -right-2.5 rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-gray-900"
            >
              {{ t('auth.login.freeTierBadge') }}
            </span>
          </div>

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

        <div class="mt-6 text-center">
          <button
            class="cursor-pointer border-none bg-transparent text-sm text-muted-foreground underline hover:text-base-foreground"
            @click="onShowEmailForm"
          >
            {{ t('auth.login.useEmailInstead') }}
          </button>
        </div>
      </template>

      <template v-else>
        <Message severity="warn" class="mb-4">
          {{ t('auth.signup.emailNotEligibleForFreeTier') }}
        </Message>

        <CloudSignInForm :auth-error="authError" @submit="signInWithEmail" />

        <div class="mt-4 text-center">
          <button
            class="cursor-pointer border-none bg-transparent text-sm text-muted-foreground underline hover:text-base-foreground"
            @click="onBackToSocialLogin"
          >
            {{ t('auth.login.backToSocialLogin') }}
          </button>
        </div>
      </template>

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
import Message from 'primevue/message'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import Button from '@/components/ui/button/Button.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import CloudSignInForm from '@/platform/cloud/onboarding/components/CloudSignInForm.vue'
import { getSafePreviousFullPath } from '@/platform/cloud/onboarding/utils/previousFullPath'
import { isCloud } from '@/platform/distribution/types'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { SignInData } from '@/schemas/signInSchema'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authActions = useFirebaseAuthActions()
const isSecureContext = globalThis.isSecureContext
const authError = ref('')
const showEmailForm = ref(false)
const freeTierCredits = computed(() => remoteConfig.value.free_tier_credits)
const showFreeTierBadge = !localStorage.getItem('comfy:hasAccount')
const toastStore = useToastStore()
const telemetry = useTelemetry()

const onShowEmailForm = () => {
  showEmailForm.value = true
  telemetry?.trackUiButtonClicked({ button_id: 'login_use_email_instead' })
}

const onBackToSocialLogin = () => {
  showEmailForm.value = false
  telemetry?.trackUiButtonClicked({ button_id: 'login_back_to_social_login' })
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

onMounted(() => {
  if (isCloud) {
    telemetry?.trackLoginOpened({ free_tier_badge_shown: showFreeTierBadge })
  }
})
</script>
