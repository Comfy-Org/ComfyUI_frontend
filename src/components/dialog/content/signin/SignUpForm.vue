<template>
  <form class="flex flex-col gap-6" @submit.prevent="onSubmit">
    <!-- Email Field -->
    <div class="flex flex-col gap-2">
      <label
        class="mb-2 text-base font-medium opacity-80"
        for="comfy-org-sign-up-email"
      >
        {{ t('auth.signup.emailLabel') }}
      </label>
      <Input
        id="comfy-org-sign-up-email"
        :model-value="values.email"
        name="email"
        autocomplete="email"
        :class="fieldClass"
        type="email"
        :placeholder="t('auth.signup.emailPlaceholder')"
        :aria-invalid="Boolean(errors.email)"
        :aria-describedby="errors.email ? emailErrorId : undefined"
        @update:model-value="updateEmail"
      />
      <small v-if="errors.email" :id="emailErrorId" class="text-red-500">
        {{ errors.email }}
      </small>
    </div>

    <PasswordFields
      v-model:password="values.password"
      v-model:confirm-password="values.confirmPassword"
      :field-class="fieldClass"
      :password-error="errors.password"
      :confirm-password-error="errors.confirmPassword"
      @update:password="validatePassword"
      @update:confirm-password="validateConfirmPassword"
    />

    <TurnstileWidget
      v-if="turnstileEnabled"
      ref="turnstileWidget"
      v-model:token="turnstileToken"
      v-model:unavailable="turnstileUnavailable"
    />

    <small
      v-show="waitingForTurnstile"
      id="comfy-org-sign-up-turnstile-hint"
      role="status"
      aria-live="polite"
      class="opacity-80"
    >
      {{ t('auth.turnstile.submitBlockedHint') }}
    </small>

    <Button
      type="submit"
      :variant="submitVariant"
      :size="submitSize"
      :class="cn('mt-4', submitClass)"
      :loading="loading"
      :disabled="!isValid || waitingForTurnstile"
      :aria-describedby="
        waitingForTurnstile ? 'comfy-org-sign-up-turnstile-hint' : undefined
      "
    >
      {{ t('auth.signup.signUpButton') }}
    </Button>
  </form>
</template>

<script setup lang="ts">
import { useThrottleFn } from '@vueuse/core'
import { computed, reactive, useTemplateRef } from 'vue'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { ButtonVariants } from '@/components/ui/button/button.variants'
import Input from '@/components/ui/input/Input.vue'
import { useTurnstile, useTurnstileGate } from '@/composables/auth/useTurnstile'
import { signUpSchema } from '@/schemas/signInSchema'
import type { SignUpData } from '@/schemas/signInSchema'
import { useAuthStore } from '@/stores/authStore'
import { getZodFieldErrors } from '@/utils/zodFieldErrors'

import PasswordFields from './PasswordFields.vue'
import TurnstileWidget from './TurnstileWidget.vue'

const {
  fieldClass = 'h-10',
  submitClass,
  submitVariant = 'secondary',
  submitSize = 'lg'
} = defineProps<{
  fieldClass?: HTMLAttributes['class']
  submitClass?: HTMLAttributes['class']
  submitVariant?: ButtonVariants['variant']
  submitSize?: ButtonVariants['size']
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const loading = computed(() => authStore.loading)

const { enabled: turnstileEnabled } = useTurnstile()
const {
  token: turnstileToken,
  unavailable: turnstileUnavailable,
  waiting: waitingForTurnstile
} = useTurnstileGate(turnstileEnabled)
const turnstileWidget =
  useTemplateRef<InstanceType<typeof TurnstileWidget>>('turnstileWidget')
const emailErrorId = 'comfy-org-sign-up-email-error'
const values = reactive<SignUpData>({
  email: '',
  password: '',
  confirmPassword: ''
})
const errors = reactive<Partial<Record<keyof SignUpData, string>>>({})
const isValid = computed(() => Object.keys(errors).length === 0)

const emit = defineEmits<{
  submit: [values: SignUpData, turnstileToken?: string]
}>()

function validateField(field: keyof SignUpData) {
  const result = signUpSchema.safeParse(values)
  const message = result.success
    ? undefined
    : getZodFieldErrors(result.error)[field]

  if (message) errors[field] = message
  else delete errors[field]
}

function updateEmail(value: string | number | undefined) {
  values.email = String(value ?? '')
  validateField('email')
}

function validatePassword() {
  validateField('password')
}

function validateConfirmPassword() {
  validateField('confirmPassword')
}

const onSubmit = useThrottleFn(() => {
  const result = signUpSchema.safeParse(values)
  if (result.success && !waitingForTurnstile.value) {
    emit('submit', result.data, turnstileToken.value || undefined)
    return
  }

  if (!result.success) {
    Object.assign(errors, getZodFieldErrors(result.error))
  }
}, 1_500)

// Turnstile tokens are single-use. The parent calls this after a FAILED signup
// (the form can't observe the submit outcome itself) to discard the spent token
// and request a fresh challenge. Driving it from the actual result — instead of
// watching the store-global loading flag — keeps an unrelated auth action from
// wiping a freshly-solved token, and avoids resetting a widget that is about to
// unmount on success.
function resetTurnstile() {
  turnstileWidget.value?.reset()
}

defineExpose({ resetTurnstile })
</script>
