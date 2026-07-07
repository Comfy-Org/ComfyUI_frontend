<template>
  <Form
    v-slot="$form"
    class="flex flex-col gap-6"
    :resolver="zodResolver(signUpSchema)"
    @submit="onSubmit"
  >
    <!-- Email Field -->
    <FormField v-slot="$field" name="email" class="flex flex-col gap-2">
      <label
        class="mb-2 text-base font-medium opacity-80"
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
    />

    <small
      v-show="submitBlockedByTurnstile"
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
      class="mt-4 h-10 font-medium"
      :disabled="!$form.valid || submitBlockedByTurnstile"
      :aria-describedby="
        submitBlockedByTurnstile
          ? 'comfy-org-sign-up-turnstile-hint'
          : undefined
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
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useTurnstile } from '@/composables/auth/useTurnstile'
import { signUpSchema } from '@/schemas/signInSchema'
import type { SignUpData } from '@/schemas/signInSchema'
import { useAuthStore } from '@/stores/authStore'

import PasswordFields from './PasswordFields.vue'
import TurnstileWidget from './TurnstileWidget.vue'

const { t } = useI18n()
const authStore = useAuthStore()
const loading = computed(() => authStore.loading)

const { enabled: turnstileEnabled, enforced: turnstileEnforced } =
  useTurnstile()
const turnstileToken = ref('')
const turnstileWidget =
  useTemplateRef<InstanceType<typeof TurnstileWidget>>('turnstileWidget')
const submitBlockedByTurnstile = computed(
  () => turnstileEnforced.value && !turnstileToken.value
)

watch(turnstileEnabled, (on) => {
  if (!on) turnstileToken.value = ''
})

const emit = defineEmits<{
  submit: [values: SignUpData, turnstileToken?: string]
}>()

// UX guard: leading edge only (trailing: false) drops a rapid double-submit to
// avoid a duplicate request / spinner flicker. The store's single-flight
// (inFlightRegister in authStore) owns "create the account once"; this is
// defense-in-depth.
const onSubmit = useThrottleFn(
  (event: FormSubmitEvent) => {
    if (loading.value) return
    if (event.valid && !submitBlockedByTurnstile.value) {
      emit(
        'submit',
        event.values as SignUpData,
        turnstileToken.value || undefined
      )
    }
  },
  1_500,
  false
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
