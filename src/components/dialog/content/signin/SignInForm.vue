<template>
  <form class="flex flex-col gap-6" @submit="onSubmit">
    <!-- Email Field -->
    <FormField v-slot="{ componentField }" name="email">
      <div class="flex flex-col gap-2">
        <label
          class="mb-2 text-base font-medium opacity-80"
          :for="emailInputId"
        >
          {{ t('auth.login.emailLabel') }}
        </label>
        <InputText
          v-bind="componentField"
          :id="emailInputId"
          autocomplete="email"
          class="h-10"
          type="text"
          :placeholder="t('auth.login.emailPlaceholder')"
          :invalid="Boolean(errors.email)"
        />
        <small v-if="errors.email" class="text-red-500">{{
          errors.email
        }}</small>
      </div>
    </FormField>

    <!-- Password Field -->
    <FormField v-slot="{ componentField }" name="password">
      <div class="flex flex-col gap-2">
        <div class="mb-2 flex items-center justify-between">
          <label
            class="text-base font-medium opacity-80"
            for="comfy-org-sign-in-password"
          >
            {{ t('auth.login.passwordLabel') }}
          </label>
          <span
            class="cursor-pointer text-base font-medium text-muted select-none"
            :class="{
              'text-link-disabled': !values.email || Boolean(errors.email)
            }"
            @click="handleForgotPassword(values.email, !errors.email)"
          >
            {{ t('auth.login.forgotPassword') }}
          </span>
        </div>
        <Password
          v-bind="componentField"
          input-id="comfy-org-sign-in-password"
          pt:pc-input-text:root:autocomplete="current-password"
          :feedback="false"
          toggle-mask
          :placeholder="t('auth.login.passwordPlaceholder')"
          :class="{ 'p-invalid': Boolean(errors.password) }"
          fluid
          class="h-10"
        />
        <small v-if="errors.password" class="text-red-500">{{
          errors.password
        }}</small>
      </div>
    </FormField>

    <!-- Submit Button -->
    <ProgressSpinner v-if="loading" class="mx-auto h-8 w-8" />
    <Button
      v-else
      type="submit"
      class="mt-4 h-10 font-medium"
      :disabled="!meta.valid"
    >
      {{ t('auth.login.loginButton') }}
    </Button>
  </form>
</template>

<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useThrottleFn } from '@vueuse/core'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useForm } from 'vee-validate'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { FormField } from '@/components/ui/form'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { signInSchema } from '@/schemas/signInSchema'
import type { SignInData } from '@/schemas/signInSchema'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const authStore = useFirebaseAuthStore()
const firebaseAuthActions = useFirebaseAuthActions()
const loading = computed(() => authStore.loading)
const toast = useToast()

const { t } = useI18n()

const emit = defineEmits<{
  submit: [values: SignInData]
}>()

const emailInputId = 'comfy-org-sign-in-email'

const { errors, meta, validate, values } = useForm<SignInData>({
  initialValues: {
    email: '',
    password: ''
  },
  validateOnMount: true,
  validationSchema: toTypedSchema(signInSchema)
})

const onSubmit = useThrottleFn(async (event: Event) => {
  event.preventDefault()
  const { valid, values: submittedValues } = await validate()
  if (valid && submittedValues?.email && submittedValues.password) {
    emit('submit', {
      email: submittedValues.email,
      password: submittedValues.password
    })
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
  await firebaseAuthActions.sendPasswordReset(email)
}
</script>

<style scoped>
@reference '../../../../assets/css/style.css';

.text-link-disabled {
  @apply opacity-50 cursor-not-allowed;
}
</style>
