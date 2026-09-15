<template>
  <Form
    v-slot="$form"
    class="flex flex-col gap-6"
    :resolver="zodResolver(signInSchema)"
    @submit="onSubmit"
  >
    <!-- Email Field -->
    <FormField v-slot="$field" name="email" class="flex flex-col gap-2">
      <label
        class="mb-1 text-base text-primary-comfy-canvas/70"
        :for="emailInputId"
      >
        {{ t('auth.login.emailLabel') }}
      </label>
      <Input
        v-bind="$field.props"
        :id="emailInputId"
        autocomplete="email"
        :class="CLOUD_AUTH_FIELD_CLASS"
        type="text"
        :placeholder="t('auth.login.emailPlaceholder')"
        :aria-invalid="$field.invalid"
      />
      <small v-if="$field.invalid" class="text-red-500">{{
        $field.error.message
      }}</small>
    </FormField>

    <!-- Password Field -->
    <FormField v-slot="$field" name="password" class="flex flex-col gap-2">
      <label
        class="mb-1 text-base text-primary-comfy-canvas/70"
        for="cloud-sign-in-password"
      >
        {{ t('auth.login.passwordLabel') }}
      </label>
      <div class="relative">
        <Input
          v-bind="$field.props"
          id="cloud-sign-in-password"
          autocomplete="current-password"
          :type="passwordVisible ? 'text' : 'password'"
          :placeholder="t('auth.login.passwordPlaceholder')"
          :class="cn('pr-10', CLOUD_AUTH_FIELD_CLASS)"
          :aria-invalid="$field.invalid"
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
      <small v-if="$field.invalid" class="text-red-500">{{
        $field.error.message
      }}</small>

      <router-link
        :to="{ name: 'cloud-forgot-password' }"
        class="mt-1 self-start text-sm text-primary-comfy-canvas/70 underline"
      >
        {{ t('auth.login.forgotPassword') }}
      </router-link>
    </FormField>

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
      :disabled="!$form.valid"
    >
      {{ t('auth.login.loginButton') }}
    </Button>
  </Form>
</template>

<script setup lang="ts">
import type { FormSubmitEvent } from '@primevue/forms'
import { Form, FormField } from '@primevue/forms'
import { zodResolver } from '@primevue/forms/resolvers/zod'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Message from '@/components/ui/message/Message.vue'
import { CLOUD_AUTH_FIELD_CLASS } from '@/platform/cloud/onboarding/constants/authClasses'
import { signInSchema } from '@/schemas/signInSchema'
import type { SignInData } from '@/schemas/signInSchema'
import { useAuthStore } from '@/stores/authStore'

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
const passwordVisible = ref(false)

const onSubmit = (event: FormSubmitEvent) => {
  if (event.valid) {
    emit('submit', event.values as SignInData)
  }
}
</script>
