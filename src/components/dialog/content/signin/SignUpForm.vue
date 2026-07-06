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
      v-model:unavailable="turnstileUnavailable"
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

const { enabled: turnstileEnabled } = useTurnstile()
const turnstileToken = ref('')
// Set by the widget when it cannot be relied on to ever produce a token (the
// Cloudflare script failed to load, the challenge errored out, or it just
// hasn't resolved in time). Submission falls back to proceeding without a
// token rather than blocking a legitimate signup forever.
const turnstileUnavailable = ref(false)
const turnstileWidget =
  useTemplateRef<InstanceType<typeof TurnstileWidget>>('turnstileWidget')
// Gate submit on the widget being enabled (rendering — shadow or enforce),
// not on it being enforced: shadow mode still needs a real token most of the
// time to actually measure the false-positive rate, so it can't let users
// through before the widget has had a chance to resolve.
const submitBlockedByTurnstile = computed(
  () =>
    turnstileEnabled.value &&
    !turnstileToken.value &&
    !turnstileUnavailable.value
)

watch(turnstileEnabled, (on) => {
  if (!on) {
    turnstileToken.value = ''
    turnstileUnavailable.value = false
  }
})

const emit = defineEmits<{
  submit: [values: SignUpData, turnstileToken?: string]
}>()

const onSubmit = useThrottleFn((event: FormSubmitEvent) => {
  if (event.valid && !submitBlockedByTurnstile.value) {
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
