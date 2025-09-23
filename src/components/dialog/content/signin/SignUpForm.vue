<template>
  <Form
    class="flex flex-col gap-6"
    :resolver="zodResolver(signUpSchema)"
    @submit="onSubmit"
  >
    <!-- Email Field -->
    <FormField v-slot="$field" name="email" class="flex flex-col gap-2">
      <label
        class="opacity-80 text-base font-medium mb-2"
        for="comfy-org-sign-up-email"
      >
        {{ t('auth.signup.emailLabel') }}
      </label>
      <InputText
        pt:root:id="comfy-org-sign-up-email"
        pt:root:autocomplete="email"
        class="h-10"
        type="text"
        :placeholder="t('auth.signup.emailPlaceholder')"
        :invalid="$field.invalid"
      />
      <small v-if="$field.error" class="text-red-500">{{
        $field.error.message
      }}</small>
    </FormField>

    <PasswordFields />

    <!-- Personal Data Consent Checkbox -->
    <FormField
      v-slot="$field"
      name="personalDataConsent"
      class="flex items-center gap-2"
    >
      <Checkbox
        input-id="comfy-org-sign-up-personal-data-consent"
        :binary="true"
        :invalid="$field.invalid"
      />
      <label
        for="comfy-org-sign-up-personal-data-consent"
        class="opacity-80 text-base font-medium"
      >
        {{ t('auth.signup.personalDataConsentLabel') }}
      </label>
      <small v-if="$field.error" class="text-red-500 -mt-4">{{
        $field.error.message
      }}</small>
    </FormField>

    <!-- Submit Button -->
    <Button
      type="submit"
      :label="t('auth.signup.signUpButton')"
      class="h-10 font-medium mt-4"
    />
  </Form>
</template>

<script setup lang="ts">
import { Form, FormField, FormSubmitEvent } from '@primevue/forms'
import { zodResolver } from '@primevue/forms/resolvers/zod'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import { useI18n } from 'vue-i18n'

import { type SignUpData, signUpSchema } from '@/schemas/signInSchema'

import PasswordFields from './PasswordFields.vue'

const { t } = useI18n()

const emit = defineEmits<{
  submit: [values: SignUpData]
}>()

const onSubmit = (event: FormSubmitEvent) => {
  if (event.valid) {
    emit('submit', event.values as SignUpData)
  }
}
</script>
