<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref, useTemplateRef } from 'vue'

import {
  TURNSTILE_MESSAGES,
  isTurnstileEnabled
} from '@comfyorg/account/turnstile'
import {
  PasswordRules,
  TurnstileWidget,
  useTurnstileGate
} from '@comfyorg/account/vue'

import { authSchemasFor } from '../../config/auth-schemas'
import { WORKSHOP_TURNSTILE_SITE_KEY } from '../../config/workshop-env'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useWorkshopTurnstileMode } from '../../scripts/posthog'
import AuthPasswordField from './AuthPasswordField.vue'
import AuthSpinnerIcon from './AuthSpinnerIcon.vue'
import { AUTH_BRAND_SOLID_BUTTON_CLASS, AUTH_FIELD_CLASS } from './authClasses'

const {
  mode,
  locale = 'en',
  loading = false
} = defineProps<{
  mode: 'signIn' | 'signUp'
  locale?: Locale
  loading?: boolean
}>()

const emit = defineEmits<{
  forgotPassword: [event: MouseEvent]
  submit: [
    credentials: {
      email: string
      password: string
      turnstileToken?: string
    }
  ]
}>()

type Field = 'email' | 'password' | 'confirmPassword'

const values = ref<Record<Field, string>>({
  email: '',
  password: '',
  confirmPassword: ''
})
/** Only fields validated so far carry an entry, so an untouched field never blocks submit. */
const fieldErrors = ref<Partial<Record<Field, string | null>>>({})
const passwordDirty = ref(false)
const passwordFocused = ref(false)
const turnstileWidget =
  useTemplateRef<InstanceType<typeof TurnstileWidget>>('turnstileWidget')

// Unknown or absent flag variants normalize to off. That keeps an unverified
// hostname/sitekey from rendering a broken challenge; the server remains the
// enforcement boundary for shadow/enforce mode.
const turnstileMode = useWorkshopTurnstileMode()
const turnstileEnabled = computed(
  () =>
    mode === 'signUp' &&
    isTurnstileEnabled(turnstileMode.value, WORKSHOP_TURNSTILE_SITE_KEY)
)
const { token, unavailable, waiting } = useTurnstileGate(turnstileEnabled)

/** Held until every field validates, as the cloud forms are. */
const formValid = computed(() => Object.keys(issuesByField()).length === 0)
const submitDisabled = computed(
  () => loading || waiting.value || !formValid.value
)

const passwordRulesCopy = computed(() => ({
  requirements: t('validation.password.requirements', locale),
  length: t('validation.password.lengthRange', locale),
  uppercase: t('validation.password.uppercase', locale),
  lowercase: t('validation.password.lowercase', locale),
  number: t('validation.password.number', locale),
  special: t('validation.password.special', locale)
}))

const fieldId = (field: Field) => `workshop-${mode}-${field}`

function issuesByField() {
  const schemas = authSchemasFor(locale)
  const parsed =
    mode === 'signUp'
      ? schemas.signUpSchema.safeParse(values.value)
      : schemas.signInSchema.safeParse({
          email: values.value.email,
          password: values.value.password
        })
  const collected: Partial<Record<Field, string>> = {}
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as Field | undefined
      if (field) collected[field] ??= issue.message
    }
  }
  return collected
}

/** PrimeVue Forms validates the edited field on every value update. */
function validateField(field: Field) {
  if (field === 'password') passwordDirty.value = true
  fieldErrors.value = {
    ...fieldErrors.value,
    [field]: issuesByField()[field] ?? null
  }
}

function submit() {
  const issues = issuesByField()
  const fields: Field[] =
    mode === 'signUp'
      ? ['email', 'password', 'confirmPassword']
      : ['email', 'password']
  fieldErrors.value = Object.fromEntries(
    fields.map((field) => [field, issues[field] ?? null])
  )
  if (Object.keys(issues).length > 0) return

  emit('submit', {
    email: values.value.email,
    password: values.value.password,
    ...(token.value ? { turnstileToken: token.value } : {})
  })
}

function resetTurnstile(): void {
  turnstileWidget.value?.reset()
}

defineExpose({ resetTurnstile })
</script>

