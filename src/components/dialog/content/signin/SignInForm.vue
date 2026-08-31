<template>
  <form class="flex flex-col gap-6" @submit.prevent="onSubmit">
    <!-- Email Field -->
    <div class="flex flex-col gap-2">
      <label class="mb-2 text-base font-medium opacity-80" :for="emailInputId">
        {{ t('auth.login.emailLabel') }}
      </label>
      <Input
        :id="emailInputId"
        :model-value="values.email"
        name="email"
        autocomplete="email"
        class="h-10"
        type="text"
        :placeholder="t('auth.login.emailPlaceholder')"
        :aria-invalid="Boolean(errors.email)"
        :aria-describedby="errors.email ? emailErrorId : undefined"
        @update:model-value="updateEmail"
      />
      <small v-if="errors.email" :id="emailErrorId" class="text-red-500">
        {{ errors.email }}
      </small>
    </div>

    <!-- Password Field -->
    <div class="flex flex-col gap-2">
      <div class="mb-2 flex items-center justify-between">
        <label
          class="text-base font-medium opacity-80"
          for="comfy-org-sign-in-password"
        >
          {{ t('auth.login.passwordLabel') }}
        </label>
        <span
          :class="
            cn('text-base font-medium text-muted select-none', {
              'cursor-not-allowed opacity-50':
                !values.email || Boolean(errors.email),
              'cursor-pointer': values.email && !errors.email
            })
          "
          @click="handleForgotPassword(values.email, !errors.email)"
        >
          {{ t('auth.login.forgotPassword') }}
        </span>
      </div>
      <div class="relative">
        <Input
          id="comfy-org-sign-in-password"
          :model-value="values.password"
          name="password"
          autocomplete="current-password"
          :type="passwordVisible ? 'text' : 'password'"
          :placeholder="t('auth.login.passwordPlaceholder')"
          :aria-invalid="Boolean(errors.password)"
          :aria-describedby="errors.password ? passwordErrorId : undefined"
          class="h-10 pr-10"
          @update:model-value="updatePassword"
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
      <small v-if="errors.password" :id="passwordErrorId" class="text-red-500">
        {{ errors.password }}
      </small>
    </div>

    <!-- Submit Button -->
    <ProgressSpinner v-if="loading" class="mx-auto size-8" />
    <Button
      v-else
      type="submit"
      class="mt-4 h-10 font-medium"
      :disabled="!isValid"
    >
      {{ t('auth.login.loginButton') }}
    </Button>
  </form>
</template>

<script setup lang="ts">
import { useThrottleFn } from '@vueuse/core'
import { useToast } from '@/components/ui/toast'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import ProgressSpinner from '@/components/ui/spinner/Spinner.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { signInSchema } from '@/schemas/signInSchema'
import type { SignInData } from '@/schemas/signInSchema'
import { useAuthStore } from '@/stores/authStore'
import { getZodFieldErrors } from '@/utils/zodFieldErrors'
import { cn } from '@comfyorg/tailwind-utils'

const authStore = useAuthStore()
const authActions = useAuthActions()
const loading = computed(() => authStore.loading)
const toast = useToast()

const { t } = useI18n()

const emit = defineEmits<{
  submit: [values: SignInData]
}>()

const emailInputId = 'comfy-org-sign-in-email'
const emailErrorId = `${emailInputId}-error`
const passwordErrorId = 'comfy-org-sign-in-password-error'
const passwordVisible = ref(false)
const values = reactive<SignInData>({ email: '', password: '' })
const errors = reactive<Partial<Record<keyof SignInData, string>>>({})
const isValid = computed(() => Object.keys(errors).length === 0)

function validateField(field: keyof SignInData) {
  const result = signInSchema.safeParse(values)
  const message = result.success
    ? undefined
    : getZodFieldErrors(result.error)[field]

  if (message) errors[field] = message
  else delete errors[field]
}

function updateEmail(value: string | number | undefined) {
  values.email = String(value ?? '')
  validateField('email')
}

function updatePassword(value: string | number | undefined) {
  values.password = String(value ?? '')
  validateField('password')
}

const onSubmit = useThrottleFn(() => {
  const result = signInSchema.safeParse(values)
  if (result.success) {
    emit('submit', result.data)
    return
  }

  Object.assign(errors, getZodFieldErrors(result.error))
}, 1_500)

const handleForgotPassword = async (
  email: string,
  isValid: boolean | undefined
) => {
  if (!email || !isValid) {
    toast.warning(t('auth.login.emailPlaceholder'), { duration: 5_000 })
    // Focus the email input
    document.getElementById(emailInputId)?.focus?.()
    return
  }
  await authActions.sendPasswordReset(email)
}
</script>
