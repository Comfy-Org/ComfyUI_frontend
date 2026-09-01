<template>
  <!-- Password Field -->
  <FormField
    ref="passwordField"
    v-slot="$field"
    name="password"
    class="flex flex-col gap-2"
  >
    <div class="mb-2 flex items-center justify-between">
      <label
        class="text-base font-medium opacity-80"
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
      :pt:pc-input-text:root:class="fieldClass"
      :class="{ 'p-invalid': $field.invalid }"
      fluid
    />
    <div v-if="$field.dirty && isPasswordFocused" class="flex flex-col gap-1">
      <small class="text-sm">
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
  </FormField>

  <!-- Confirm Password Field -->
  <FormField v-slot="$field" name="confirmPassword" class="flex flex-col gap-2">
    <label
      class="mb-2 text-base font-medium opacity-80"
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
      :pt:pc-input-text:root:class="fieldClass"
      :class="{ 'p-invalid': $field.invalid }"
      fluid
    />
    <small v-if="$field.error" class="text-red-500">{{
      $field.error.message
    }}</small>
  </FormField>
</template>

<script setup lang="ts">
import { FormField } from '@primevue/forms'
import { useFocusWithin } from '@vueuse/core'
import Password from 'primevue/password'
import { computed, ref, useTemplateRef } from 'vue'
import type { ComponentPublicInstance, HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

const { fieldClass = 'h-10' } = defineProps<{
  fieldClass?: HTMLAttributes['class']
}>()

const { t } = useI18n()
const password = ref('')
const passwordField = useTemplateRef<ComponentPublicInstance>('passwordField')
const { focused: isPasswordFocused } = useFocusWithin(passwordField)

// TODO: Use dynamic form to better organize the password checks.
// Ref: https://primevue.org/forms/#dynamic
const passwordChecks = computed(() => ({
  length: password.value.length >= 8 && password.value.length <= 32,
  uppercase: /[A-Z]/.test(password.value),
  lowercase: /[a-z]/.test(password.value),
  number: /\d/.test(password.value),
  special: /[^A-Za-z0-9]/.test(password.value)
}))
</script>
