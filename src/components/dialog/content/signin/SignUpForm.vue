<template>
  <form class="flex flex-col gap-6" @submit.prevent="onSubmit">
    <FieldGroup>
      <VeeField v-slot="{ componentField, errors }" name="email">
        <Field :data-invalid="!!errors.length">
          <FieldLabel for="comfy-org-sign-up-email">
            {{ t('auth.signup.emailLabel') }}
          </FieldLabel>
          <Input
            v-bind="componentField"
            id="comfy-org-sign-up-email"
            autocomplete="email"
            :class="fieldClass"
            type="email"
            :placeholder="t('auth.signup.emailPlaceholder')"
            :aria-invalid="!!errors.length"
          />
          <FieldError v-if="errors.length" :errors />
        </Field>
      </VeeField>

      <PasswordFields :field-class="fieldClass" />
    </FieldGroup>

    <TurnstileWidget
      v-if="turnstileEnabled"
      ref="turnstileWidget"
      v-model:token="turnstileToken"
      v-model:unavailable="turnstileUnavailable"
    />

    <FieldDescription
      v-show="waitingForTurnstile"
      id="comfy-org-sign-up-turnstile-hint"
      role="status"
      aria-live="polite"
    >
      {{ t('auth.turnstile.submitBlockedHint') }}
    </FieldDescription>

    <Button
      type="submit"
      :variant="submitVariant"
      :size="submitSize"
      :class="cn('mt-4', submitClass)"
      :loading="loading"
      :disabled="!meta.valid || waitingForTurnstile"
      :aria-describedby="
        waitingForTurnstile ? 'comfy-org-sign-up-turnstile-hint' : undefined
      "
    >
      {{ t('auth.signup.signUpButton') }}
    </Button>
  </form>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { toTypedSchema } from '@vee-validate/zod'
import { useThrottleFn } from '@vueuse/core'
import { Field as VeeField, useForm } from 'vee-validate'
import { computed, useTemplateRef } from 'vue'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { ButtonVariants } from '@/components/ui/button/button.variants'
import Field from '@/components/ui/field/Field.vue'
import FieldDescription from '@/components/ui/field/FieldDescription.vue'
import FieldError from '@/components/ui/field/FieldError.vue'
import FieldGroup from '@/components/ui/field/FieldGroup.vue'
import FieldLabel from '@/components/ui/field/FieldLabel.vue'
import Input from '@/components/ui/input/Input.vue'
import { useTurnstile, useTurnstileGate } from '@/composables/auth/useTurnstile'
import { signUpSchema } from '@/schemas/signInSchema'
import type { SignUpData } from '@/schemas/signInSchema'
import { useAuthStore } from '@/stores/authStore'

import PasswordFields from './PasswordFields.vue'
import TurnstileWidget from './TurnstileWidget.vue'

const {
  fieldClass,
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

const emit = defineEmits<{
  submit: [values: SignUpData, turnstileToken?: string]
}>()

const { handleSubmit, meta } = useForm({
  validationSchema: toTypedSchema(signUpSchema),
  initialValues: { email: '', password: '', confirmPassword: '' }
})

const onSubmit = useThrottleFn(
  handleSubmit((values) => {
    if (waitingForTurnstile.value) return
    emit('submit', values, turnstileToken.value || undefined)
  }),
  1_500
)

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
