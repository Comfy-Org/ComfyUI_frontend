<template>
  <form class="flex flex-col gap-6" @submit.prevent="onSubmit">
    <!-- Email Field -->
    <div class="flex flex-col gap-2">
      <label
        class="mb-1 text-base text-primary-comfy-canvas/70"
        :for="emailInputId"
      >
        {{ t('auth.login.emailLabel') }}
      </label>
      <Input
        :id="emailInputId"
        :model-value="values.email"
        name="email"
        autocomplete="email"
        :class="CLOUD_AUTH_FIELD_CLASS"
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
      <label
        class="mb-1 text-base text-primary-comfy-canvas/70"
        for="cloud-sign-in-password"
      >
        {{ t('auth.login.passwordLabel') }}
      </label>
      <div class="relative">
        <Input
          id="cloud-sign-in-password"
          :model-value="values.password"
          name="password"
          autocomplete="current-password"
          :type="passwordVisible ? 'text' : 'password'"
          :placeholder="t('auth.login.passwordPlaceholder')"
          :class="cn('pr-10', CLOUD_AUTH_FIELD_CLASS)"
          :aria-invalid="Boolean(errors.password)"
          :aria-describedby="errors.password ? passwordErrorId : undefined"
          @update:model-value="updatePassword"
        />
        <button
          type="button"
          class="absolute top-1/2 right-3 flex -translate-y-1/2 text-primary-comfy-canvas/70"
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

      <router-link
        :to="{ name: 'cloud-forgot-password' }"
        class="mt-1 self-start text-sm text-primary-comfy-canvas/70 underline"
      >
        {{ t('auth.login.forgotPassword') }}
      </router-link>
    </div>

    <!-- Auth Error Message -->
    <Message v-if="authError" severity="error">
      {{ authError }}
    </Message>

    <Button
      type="submit"
      variant="brand-solid"
      size="brand"
      class="mt-2 w-full"
      :loading="loading"
      :disabled="!isValid"
    >
      {{ t('auth.login.loginButton') }}
    </Button>
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Message from '@/components/ui/message/Message.vue'
import { CLOUD_AUTH_FIELD_CLASS } from '@/platform/cloud/onboarding/constants/authClasses'
import { signInSchema } from '@/schemas/signInSchema'
import type { SignInData } from '@/schemas/signInSchema'
import { useAuthStore } from '@/stores/authStore'
import { getZodFieldErrors } from '@/utils/zodFieldErrors'

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
const emailErrorId = `${emailInputId}-error`
const passwordErrorId = 'cloud-sign-in-password-error'
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

function onSubmit() {
  const result = signInSchema.safeParse(values)
  if (result.success) {
    emit('submit', result.data)
    return
  }

  Object.assign(errors, getZodFieldErrors(result.error))
}
</script>
