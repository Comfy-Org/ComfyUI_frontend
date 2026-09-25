<template>
  <form class="flex flex-col gap-10" @submit.prevent="onSubmit">
    <FieldGroup>
      <VeeField v-slot="{ componentField, errors }" name="email">
        <Field :data-invalid="!!errors.length">
          <FieldLabel :for="emailInputId">
            {{ t('auth.login.emailLabel') }}
          </FieldLabel>
          <Input
            v-bind="componentField"
            :id="emailInputId"
            autocomplete="email"
            type="text"
            :placeholder="t('auth.login.emailPlaceholder')"
            :aria-invalid="!!errors.length"
          />
          <FieldError v-if="errors.length" :errors />
        </Field>
      </VeeField>

      <VeeField v-slot="{ componentField, errors }" name="password">
        <Field :data-invalid="!!errors.length">
          <div class="flex items-center justify-between">
            <FieldLabel for="comfy-org-sign-in-password">
              {{ t('auth.login.passwordLabel') }}
            </FieldLabel>
            <span
              :class="
                cn(
                  'text-sm font-medium text-muted-foreground select-none',
                  canResetPassword
                    ? 'cursor-pointer'
                    : 'cursor-not-allowed opacity-50'
                )
              "
              @click="handleForgotPassword"
            >
              {{ t('auth.login.forgotPassword') }}
            </span>
          </div>
          <PasswordInput
            v-bind="componentField"
            id="comfy-org-sign-in-password"
            autocomplete="current-password"
            :placeholder="t('auth.login.passwordPlaceholder')"
            :aria-invalid="!!errors.length"
          />
          <FieldError v-if="errors.length" :errors />
        </Field>
      </VeeField>
    </FieldGroup>

    <Spinner v-if="loading" class="mx-auto size-8" />
    <Button
      v-else
      type="submit"
      class="h-10 font-medium"
      :disabled="!meta.valid"
    >
      {{ t('auth.login.loginButton') }}
    </Button>
  </form>
</template>

<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useThrottleFn } from '@vueuse/core'
import { Field as VeeField, useForm, useIsFieldValid } from 'vee-validate'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import Field from '@/components/ui/field/Field.vue'
import FieldError from '@/components/ui/field/FieldError.vue'
import FieldGroup from '@/components/ui/field/FieldGroup.vue'
import FieldLabel from '@/components/ui/field/FieldLabel.vue'
import Input from '@/components/ui/input/Input.vue'
import PasswordInput from '@/components/ui/input/PasswordInput.vue'
import { useToast } from '@/components/ui/toast'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { signInSchema } from '@/schemas/signInSchema'
import type { SignInData } from '@/schemas/signInSchema'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()
const authActions = useAuthActions()
const loading = computed(() => authStore.loading)
const toast = useToast()

const { t } = useI18n()

const emit = defineEmits<{
  submit: [values: SignInData]
}>()

const emailInputId = 'comfy-org-sign-in-email'

const { handleSubmit, meta, values } = useForm({
  validationSchema: toTypedSchema(signInSchema),
  initialValues: { email: '', password: '' }
})
const isEmailValid = useIsFieldValid('email')
const canResetPassword = computed(() => !!values.email && isEmailValid.value)

const onSubmit = useThrottleFn(
  handleSubmit((formValues) => emit('submit', formValues)),
  1_500
)

async function handleForgotPassword() {
  const email = values.email
  if (!email || !isEmailValid.value) {
    toast.warning(t('auth.login.emailPlaceholder'), { duration: 5_000 })
    document.getElementById(emailInputId)?.focus()
    return
  }
  await authActions.sendPasswordReset(email)
}
</script>
