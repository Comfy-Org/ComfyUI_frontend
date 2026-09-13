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
      <PasswordRules
        :password="password"
        :copy="passwordRulesCopy"
        root-class="text-sm"
        list-class="mt-1 space-y-1"
        unmet-class="text-red-500"
      />
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

import { PasswordRules } from '@comfyorg/account/vue'

const { fieldClass = 'h-10' } = defineProps<{
  fieldClass?: HTMLAttributes['class']
}>()

const { t } = useI18n()
const password = ref('')
const passwordField = useTemplateRef<ComponentPublicInstance>('passwordField')
const { focused: isPasswordFocused } = useFocusWithin(passwordField)

const passwordRulesCopy = computed(() => ({
  requirements: t('validation.password.requirements'),
  length: t('validation.password.minLength'),
  uppercase: t('validation.password.uppercase'),
  lowercase: t('validation.password.lowercase'),
  number: t('validation.password.number'),
  special: t('validation.password.special')
}))
</script>
