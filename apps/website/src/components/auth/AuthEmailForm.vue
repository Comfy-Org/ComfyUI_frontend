<script setup lang="ts">
import { computed, ref } from 'vue'

import TurnstileWidget from '@comfyorg/auth-core/TurnstileWidget.vue'
import { useTurnstileGate } from '@comfyorg/auth-core/turnstile'

import { authSchemasFor } from '../../config/auth-schemas'
import { WORKSHOP_TURNSTILE_SITE_KEY } from '../../config/workshop-env'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  mode,
  locale = 'en',
  disabled = false
} = defineProps<{
  mode: 'signIn' | 'signUp'
  locale?: Locale
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [
    credentials: {
      email: string
      password: string
      turnstileToken?: string
    }
  ]
}>()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const fieldErrors = ref<Partial<Record<string, string>>>({})

// The Cloudflare hostname allowlist decides whether the widget can render;
// the gate falls open on `unavailable` so a blocked host never bricks
// sign-up — the server's own policy is the enforcement.
const turnstileEnabled = computed(() => mode === 'signUp')
const { token, unavailable, waiting } = useTurnstileGate(turnstileEnabled)

const submitDisabled = computed(() => disabled || waiting.value)

const FIELD_CLASS =
  'focus:border-primary-comfy-yellow h-11 w-full rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/5 px-4 text-sm text-primary-comfy-canvas outline-none'

function submit() {
  const schemas = authSchemasFor(locale)
  const parsed =
    mode === 'signUp'
      ? schemas.signUpSchema.safeParse({
          email: email.value,
          password: password.value,
          confirmPassword: confirmPassword.value
        })
      : schemas.signInSchema.safeParse({
          email: email.value,
          password: password.value
        })

  if (!parsed.success) {
    const collected: Partial<Record<string, string>> = {}
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '')
      collected[field] ??= issue.message
    }
    fieldErrors.value = collected
    return
  }

  fieldErrors.value = {}
  emit('submit', {
    email: email.value,
    password: password.value,
    ...(token.value ? { turnstileToken: token.value } : {})
  })
}
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
    <label class="flex flex-col gap-1.5">
      <span class="text-sm text-primary-comfy-canvas/70">
        {{ t('auth.email.label', locale) }}
      </span>
      <input
        v-model="email"
        type="email"
        autocomplete="email"
        :class="FIELD_CLASS"
        :aria-invalid="Boolean(fieldErrors.email)"
      />
      <span v-if="fieldErrors.email" role="alert" class="text-xs text-red-400">
        {{ fieldErrors.email }}
      </span>
    </label>

    <label class="flex flex-col gap-1.5">
      <span class="text-sm text-primary-comfy-canvas/70">
        {{ t('auth.password.label', locale) }}
      </span>
      <input
        v-model="password"
        type="password"
        :autocomplete="mode === 'signUp' ? 'new-password' : 'current-password'"
        :class="FIELD_CLASS"
        :aria-invalid="Boolean(fieldErrors.password)"
      />
      <span
        v-if="fieldErrors.password"
        role="alert"
        class="text-xs text-red-400"
      >
        {{ fieldErrors.password }}
      </span>
    </label>
    <a
      v-if="mode === 'signIn'"
      href="/forgot-password/"
      class="-mt-2 self-start text-xs text-primary-comfy-canvas/55 underline hover:text-primary-comfy-yellow"
    >
      {{ t('auth.signIn.forgotPassword', locale) }}
    </a>

    <label v-if="mode === 'signUp'" class="flex flex-col gap-1.5">
      <span class="text-sm text-primary-comfy-canvas/70">
        {{ t('auth.confirmPassword.label', locale) }}
      </span>
      <input
        v-model="confirmPassword"
        type="password"
        autocomplete="new-password"
        :class="FIELD_CLASS"
        :aria-invalid="Boolean(fieldErrors.confirmPassword)"
      />
      <span
        v-if="fieldErrors.confirmPassword"
        role="alert"
        class="text-xs text-red-400"
      >
        {{ fieldErrors.confirmPassword }}
      </span>
    </label>

    <TurnstileWidget
      v-if="turnstileEnabled"
      v-model:token="token"
      v-model:unavailable="unavailable"
      :site-key="WORKSHOP_TURNSTILE_SITE_KEY"
      theme="dark"
      :expired-message="t('auth.turnstile.expired', locale)"
      :failed-message="t('auth.turnstile.failed', locale)"
    />
    <p
      v-if="waiting"
      role="status"
      aria-live="polite"
      class="text-xs text-primary-comfy-canvas/55"
    >
      {{ t('auth.turnstile.waiting', locale) }}
    </p>

    <button
      type="submit"
      :disabled="submitDisabled"
      class="hover:bg-primary-comfy-yellow/90 flex h-12 w-full items-center justify-center rounded-xl bg-primary-comfy-yellow font-semibold text-primary-comfy-ink transition-colors disabled:cursor-not-allowed disabled:opacity-40"
    >
      {{
        mode === 'signUp'
          ? t('auth.signUp.submit', locale)
          : t('auth.signIn.submit', locale)
      }}
    </button>
  </form>
</template>
