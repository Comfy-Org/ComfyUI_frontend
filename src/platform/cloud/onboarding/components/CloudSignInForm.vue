<template>
  <Form
    v-slot="$form"
    class="flex flex-col gap-6"
    :resolver="zodResolver(signInSchema)"
    @submit="onSubmit"
  >
    <!-- Email Field -->
    <div class="flex flex-col gap-2">
      <label
        class="mb-1 text-base text-primary-comfy-canvas/70"
        :for="emailInputId"
      >
        {{ t('auth.login.emailLabel') }}
      </label>
      <InputText
        :id="emailInputId"
        autocomplete="email"
        :class="CLOUD_AUTH_FIELD_CLASS"
        name="email"
        type="text"
        :placeholder="t('auth.login.emailPlaceholder')"
        :invalid="$form.email?.invalid"
      />
      <small v-if="$form.email?.invalid" class="text-red-500">{{
        $form.email.error.message
      }}</small>
    </div>

    <!-- Password Field -->
    <div class="flex flex-col gap-2">
      <label
        class="mb-1 text-base text-primary-comfy-canvas/70"
        for="cloud-sign-in-password"
      >
        {{ t('auth.login.passwordLabel') }}
      </label>
      <Password
        input-id="cloud-sign-in-password"
        pt:pc-input-text:root:autocomplete="current-password"
        :pt:pc-input-text:root:class="CLOUD_AUTH_FIELD_CLASS"
        name="password"
        :feedback="false"
        toggle-mask
        :placeholder="t('auth.login.passwordPlaceholder')"
        :class="{ 'p-invalid': $form.password?.invalid }"
        fluid
      />
      <small v-if="$form.password?.invalid" class="text-red-500">{{
        $form.password.error.message
      }}</small>

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
      :disabled="!$form.valid"
    >
      {{ t('auth.login.loginButton') }}
    </Button>
  </Form>
</template>

<script setup lang="ts">
import type { FormSubmitEvent } from '@primevue/forms'
import { Form } from '@primevue/forms'
import { zodResolver } from '@primevue/forms/resolvers/zod'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
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

const onSubmit = (event: FormSubmitEvent) => {
  if (event.valid) {
    emit('submit', event.values as SignInData)
  }
}
</script>
