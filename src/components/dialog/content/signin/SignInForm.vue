<template>
  <Form
    v-slot="$form"
    class="flex flex-col gap-6"
    :resolver="zodResolver(signInSchema)"
    @submit="onSubmit"
  >
    <!-- Email Field -->
    <FormField v-slot="$field" name="email" class="flex flex-col gap-2">
      <label class="mb-2 text-base font-medium opacity-80" :for="emailInputId">
        {{ t('auth.login.emailLabel') }}
      </label>
      <Input
        v-bind="$field.props"
        :id="emailInputId"
        autocomplete="email"
        class="h-10"
        type="text"
        :placeholder="t('auth.login.emailPlaceholder')"
        :aria-invalid="$field.invalid"
      />
      <small v-if="$field.invalid" class="text-red-500">{{
        $field.error.message
      }}</small>
    </FormField>

    <!-- Password Field -->
    <FormField v-slot="$field" name="password" class="flex flex-col gap-2">
      <div class="mb-2 flex items-center justify-between">
        <label
          class="text-base font-medium opacity-80"
          for="comfy-org-sign-in-password"
        >
          {{ t('auth.login.passwordLabel') }}
        </label>
        <span
          :class="
            cn('text-base font-medium text-muted select-none', {
              'cursor-not-allowed opacity-50':
                !$form.email?.value || $form.email?.invalid,
              'cursor-pointer': $form.email?.value && !$form.email?.invalid
            })
          "
          @click="handleForgotPassword($form.email?.value, $form.email?.valid)"
        >
          {{ t('auth.login.forgotPassword') }}
        </span>
      </div>
      <div class="relative">
        <Input
          v-bind="$field.props"
          id="comfy-org-sign-in-password"
          autocomplete="current-password"
          :type="passwordVisible ? 'text' : 'password'"
          :placeholder="t('auth.login.passwordPlaceholder')"
          :aria-invalid="$field.invalid"
          class="h-10 pr-10"
        />
        <button
          type="button"
          class="absolute top-1/2 right-3 flex -translate-y-1/2 text-muted-foreground"
          :aria-label="
            t(passwordVisible ? 'auth.hidePassword' : 'auth.showPassword')
          "
          :aria-pressed="passwordVisible"
          @click="passwordVisible = !passwordVisible"
        >
          <i
            :class="
              passwordVisible ? 'icon-[lucide--eye-off]' : 'icon-[lucide--eye]'
            "
            class="size-4"
          />
        </button>
      </div>
      <small v-if="$field.invalid" class="text-red-500">{{
        $field.error.message
      }}</small>
    </FormField>

    <!-- Submit Button -->
    <ProgressSpinner v-if="loading" class="mx-auto size-8" />
    <Button
      v-else
      type="submit"
      class="mt-4 h-10 font-medium"
      :disabled="!$form.valid"
    >
      {{ t('auth.login.loginButton') }}
    </Button>
  </Form>
</template>

<script setup lang="ts">
import type { FormSubmitEvent } from '@primevue/forms'
import { Form, FormField } from '@primevue/forms'
import { zodResolver } from '@primevue/forms/resolvers/zod'
import { useThrottleFn } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import ProgressSpinner from '@/components/ui/spinner/Spinner.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { signInSchema } from '@/schemas/signInSchema'
import type { SignInData } from '@/schemas/signInSchema'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@comfyorg/tailwind-utils'

const authStore = useAuthStore()
const authActions = useAuthActions()
const loading = computed(() => authStore.loading)
const toast = useToast()

const { t } = useI18n()

const emit = defineEmits<{
  submit: [values: SignInData]
}>()

const emailInputId = 'comfy-org-sign-in-email'
const passwordVisible = ref(false)

const onSubmit = useThrottleFn((event: FormSubmitEvent) => {
  if (event.valid) {
    emit('submit', event.values as SignInData)
  }
}, 1_500)

const handleForgotPassword = async (
  email: string,
  isValid: boolean | undefined
) => {
  if (!email || !isValid) {
    toast.add({
      severity: 'warn',
      summary: t('auth.login.emailPlaceholder'),
      life: 5_000
    })
    // Focus the email input
    document.getElementById(emailInputId)?.focus?.()
    return
  }
  await authActions.sendPasswordReset(email)
}
</script>
