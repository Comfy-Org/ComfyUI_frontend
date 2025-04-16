<template>
  <Form
    v-slot="$form"
    class="flex flex-col gap-6"
    :resolver="zodResolver(signUpSchema)"
    @submit="onSubmit"
  >
    <!-- Email Field -->
    <div class="flex flex-col gap-2">
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
        name="email"
        type="text"
        :placeholder="t('auth.signup.emailPlaceholder')"
        :invalid="$form.email?.invalid"
      />
      <small v-if="$form.email?.invalid" class="text-red-500">{{
        $form.email.error.message
      }}</small>
    </div>

    <!-- Password Field -->
    <div class="flex flex-col gap-2">
      <div class="flex justify-between items-center mb-2">
        <label
          class="opacity-80 text-base font-medium"
          for="comfy-org-sign-up-password"
        >
          {{ t('auth.signup.passwordLabel') }}
        </label>
      </div>
      <Password
        v-model="password"
        input-id="comfy-org-sign-up-password"
        pt:pc-input-text:root:autocomplete="new-password"
        name="password"
        :feedback="false"
        toggle-mask
        :placeholder="t('auth.signup.passwordPlaceholder')"
        :class="{ 'p-invalid': $form.password?.invalid }"
        fluid
        class="h-10"
      />
      <div class="flex flex-col gap-1">
        <small
          v-if="$form.password?.dirty || $form.password?.invalid"
          class="text-sm"
        >
          {{ t('validation.password.requirements') }}:
          <ul class="mt-1 space-y-1">
            <li
              :class="{
                'text-red-500': !passwordChecks.length
              }"
            >
              {{ t('validation.password.minLength') }}
            </li>
            <li
              :class="{
                'text-red-500': !passwordChecks.uppercase
              }"
            >
              {{ t('validation.password.uppercase') }}
            </li>
            <li
              :class="{
                'text-red-500': !passwordChecks.lowercase
              }"
            >
              {{ t('validation.password.lowercase') }}
            </li>
            <li
              :class="{
                'text-red-500': !passwordChecks.number
              }"
            >
              {{ t('validation.password.number') }}
            </li>
            <li
              :class="{
                'text-red-500': !passwordChecks.special
              }"
            >
              {{ t('validation.password.special') }}
            </li>
          </ul>
        </small>
      </div>
    </div>

    <!-- Confirm Password Field -->
    <div class="flex flex-col gap-2">
      <label
        class="opacity-80 text-base font-medium mb-2"
        for="comfy-org-sign-up-confirm-password"
      >
        {{ t('auth.login.confirmPasswordLabel') }}
      </label>
      <Password
        name="confirmPassword"
        input-id="comfy-org-sign-up-confirm-password"
        pt:pc-input-text:root:autocomplete="new-password"
        :feedback="false"
        toggle-mask
        :placeholder="t('auth.login.confirmPasswordPlaceholder')"
        :class="{ 'p-invalid': $form.confirmPassword?.invalid }"
        fluid
        class="h-10"
      />
      <small v-if="$form.confirmPassword?.error" class="text-red-500">{{
        $form.confirmPassword.error.message
      }}</small>
    </div>

    <!-- Submit Button -->
    <Button
      type="submit"
      :label="t('auth.signup.signUpButton')"
      class="h-10 font-medium mt-4"
    />
  </Form>
</template>

<script setup lang="ts">
import { Form, FormSubmitEvent } from '@primevue/forms'
import { zodResolver } from '@primevue/forms/resolvers/zod'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { type SignUpData, signUpSchema } from '@/schemas/signInSchema'

const { t } = useI18n()
const password = ref('')

// TODO: Use dynamic form to better organize the password checks.
// Ref: https://primevue.org/forms/#dynamic
const passwordChecks = computed(() => ({
  length: password.value.length >= 8 && password.value.length <= 32,
  uppercase: /[A-Z]/.test(password.value),
  lowercase: /[a-z]/.test(password.value),
  number: /\d/.test(password.value),
  special: /[^A-Za-z0-9]/.test(password.value)
}))

const emit = defineEmits<{
  submit: [values: SignUpData]
}>()

const onSubmit = (event: FormSubmitEvent) => {
  if (event.valid) {
    emit('submit', event.values as SignUpData)
  }
}
</script>
