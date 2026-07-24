<template>
  <Form
    v-slot="$form"
    class="flex flex-col gap-4"
    :resolver="zodResolver(signUpSchema)"
    @submit="onSubmit"
  >
    <!-- Email Field -->
    <FormField v-slot="$field" name="email" class="flex flex-col gap-2">
      <label
        class="text-base font-medium opacity-80"
        for="comfy-org-sign-up-email"
      >
        {{ t('auth.signup.emailLabel') }}
      </label>
      <InputText
        pt:root:id="comfy-org-sign-up-email"
        pt:root:name="email"
        pt:root:autocomplete="email"
        class="h-10"
        type="email"
        :placeholder="t('auth.signup.emailPlaceholder')"
        :invalid="$field.invalid"
      />
      <small v-if="$field.error" class="text-red-500">{{
        $field.error.message
      }}</small>
    </FormField>

    <PasswordFields />

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

    <!-- Submit Button -->
    <ProgressSpinner v-if="loading" class="mx-auto size-8" />
    <Button
      v-else
      type="submit"
      variant="secondary"
      class="relative mt-4 h-10 gap-4 rounded-md border border-solid border-primary-comfy-canvas/20 bg-primary-comfy-canvas/5 text-sm font-medium text-primary-comfy-canvas hover:bg-primary-comfy-canvas/10"
      :disabled="!$form.valid || waitingForTurnstile"
      :aria-describedby="
        waitingForTurnstile ? 'comfy-org-sign-up-turnstile-hint' : undefined
      "
    >
      {{ t('auth.signup.signUpButton') }}
    </Button>
  </Form>
</template>

<script setup lang="ts">
import type { FormSubmitEvent } from '@primevue/forms'
import { Form, FormField } from '@primevue/forms'
import { zodResolver } from '@primevue/forms/resolvers/zod'
import { useThrottleFn } from '@vueuse/core'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useTurnstile, useTurnstileGate } from '@/composables/auth/useTurnstile'
import { signUpSchema } from '@/schemas/signInSchema'
import type { SignUpData } from '@/schemas/signInSchema'
import { useAuthStore } from '@/stores/authStore'

import PasswordFields from './PasswordFields.vue'
import TurnstileWidget from './TurnstileWidget.vue'

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

const onSubmit = useThrottleFn((event: FormSubmitEvent) => {
  if (event.valid && !waitingForTurnstile.value) {
    emit(
      'submit',
      event.values as SignUpData,
      turnstileToken.value || undefined
    )
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
