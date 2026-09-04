<script setup lang="ts">
import { classifyAuthError } from '@comfyorg/auth-core/firebaseAuthError'
import { ref } from 'vue'

import { authSchemasFor } from '../../config/auth-schemas'
import { sendWorkshopPasswordReset } from '../../config/workshop-firebase'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useWorkshopAuthFlag } from '../../scripts/posthog'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

const enabled = useWorkshopAuthFlag()
const email = ref('')
const fieldError = ref('')

type ResetState = 'idle' | 'sending' | 'sent' | 'error'
const state = ref<ResetState>('idle')

async function submit() {
  if (state.value === 'sending') return
  const parsed = authSchemasFor(locale).signInSchema.shape.email.safeParse(
    email.value
  )
  if (!parsed.success) {
    fieldError.value = parsed.error.issues[0]?.message ?? ''
    return
  }
  fieldError.value = ''
  state.value = 'sending'
  try {
    await sendWorkshopPasswordReset(email.value)
    state.value = 'sent'
  } catch (error) {
    // An unregistered email must look identical to a registered one, or the
    // sent/error split becomes an account-enumeration oracle. Only a real
    // transport failure surfaces the error state.
    state.value = isUnknownEmailError(error) ? 'sent' : 'error'
  }
}

function isUnknownEmailError(error: unknown): boolean {
  const classified = classifyAuthError(error)
  return (
    classified.kind === 'auth' &&
    (classified.code === 'auth/user-not-found' ||
      classified.code === 'auth/invalid-email')
  )
}
</script>

<template>
  <section
    v-if="enabled"
    class="mx-auto w-full max-w-md rounded-2xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/4 p-8"
    :aria-busy="state === 'sending'"
  >
    <h1 class="text-2xl font-semibold text-primary-comfy-canvas">
      {{ t('auth.forgot.heading', locale) }}
    </h1>

    <template v-if="state === 'sent'">
      <p class="mt-3 text-sm text-primary-comfy-canvas/70" role="status">
        {{ t('auth.forgot.sent', locale) }}
      </p>
    </template>

    <form v-else class="mt-3" novalidate @submit.prevent="submit">
      <p class="text-sm text-primary-comfy-canvas/70">
        {{ t('auth.forgot.body', locale) }}
      </p>
      <label class="mt-5 flex flex-col gap-1.5">
        <span class="text-sm text-primary-comfy-canvas/70">
          {{ t('auth.email.label', locale) }}
        </span>
        <input
          v-model="email"
          type="email"
          autocomplete="email"
          class="focus-visible:border-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 h-11 w-full rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/5 px-4 text-sm text-primary-comfy-canvas outline-none focus-visible:ring-3"
          :aria-invalid="Boolean(fieldError)"
        />
        <span v-if="fieldError" role="alert" class="text-xs text-red-400">
          {{ fieldError }}
        </span>
      </label>

      <p
        v-if="state === 'error'"
        role="alert"
        class="mt-3 text-sm text-red-400"
      >
        {{ t('auth.forgot.error', locale) }}
      </p>

      <button
        type="submit"
        :disabled="state === 'sending'"
        class="hover:bg-primary-comfy-yellow/90 bg-primary-comfy-yellow mt-5 flex h-12 w-full items-center justify-center rounded-xl font-semibold text-primary-comfy-ink transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        {{ t('auth.forgot.submit', locale) }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm">
      <a href="/login/" class="text-primary-comfy-yellow hover:underline">
        {{ t('auth.forgot.backToSignIn', locale) }}
      </a>
    </p>
  </section>
</template>
