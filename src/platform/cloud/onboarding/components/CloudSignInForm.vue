<template>
  <Form
    v-slot="$form"
    class="flex flex-col gap-6"
    :resolver="zodResolver(signInSchema)"
    @submit="onSubmit"
  >
    <!-- Email Field -->
    <div class="flex flex-col gap-2">
      <label class="mb-2 text-base font-medium opacity-80" :for="emailInputId">
        {{ t('auth.login.emailLabel') }}
      </label>
      <InputText
        :id="emailInputId"
        autocomplete="email"
        class="h-10"
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
      <div class="mb-2 flex items-center justify-between">
        <label
          class="text-base font-medium opacity-80"
          for="cloud-sign-in-password"
        >
          {{ t('auth.login.passwordLabel') }}
        </label>
      </div>
      <Password
        input-id="cloud-sign-in-password"
        pt:pc-input-text:root:autocomplete="current-password"
        name="password"
        :feedback="false"
        toggle-mask
        :placeholder="t('auth.login.passwordPlaceholder')"
        :class="{ 'p-invalid': $form.password?.invalid }"
        fluid
        class="h-10"
      />
      <small v-if="$form.password?.invalid" class="text-red-500">{{
        $form.password.error.message
      }}</small>

      <router-link
        :to="{ name: 'cloud-forgot-password' }"
        class="text-sm font-medium text-muted no-underline"
      >
        {{ t('auth.login.forgotPassword') }}
      </router-link>
    </div>

    <!-- Auth Error Message -->
    <Message v-if="authError" severity="error">
      {{ authError }}
    </Message>

    <!-- Submit Button -->
    <ProgressSpinner v-if="loading" class="size-8" />
    <Button
      v-else
      type="submit"
      variant="secondary"
      class="relative mt-4 h-10 w-full gap-4 rounded-md border border-solid border-smoke-800/10 bg-smoke-800/10 text-sm/4 font-medium text-primary-comfy-canvas shadow-inset-highlight hover:bg-sand-300/20"
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
import Message from 'primevue/message'
import Password from 'primevue/password'
import ProgressSpinner from 'primevue/progressspinner'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
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
<style scoped>
:deep(.p-inputtext) {
  border: none !important;
  box-shadow: none !important;
  background: #2d2e32 !important;
  color: var(--color-primary-comfy-canvas) !important;
  caret-color: var(--color-primary-comfy-canvas);
}

:deep(.p-inputtext::placeholder) {
  color: rgb(from var(--color-primary-comfy-canvas) r g b / 0.5);
}

:deep(.p-password input) {
  border: none !important;
  box-shadow: none !important;
}

:deep(.p-password-toggle-mask-icon) {
  cursor: pointer;
}
:deep(.p-checkbox-checked .p-checkbox-box) {
  background-color: #f0ff41 !important;
  border-color: #f0ff41 !important;
}
</style>
