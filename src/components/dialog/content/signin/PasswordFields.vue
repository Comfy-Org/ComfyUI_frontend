<template>
  <VeeField v-slot="{ componentField, errors, meta, value }" name="password">
    <Field ref="passwordField" :data-invalid="!!errors.length">
      <FieldLabel for="comfy-org-sign-up-password">
        {{ t('auth.signup.passwordLabel') }}
      </FieldLabel>
      <PasswordInput
        v-bind="componentField"
        id="comfy-org-sign-up-password"
        autocomplete="new-password"
        :placeholder="t('auth.signup.passwordPlaceholder')"
        :class="fieldClass"
        :aria-invalid="!!errors.length"
      />
      <PasswordRules
        v-if="meta.dirty && isPasswordFocused"
        :password="value ?? ''"
        :copy="passwordRulesCopy"
        root-class="text-sm"
        list-class="mt-1 space-y-1"
        unmet-class="text-destructive-background"
      />
    </Field>
  </VeeField>

  <VeeField v-slot="{ componentField, errors }" name="confirmPassword">
    <Field :data-invalid="!!errors.length">
      <FieldLabel for="comfy-org-sign-up-confirm-password">
        {{ t('auth.login.confirmPasswordLabel') }}
      </FieldLabel>
      <PasswordInput
        v-bind="componentField"
        id="comfy-org-sign-up-confirm-password"
        autocomplete="new-password"
        :placeholder="t('auth.login.confirmPasswordPlaceholder')"
        :class="fieldClass"
        :aria-invalid="!!errors.length"
      />
      <FieldError v-if="errors.length" :errors />
    </Field>
  </VeeField>
</template>

<script setup lang="ts">
import { useFocusWithin } from '@vueuse/core'
import { Field as VeeField } from 'vee-validate'
import { computed, useTemplateRef } from 'vue'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import PasswordRules from '@comfyorg/account-ui/auth/PasswordRules'
import Field from '@/components/ui/field/Field.vue'
import FieldError from '@/components/ui/field/FieldError.vue'
import FieldLabel from '@/components/ui/field/FieldLabel.vue'
import PasswordInput from '@/components/ui/input/PasswordInput.vue'

const { fieldClass } = defineProps<{
  fieldClass?: HTMLAttributes['class']
}>()

const { t } = useI18n()
const passwordField = useTemplateRef('passwordField')
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
