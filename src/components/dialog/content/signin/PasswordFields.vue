<template>
  <!-- Password Field -->
  <FormField v-slot="{ componentField, meta }" name="password">
    <FormItem class="flex flex-col gap-2">
      <div class="mb-2 flex items-center justify-between">
        <FormLabel class="text-base font-medium opacity-80">
          {{ t('auth.signup.passwordLabel') }}
        </FormLabel>
      </div>
      <FormControl>
        <Password
          v-bind="componentField"
          pt:pc-input-text:root:autocomplete="new-password"
          :feedback="false"
          toggle-mask
          :placeholder="t('auth.signup.passwordPlaceholder')"
          :class="{ 'p-invalid': Boolean(errors.password) }"
          fluid
          class="h-10"
        />
      </FormControl>
      <div class="flex flex-col gap-1">
        <small v-if="meta.dirty || Boolean(errors.password)" class="text-sm">
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
    </FormItem>
  </FormField>

  <!-- Confirm Password Field -->
  <FormField v-slot="{ componentField }" name="confirmPassword">
    <FormItem class="flex flex-col gap-2">
      <FormLabel class="mb-2 text-base font-medium opacity-80">
        {{ t('auth.login.confirmPasswordLabel') }}
      </FormLabel>
      <FormControl>
        <Password
          v-bind="componentField"
          pt:pc-input-text:root:autocomplete="new-password"
          :feedback="false"
          toggle-mask
          :placeholder="t('auth.login.confirmPasswordPlaceholder')"
          :class="{ 'p-invalid': Boolean(errors.confirmPassword) }"
          fluid
          class="h-10"
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  </FormField>
</template>

<script setup lang="ts">
import Password from 'primevue/password'
import { useFormContext } from 'vee-validate'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'

type PasswordFormValues = {
  confirmPassword: string
  password: string
}

const { t } = useI18n()
const { errors, values } = useFormContext<PasswordFormValues>()

const passwordChecks = computed(() => ({
  length: values.password.length >= 8 && values.password.length <= 32,
  uppercase: /[A-Z]/.test(values.password),
  lowercase: /[a-z]/.test(values.password),
  number: /\d/.test(values.password),
  special: /[^A-Za-z0-9]/.test(values.password)
}))
</script>
