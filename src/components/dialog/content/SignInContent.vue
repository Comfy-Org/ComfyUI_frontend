<template>
  <div class="w-96 p-2 overflow-x-hidden">
    <ApiKeyForm
      v-if="showApiKeyForm"
      @back="showApiKeyForm = false"
      @success="onSuccess"
    />
    <template v-else>
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
          <span
            class="ml-1 cursor-pointer text-blue-500"
            @click="toggleState"
            >{{
              isSignIn ? t('auth.login.signUp') : t('auth.signup.signIn')
            }}</span
          >
        </p>
      </div>

      <Message v-if="!isSecureContext" severity="warn" class="mb-4">
        {{ t('auth.login.insecureContextWarning') }}
      </Message>

      <!-- Form -->
      <SignInForm v-if="isSignIn" @submit="signInWithEmail" />
      <template v-else>
        <Message v-if="userIsInChina" severity="warn" class="mb-4">
          {{ t('auth.signup.regionRestrictionChina') }}
        </Message>
        <SignUpForm v-else @submit="signUpWithEmail" />
      </template>

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

        <Button
          type="button"
          class="h-10"
          severity="secondary"
          outlined
          @click="showApiKeyForm = true"
        >
          <img
            src="/assets/images/comfy-logo-mono.svg"
            class="w-5 h-5 mr-2"
            alt="Comfy"
          />
          {{ t('auth.login.useApiKey') }}
        </Button>
        <small class="text-muted text-center">
          {{ t('auth.apiKey.helpText') }}
          <a
            :href="`${COMFY_PLATFORM_BASE_URL}/login`"
            target="_blank"
            class="text-blue-500 cursor-pointer"
          >
            {{ t('auth.apiKey.generateKey') }}
          </a>
        </small>
        <Message
          v-if="authActions.accessError.value"
          severity="info"
          icon="pi pi-info-circle"
          variant="outlined"
          closable
        >
          {{ t('toastMessages.useApiKeyTip') }}
        </Message>
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
    </template>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import Message from 'primevue/message'
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { COMFY_PLATFORM_BASE_URL } from '@/config/comfyApi'
import { SignInData, SignUpData } from '@/schemas/signInSchema'
import { isInChina } from '@/utils/networkUtil'

import ApiKeyForm from './signin/ApiKeyForm.vue'
import SignInForm from './signin/SignInForm.vue'
import SignUpForm from './signin/SignUpForm.vue'

const { onSuccess } = defineProps<{
  onSuccess: () => void
}>()

const { t } = useI18n()
const authActions = useFirebaseAuthActions()
const isSecureContext = window.isSecureContext
const isSignIn = ref(true)
const showApiKeyForm = ref(false)

const toggleState = () => {
  isSignIn.value = !isSignIn.value
  showApiKeyForm.value = false
}

const signInWithGoogle = async () => {
  if (await authActions.signInWithGoogle()) {
    onSuccess()
  }
}

const signInWithGithub = async () => {
  if (await authActions.signInWithGithub()) {
    onSuccess()
  }
}

const signInWithEmail = async (values: SignInData) => {
  if (await authActions.signInWithEmail(values.email, values.password)) {
    onSuccess()
  }
}

const signUpWithEmail = async (values: SignUpData) => {
  if (await authActions.signUpWithEmail(values.email, values.password)) {
    onSuccess()
  }
}

const userIsInChina = ref(false)
onMounted(async () => {
  userIsInChina.value = await isInChina()
})

onUnmounted(() => {
  authActions.accessError.value = false
})
</script>
