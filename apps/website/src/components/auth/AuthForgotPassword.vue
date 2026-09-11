<script setup lang="ts">
import {
  AUTH_TOAST_SUMMARIES,
  classifyAuthError,
  isFirebaseAuthErrorLike,
  severityForAuthError
} from '@comfyorg/account/firebaseAuthError'
import { cn } from '@comfyorg/tailwind-utils'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { authSchemasFor } from '../../config/auth-schemas'
import { signInErrorMessage } from '../../config/auth-sign-in-state'
import { addToast } from '../../config/auth-toast-state'
import { requestedReturnPath } from '../../config/workshop-return'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import {
  captureAuthFailed,
  useWorkshopAuthFlag,
  useWorkshopAuthFlagSettled
} from '../../scripts/posthog'
import AuthFlagTimeout from './AuthFlagTimeout.vue'
import AuthSpinnerIcon from './AuthSpinnerIcon.vue'
import {
  AUTH_BRAND_SOLID_BUTTON_CLASS,
  AUTH_FIELD_CLASS,
  AUTH_LINK_BUTTON_CLASS,
  AUTH_MESSAGE_SUCCESS_CLASS
} from './authClasses'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

/** The cloud page returns to login this long after a send. */
const RETURN_TO_LOGIN_MS = 3000
const TOAST_LIFE_MS = 5000
/** The cloud app's router gives auth this long to answer before its timeout view. */
const AUTH_FLAG_TIMEOUT_MS = 16_000

const enabled = useWorkshopAuthFlag()
const flagSettled = useWorkshopAuthFlagSettled()
const flagTimedOut = ref(false)
const email = ref('')
const errorMessage = ref('')
const hostname = typeof window === 'undefined' ? '' : window.location.hostname
const loadWorkshopFirebase = () => import('../../config/workshop-firebase')

type ResetState = 'idle' | 'sending' | 'sent' | 'error'
const state = ref<ResetState>('idle')
const signInHref = ref('/login/')
let returnTimer: ReturnType<typeof setTimeout> | undefined
let flagTimer: ReturnType<typeof setTimeout> | undefined

function signInDestination(): string {
  const destination = requestedReturnPath(window.location.search)
  return destination
    ? `/login/?returnTo=${encodeURIComponent(destination)}`
    : '/login/'
}

/**
 * The return destination is only known in the browser, and hydration never
 * repairs a server-rendered href, so the link stays plain in markup and the
 * destination is carried over when the visitor actually clicks.
 */
function goToSignIn(event: MouseEvent): void {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
    return
  event.preventDefault()
  window.location.assign(signInDestination())
}

async function submit() {
  if (state.value === 'sending' || state.value === 'sent') return
  const parsed = authSchemasFor(locale).signInSchema.shape.email.safeParse(
    email.value
  )
  if (!parsed.success) {
    errorMessage.value = parsed.error.issues[0]?.message ?? ''
    return
  }
  errorMessage.value = ''
  state.value = 'sending'
  const firebase = await loadWorkshopFirebase().catch(() => undefined)
  if (!firebase) {
    state.value = 'error'
    errorMessage.value = t('auth.forgot.error', locale)
    return
  }
  // An unknown email already resolves as sent (the package keeps that
  // neutral); anything that rejects here is a delivery failure the visitor
  // can retry, so it stays an error.
  try {
    await firebase.sendWorkshopPasswordReset(email.value)
  } catch (error) {
    reportSendFailure(error)
    return
  }
  reportSent()
}

function reportSendFailure(error: unknown) {
  state.value = 'error'
  captureAuthFailed({
    error_code: isFirebaseAuthErrorLike(error) ? error.code : 'unknown',
    auth_action: 'password_reset'
  })
  const classification = classifyAuthError(error)
  const severity = severityForAuthError(classification)
  addToast({
    severity,
    summary: AUTH_TOAST_SUMMARIES[locale][severity],
    detail: signInErrorMessage(classification, locale, hostname)
  })
}

function reportSent() {
  state.value = 'sent'
  addToast({
    severity: 'success',
    summary: t('auth.forgot.toastSummary', locale),
    detail: t('auth.forgot.toastDetail', locale),
    life: TOAST_LIFE_MS
  })
  returnTimer = setTimeout(() => {
    window.location.assign(signInDestination())
  }, RETURN_TO_LOGIN_MS)
}

onMounted(() => {
  signInHref.value = signInDestination()
  if (flagSettled.value) return
  flagTimer = setTimeout(() => {
    flagTimedOut.value = !flagSettled.value
  }, AUTH_FLAG_TIMEOUT_MS)
})

// A late answer, whichever way it goes, ends the timeout screen.
watch(flagSettled, (settled) => {
  if (settled) flagTimedOut.value = false
})

onBeforeUnmount(() => {
  clearTimeout(returnTimer)
  clearTimeout(flagTimer)
})
</script>

<template>
  <section
    v-if="enabled"
    class="flex w-full flex-col"
    :aria-busy="state === 'sending'"
  >
    <h1
      class="mt-8 mb-0 text-2xl/snug font-light tracking-tighter text-primary-comfy-canvas sm:text-3xl/snug lg:text-4xl/snug xl:text-5xl/snug 2xl:text-6xl/snug"
    >
      {{ t('auth.forgot.heading', locale) }}
    </h1>

    <p
      class="mt-12 mb-0 text-base/snug font-medium text-primary-comfy-canvas xl:text-lg/snug"
    >
      {{ t('auth.forgot.body', locale) }}
    </p>

    <form
      class="mt-16 flex flex-col gap-4 xl:gap-6"
      novalidate
      @submit.prevent="submit"
    >
      <div class="flex flex-col gap-2">
        <label
          class="mb-1 text-base text-primary-comfy-canvas/70"
          for="reset-email"
        >
          {{ t('auth.email.label', locale) }}
        </label>
        <input
          id="reset-email"
          v-model="email"
          type="email"
          name="email"
          autocomplete="email"
          required
          :placeholder="t('auth.email.placeholder', locale)"
          :class="AUTH_FIELD_CLASS"
          :aria-invalid="Boolean(errorMessage) || undefined"
        />
        <small v-if="errorMessage" role="alert" class="text-red-500">
          {{ errorMessage }}
        </small>
      </div>

      <div
        v-if="state === 'sent'"
        role="alert"
        :class="AUTH_MESSAGE_SUCCESS_CLASS"
      >
        {{ t('auth.forgot.sent', locale) }}
      </div>

      <button
        type="submit"
        :disabled="!email || state === 'sending' || state === 'sent'"
        :aria-busy="state === 'sending' || undefined"
        :class="cn(AUTH_BRAND_SOLID_BUTTON_CLASS, 'mt-2 w-full')"
      >
        <AuthSpinnerIcon v-if="state === 'sending'" />
        <span :class="cn(state === 'sending' && 'sr-only')">
          {{ t('auth.forgot.submit', locale) }}
        </span>
      </button>

      <a :href="signInHref" :class="AUTH_LINK_BUTTON_CLASS" @click="goToSignIn">
        {{ t('auth.forgot.backToSignIn', locale) }}
      </a>
    </form>

    <p class="mt-5 mb-8 text-sm text-primary-comfy-canvas/70">
      {{ t('auth.forgot.didntReceive', locale) }}
    </p>
  </section>
  <AuthFlagTimeout v-else-if="flagTimedOut" :locale="locale" />
</template>
