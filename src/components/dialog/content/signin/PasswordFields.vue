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
    <div class="relative">
      <Input
        v-bind="$field.props"
        id="comfy-org-sign-up-password"
        autocomplete="new-password"
        :type="passwordVisible ? 'text' : 'password'"
        :placeholder="t('auth.signup.passwordPlaceholder')"
        :class="cn('pr-10', fieldClass)"
        :aria-invalid="$field.invalid"
        @input="updatePasswordChecks"
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
    <div class="relative">
      <Input
        v-bind="$field.props"
        id="comfy-org-sign-up-confirm-password"
        autocomplete="new-password"
        :type="confirmPasswordVisible ? 'text' : 'password'"
        :placeholder="t('auth.login.confirmPasswordPlaceholder')"
        :class="cn('pr-10', fieldClass)"
        :aria-invalid="$field.invalid"
      />
      <button
        type="button"
        class="absolute top-1/2 right-3 flex -translate-y-1/2 text-muted-foreground"
        :aria-label="
          t(confirmPasswordVisible ? 'auth.hidePassword' : 'auth.showPassword')
        "
        :aria-pressed="confirmPasswordVisible"
        @click="confirmPasswordVisible = !confirmPasswordVisible"
      >
        <i
          :class="
            confirmPasswordVisible
              ? 'icon-[lucide--eye-off]'
              : 'icon-[lucide--eye]'
          "
          class="size-4"
        />
      </button>
    </div>
    <small v-if="$field.error" class="text-red-500">{{
      $field.error.message
    }}</small>
  </FormField>
</template>

<script setup lang="ts">
import { FormField } from '@primevue/forms'
import { useFocusWithin } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import type { ComponentPublicInstance, HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Input from '@/components/ui/input/Input.vue'

const { fieldClass = 'h-10' } = defineProps<{
  fieldClass?: HTMLAttributes['class']
}>()

const { t } = useI18n()
const password = ref('')
const passwordVisible = ref(false)
const confirmPasswordVisible = ref(false)
const passwordField = useTemplateRef<ComponentPublicInstance>('passwordField')
const { focused: isPasswordFocused } = useFocusWithin(passwordField)

const updatePasswordChecks = (event: Event) => {
  if (event.target instanceof HTMLInputElement) {
    password.value = event.target.value
  }
}

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
