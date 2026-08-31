<template>
  <!-- Password Field -->
  <div ref="passwordField" class="flex flex-col gap-2">
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
        id="comfy-org-sign-up-password"
        v-model="password"
        name="password"
        autocomplete="new-password"
        :type="passwordVisible ? 'text' : 'password'"
        :placeholder="t('auth.signup.passwordPlaceholder')"
        :class="cn('pr-10', fieldClass)"
        :aria-invalid="Boolean(passwordError)"
        :aria-describedby="
          showPasswordRequirements ? passwordErrorId : undefined
        "
        @input="passwordDirty = true"
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
    <div
      v-if="showPasswordRequirements"
      :id="passwordErrorId"
      class="flex flex-col gap-1"
    >
      <PasswordRules
        :password="password"
        :copy="passwordRulesCopy"
        root-class="text-sm"
        list-class="mt-1 space-y-1"
        unmet-class="text-red-500"
      />
    </div>
  </div>

  <!-- Confirm Password Field -->
  <div class="flex flex-col gap-2">
    <label
      class="mb-2 text-base font-medium opacity-80"
      for="comfy-org-sign-up-confirm-password"
    >
      {{ t('auth.login.confirmPasswordLabel') }}
    </label>
    <div class="relative">
      <Input
        id="comfy-org-sign-up-confirm-password"
        v-model="confirmPassword"
        name="confirmPassword"
        autocomplete="new-password"
        :type="confirmPasswordVisible ? 'text' : 'password'"
        :placeholder="t('auth.login.confirmPasswordPlaceholder')"
        :class="cn('pr-10', fieldClass)"
        :aria-invalid="Boolean(confirmPasswordError)"
        :aria-describedby="
          confirmPasswordError ? confirmPasswordErrorId : undefined
        "
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
    <small
      v-if="confirmPasswordError"
      :id="confirmPasswordErrorId"
      class="text-red-500"
    >
      {{ confirmPasswordError }}
    </small>
  </div>
</template>

<script setup lang="ts">
import { useFocusWithin } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import PasswordRules from '@comfyorg/account-ui/auth/PasswordRules'
import { cn } from '@comfyorg/tailwind-utils'

import Input from '@/components/ui/input/Input.vue'

const {
  fieldClass = 'h-10',
  passwordError,
  confirmPasswordError
} = defineProps<{
  fieldClass?: HTMLAttributes['class']
  passwordError?: string
  confirmPasswordError?: string
}>()

const password = defineModel<string>('password', { required: true })
const confirmPassword = defineModel<string>('confirmPassword', {
  required: true
})

const { t } = useI18n()
const passwordDirty = ref(false)
const passwordVisible = ref(false)
const confirmPasswordVisible = ref(false)
const passwordErrorId = 'comfy-org-sign-up-password-error'
const confirmPasswordErrorId = 'comfy-org-sign-up-confirm-password-error'
const passwordField = useTemplateRef<HTMLElement>('passwordField')
const { focused: isPasswordFocused } = useFocusWithin(passwordField)
const showPasswordRequirements = computed(
  () =>
    isPasswordFocused.value && (passwordDirty.value || Boolean(passwordError))
)

const passwordRulesCopy = computed(() => ({
  requirements: t('validation.password.requirements'),
  length: t('validation.password.minLength'),
  uppercase: t('validation.password.uppercase'),
  lowercase: t('validation.password.lowercase'),
  number: t('validation.password.number'),
  special: t('validation.password.special')
}))
</script>