<template>
  <form class="flex flex-col gap-6" novalidate @submit.prevent="submit">
    <div class="flex flex-col gap-2">
      <label
        :for="fieldId('email')"
        :class="
          mode === 'signUp'
            ? 'mb-2 text-base font-medium opacity-80'
            : 'mb-1 text-base text-primary-comfy-canvas/70'
        "
      >
        {{ t('auth.email.label', locale) }}
      </label>
      <input
        :id="fieldId('email')"
        v-model="values.email"
        :type="mode === 'signUp' ? 'email' : 'text'"
        name="email"
        autocomplete="email"
        :placeholder="t('auth.email.placeholder', locale)"
        :class="AUTH_FIELD_CLASS"
        :aria-invalid="Boolean(fieldErrors.email)"
        @input="validateField('email')"
      />
      <small v-if="fieldErrors.email" role="alert" class="text-red-500">
        {{ fieldErrors.email }}
      </small>
    </div>

    <div
      class="flex flex-col gap-2"
      @focusin="passwordFocused = true"
      @focusout="passwordFocused = false"
    >
      <label
        :for="fieldId('password')"
        :class="
          mode === 'signUp'
            ? 'mb-2 text-base font-medium opacity-80'
            : 'mb-1 text-base text-primary-comfy-canvas/70'
        "
      >
        {{ t('auth.password.label', locale) }}
      </label>
      <AuthPasswordField
        :id="fieldId('password')"
        v-model="values.password"
        name="password"
        :autocomplete="mode === 'signUp' ? 'new-password' : 'current-password'"
        :placeholder="
          t(
            mode === 'signUp'
              ? 'auth.password.newPlaceholder'
              : 'auth.password.placeholder',
            locale
          )
        "
        :invalid="Boolean(fieldErrors.password)"
        :show-label="t('auth.password.show', locale)"
        :hide-label="t('auth.password.hide', locale)"
        @input="validateField('password')"
      />
      <PasswordRules
        v-if="mode === 'signUp' && passwordDirty && passwordFocused"
        :password="values.password"
        :copy="passwordRulesCopy"
        root-class="text-sm"
        list-class="mt-1 space-y-1"
        unmet-class="text-red-500"
      />
      <small
        v-else-if="mode === 'signIn' && fieldErrors.password"
        role="alert"
        class="text-red-500"
      >
        {{ fieldErrors.password }}
      </small>

      <a
        v-if="mode === 'signIn'"
        href="/forgot-password/"
        class="mt-1 self-start text-sm text-primary-comfy-canvas/70 underline"
        @click="emit('forgotPassword', $event)"
      >
        {{ t('auth.signIn.forgotPassword', locale) }}
      </a>
    </div>

    <div v-if="mode === 'signUp'" class="flex flex-col gap-2">
      <label
        :for="fieldId('confirmPassword')"
        class="mb-2 text-base font-medium opacity-80"
      >
        {{ t('auth.confirmPassword.label', locale) }}
      </label>
      <AuthPasswordField
        :id="fieldId('confirmPassword')"
        v-model="values.confirmPassword"
        name="confirmPassword"
        autocomplete="new-password"
        :placeholder="t('auth.confirmPassword.placeholder', locale)"
        :invalid="Boolean(fieldErrors.confirmPassword)"
        :show-label="t('auth.password.show', locale)"
        :hide-label="t('auth.password.hide', locale)"
        @input="validateField('confirmPassword')"
      />
      <small
        v-if="fieldErrors.confirmPassword"
        role="alert"
        class="text-red-500"
      >
        {{ fieldErrors.confirmPassword }}
      </small>
    </div>

    <TurnstileWidget
      v-if="turnstileEnabled"
      ref="turnstileWidget"
      v-model:token="token"
      v-model:unavailable="unavailable"
      :site-key="WORKSHOP_TURNSTILE_SITE_KEY"
      theme="dark"
      :expired-message="TURNSTILE_MESSAGES[locale].expired"
      :failed-message="TURNSTILE_MESSAGES[locale].failed"
      error-class="text-red-500"
    />
    <small
      v-show="waiting"
      :id="fieldId('email') + '-turnstile-hint'"
      role="status"
      aria-live="polite"
      class="opacity-80"
    >
      {{ TURNSTILE_MESSAGES[locale].submitBlockedHint }}
    </small>

    <button
      type="submit"
      :disabled="submitDisabled"
      :aria-busy="loading || undefined"
      :aria-describedby="
        waiting ? fieldId('email') + '-turnstile-hint' : undefined
      "
      :class="cn(AUTH_BRAND_SOLID_BUTTON_CLASS, 'mt-2 w-full')"
    >
      <AuthSpinnerIcon v-if="loading" />
      <span :class="cn(loading && 'sr-only')">
        {{
          mode === 'signUp'
            ? t('auth.signUp.submit', locale)
            : t('auth.signIn.submit', locale)
        }}
      </span>
    </button>
  </form>
</template>
