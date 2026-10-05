<template>
  <form class="flex flex-col gap-6" @submit.prevent="onSubmit">
    <VeeField v-slot="{ componentField, errors }" name="email">
      <Field :data-invalid="!!errors.length">
        <FieldLabel :for="emailInputId" :class="CLOUD_AUTH_LABEL_CLASS">
          {{ t('auth.login.emailLabel') }}
        </FieldLabel>
        <Input
          v-bind="componentField"
          :id="emailInputId"
          autocomplete="email"
          :class="CLOUD_AUTH_FIELD_CLASS"
          type="text"
          :placeholder="t('auth.login.emailPlaceholder')"
          :aria-invalid="!!errors.length"
        />
        <FieldError v-if="errors.length" :errors />
      </Field>
    </VeeField>

    <VeeField v-slot="{ componentField, errors }" name="password">
      <Field :data-invalid="!!errors.length">
        <FieldLabel
          for="cloud-sign-in-password"
          :class="CLOUD_AUTH_LABEL_CLASS"
        >
          {{ t('auth.login.passwordLabel') }}
        </FieldLabel>
        <PasswordInput
          v-bind="componentField"
          id="cloud-sign-in-password"
          autocomplete="current-password"
          :placeholder="t('auth.login.passwordPlaceholder')"
          :class="CLOUD_AUTH_FIELD_CLASS"
          :aria-invalid="!!errors.length"
        />
        <FieldError v-if="errors.length" :errors />

        <router-link
          :to="{ name: 'cloud-forgot-password' }"
          class="mt-1 self-start text-sm text-primary-comfy-canvas/70 underline"
        >
          {{ t('auth.login.forgotPassword') }}
        </router-link>
      </Field>
    </VeeField>

    <Message v-if="authError" severity="error">
      {{ authError }}
    </Message>

    <Button
      type="submit"
      variant="brand-solid"
      size="brand"
      class="mt-2 w-full"
      :loading="loading"
      :disabled="!meta.valid"
    >
      {{ t('auth.login.loginButton') }}
    </Button>
  </form>
</template>

<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { Field as VeeField, useForm } from 'vee-validate'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Field from '@/components/ui/field/Field.vue'
import FieldError from '@/components/ui/field/FieldError.vue'
import FieldLabel from '@/components/ui/field/FieldLabel.vue'
import Input from '@/components/ui/input/Input.vue'
import PasswordInput from '@/components/ui/input/PasswordInput.vue'
import Message from '@/components/ui/message/Message.vue'
import {
  CLOUD_AUTH_FIELD_CLASS,
  CLOUD_AUTH_LABEL_CLASS
} from '@/platform/cloud/onboarding/constants/authClasses'
import { signInSchema } from '@/schemas/signInSchema'
import type { SignInData } from '@/schemas/signInSchema'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()
const loading = computed(() => authStore.loading)

const { t } = useI18n()

defineProps<{
  authError?: string
}>()

const emit = defineEmits<{
  submit: [values: SignInData]
}>()

const emailInputId = 'cloud-sign-in-email'

const { handleSubmit, meta } = useForm({
  validationSchema: toTypedSchema(signInSchema),
  initialValues: { email: '', password: '' }
})

const onSubmit = handleSubmit((values) => emit('submit', values))
</script>
